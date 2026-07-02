use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use storageos_core::platform::Platform;
use tokio_util::io::ReaderStream;
use tower_http::cors::{Any, CorsLayer};

use crate::device_registry::{DeviceRecord, DeviceRegistry};

pub struct AppState {
    started_at: Instant,
    pub registry: Arc<DeviceRegistry>,
    pub device_id: String,
    pub pairing_token: String,
}

impl AppState {
    pub fn new(registry: Arc<DeviceRegistry>, device_id: String) -> Self {
        let pairing_token = uuid::Uuid::new_v4().to_string();
        Self {
            started_at: Instant::now(),
            registry,
            device_id,
            pairing_token,
        }
    }
}

pub fn router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health))
        .route("/version", get(version))
        .route("/roots", get(roots))
        .route("/directory", get(directory))
        .route("/file", get(file_metadata))
        .route("/download", get(download))
        .route("/thumbnail", get(thumbnail))
        .route("/pair", get(pair_info))
        .route("/pair/qr", get(pair_qr))
        .route("/presence", get(presence))
        .route("/devices", get(list_devices))
        .route("/devices/pair", post(pair_device))
        .route("/devices/:id", get(get_device).patch(rename_device).delete(forget_device))
        .route("/devices/:id/forget", post(remote_forget))
        .route("/ws", get(ws_upgrade))
        .layer(cors)
        .with_state(state)
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

// --- Health & Version ---

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    uptime_secs: u64,
    version: &'static str,
    platform: String,
    device_id: String,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        uptime_secs: state.started_at.elapsed().as_secs(),
        version: env!("CARGO_PKG_VERSION"),
        platform: Platform::current().display_name().to_string(),
        device_id: state.device_id.clone(),
    })
}

#[derive(Serialize)]
struct VersionResponse {
    agent: &'static str,
    core: &'static str,
    platform: String,
}

async fn version() -> Json<VersionResponse> {
    Json(VersionResponse {
        agent: env!("CARGO_PKG_VERSION"),
        core: env!("CARGO_PKG_VERSION"),
        platform: Platform::current().display_name().to_string(),
    })
}

// --- Presence ---

#[derive(Serialize)]
struct PresenceResponse {
    device_id: String,
    system_name: String,
    status: String,
    address: String,
    version: String,
    platform: String,
    capabilities: String,
    uptime_secs: u64,
    timestamp: i64,
}

async fn presence(State(state): State<Arc<AppState>>) -> Json<PresenceResponse> {
    Json(PresenceResponse {
        device_id: state.device_id.clone(),
        system_name: device_name(),
        status: "online".to_string(),
        address: format!("{}:{}", detect_lan_ip(), storageos_core::config::constants::DEFAULT_AGENT_PORT),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: Platform::current().display_name().to_string(),
        capabilities: "{}".to_string(),
        uptime_secs: state.started_at.elapsed().as_secs(),
        timestamp: now_epoch(),
    })
}

// --- QR Pairing ---

#[derive(Serialize)]
struct PairInfo {
    device_id: String,
    host: String,
    port: u16,
    name: String,
    pairing_token: String,
    version: String,
}

fn detect_lan_ip() -> String {
    std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("8.8.8.8:80")?;
            s.local_addr()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}

fn device_name() -> String {
    hostname::get()
        .ok()
        .and_then(|n| n.into_string().ok())
        .unwrap_or_else(|| "StorageOS".to_string())
}

async fn pair_info(State(state): State<Arc<AppState>>) -> Json<PairInfo> {
    let host = detect_lan_ip();
    let name = device_name();
    tracing::info!(host = %host, name = %name, device_id = %state.device_id, "Pair info requested");
    Json(PairInfo {
        device_id: state.device_id.clone(),
        host,
        port: storageos_core::config::constants::DEFAULT_AGENT_PORT,
        name,
        pairing_token: state.pairing_token.clone(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn pair_qr(State(state): State<Arc<AppState>>) -> Response {
    let host = detect_lan_ip();
    let port = storageos_core::config::constants::DEFAULT_AGENT_PORT;
    let name = device_name();

    let qr_payload = PairInfo {
        device_id: state.device_id.clone(),
        host,
        port,
        name,
        pairing_token: state.pairing_token.clone(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };
    let qr_data = serde_json::to_string(&qr_payload).unwrap_or_default();

    let code = match qrcode::QrCode::new(qr_data.as_bytes()) {
        Ok(c) => c,
        Err(_) => {
            return Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from("Failed to generate QR code"))
                .unwrap();
        }
    };

    let svg = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(256, 256)
        .quiet_zone(true)
        .build();

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/svg+xml")
        .header(header::CACHE_CONTROL, "no-cache")
        .body(Body::from(svg))
        .unwrap()
}

// --- Mutual Pairing ---

#[derive(Deserialize)]
struct PairDeviceRequest {
    device_id: String,
    system_name: String,
    device_type: String,
    platform: String,
    version: String,
    address: String,
    pairing_token: String,
}

#[derive(Serialize)]
struct PairDeviceResponse {
    device_id: String,
    system_name: String,
    device_type: String,
    platform: String,
    version: String,
    address: String,
    paired: bool,
}

async fn pair_device(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PairDeviceRequest>,
) -> Result<Json<PairDeviceResponse>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    if req.pairing_token != state.pairing_token {
        return Err((
            StatusCode::FORBIDDEN,
            Json(crate::dto::ErrorDto {
                code: "INVALID_TOKEN".to_string(),
                message: "Invalid pairing token".to_string(),
            }),
        ));
    }

    let now = now_epoch();
    let device = DeviceRecord {
        device_id: req.device_id.clone(),
        system_name: req.system_name.clone(),
        friendly_name: req.system_name.clone(),
        device_type: req.device_type.clone(),
        platform: req.platform.clone(),
        version: req.version.clone(),
        address: req.address.clone(),
        last_seen: now,
        paired_at: now,
        status: "online".to_string(),
        capabilities: "{}".to_string(),
        permissions: "{}".to_string(),
        public_key: String::new(),
    };

    state.registry.register_device(&device).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "REGISTRY_ERROR".to_string(),
                message: e,
            }),
        )
    })?;

    tracing::info!(
        device_id = %req.device_id,
        system_name = %req.system_name,
        device_type = %req.device_type,
        "Device paired successfully"
    );

    let host = detect_lan_ip();
    let port = storageos_core::config::constants::DEFAULT_AGENT_PORT;

    Ok(Json(PairDeviceResponse {
        device_id: state.device_id.clone(),
        system_name: device_name(),
        device_type: "desktop".to_string(),
        platform: Platform::current().display_name().to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        address: format!("{host}:{port}"),
        paired: true,
    }))
}

// --- Device CRUD ---

async fn list_devices(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<DeviceRecord>>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    let devices = state.registry.list_devices().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "REGISTRY_ERROR".to_string(),
                message: e,
            }),
        )
    })?;
    Ok(Json(devices))
}

async fn get_device(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<DeviceRecord>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    let device = state.registry.get_device(&id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "REGISTRY_ERROR".to_string(),
                message: e,
            }),
        )
    })?;

    match device {
        Some(d) => Ok(Json(d)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(crate::dto::ErrorDto {
                code: "NOT_FOUND".to_string(),
                message: format!("Device {id} not found"),
            }),
        )),
    }
}

#[derive(Deserialize)]
struct RenameRequest {
    friendly_name: String,
}

async fn rename_device(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<RenameRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    let updated = state
        .registry
        .update_friendly_name(&id, &req.friendly_name)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(crate::dto::ErrorDto {
                    code: "REGISTRY_ERROR".to_string(),
                    message: e,
                }),
            )
        })?;

    if updated {
        tracing::info!(device_id = %id, friendly_name = %req.friendly_name, "Device renamed");
        Ok(Json(serde_json::json!({"ok": true})))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(crate::dto::ErrorDto {
                code: "NOT_FOUND".to_string(),
                message: format!("Device {id} not found"),
            }),
        ))
    }
}

async fn forget_device(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    let device = state.registry.get_device(&id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "REGISTRY_ERROR".to_string(),
                message: e,
            }),
        )
    })?;

    if let Some(dev) = &device {
        if !dev.address.is_empty() {
            let addr = dev.address.clone();
            let my_id = state.device_id.clone();
            tokio::spawn(async move {
                let url = format!("http://{addr}/devices/{my_id}/forget");
                let client = reqwest::Client::new();
                let _ = client
                    .post(&url)
                    .timeout(std::time::Duration::from_secs(5))
                    .send()
                    .await;
                tracing::info!(address = %addr, "Notified remote device of forget");
            });
        }
    }

    let removed = state.registry.remove_device(&id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "REGISTRY_ERROR".to_string(),
                message: e,
            }),
        )
    })?;

    if removed {
        tracing::info!(device_id = %id, "Device forgotten");
        Ok(Json(serde_json::json!({"ok": true})))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(crate::dto::ErrorDto {
                code: "NOT_FOUND".to_string(),
                message: format!("Device {id} not found"),
            }),
        ))
    }
}

async fn remote_forget(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Json<serde_json::Value> {
    let _ = state.registry.remove_device(&id);
    tracing::info!(device_id = %id, "Remote device requested forget");
    Json(serde_json::json!({"ok": true}))
}

// --- Filesystem endpoints ---

async fn roots() -> Result<Json<Vec<crate::dto::LocalDriveDto>>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!("Roots requested");
    let core_roots = storageos_core::filesystem::list_roots().map_err(|e| {
        tracing::error!(error = %e, "Failed to list roots");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "IO_ERROR".to_string(),
                message: e.to_string(),
            }),
        )
    })?;
    let drives: Vec<crate::dto::LocalDriveDto> = core_roots.into_iter().map(crate::dto::LocalDriveDto::from).collect();
    Ok(Json(drives))
}

#[derive(Deserialize)]
struct DirectoryParams {
    path: String,
}

async fn directory(
    Query(params): Query<DirectoryParams>,
) -> Result<Json<Vec<crate::dto::DirectoryEntryDto>>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, "Directory listing requested");
    let entries = tokio::task::spawn_blocking(move || {
        storageos_core::filesystem::list_directory(&params.path)
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "INTERNAL".to_string(),
                message: format!("Task join error: {e}"),
            }),
        )
    })?
    .map_err(core_error_to_response)?;
    let dtos: Vec<crate::dto::DirectoryEntryDto> = entries.into_iter().map(crate::dto::DirectoryEntryDto::from).collect();
    Ok(Json(dtos))
}

#[derive(Deserialize)]
struct FileParams {
    path: String,
}

async fn file_metadata(
    Query(params): Query<FileParams>,
) -> Result<Json<crate::dto::DirectoryEntryDto>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, "File metadata requested");
    let entry = tokio::task::spawn_blocking(move || {
        crate::file_service::get_file_metadata(&params.path)
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "INTERNAL".to_string(),
                message: format!("Task join error: {e}"),
            }),
        )
    })?
    .map_err(core_error_to_response)?;
    Ok(Json(crate::dto::DirectoryEntryDto::from(entry)))
}

async fn download(
    Query(params): Query<FileParams>,
) -> Result<Response, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, "Download requested");

    let (canonical, mime) = tokio::task::spawn_blocking({
        let path = params.path.clone();
        move || crate::file_service::prepare_download(&path)
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "INTERNAL".to_string(),
                message: format!("Task join error: {e}"),
            }),
        )
    })?
    .map_err(core_error_to_response)?;

    let file = tokio::fs::File::open(&canonical).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "IO_ERROR".to_string(),
                message: format!("Failed to open file: {e}"),
            }),
        )
    })?;

    let file_len = file.metadata().await.map(|m| m.len()).unwrap_or(0);

    let file_name = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("download");

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, file_len)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{file_name}\""),
        )
        .body(body)
        .unwrap();

    Ok(response)
}

#[derive(Deserialize)]
struct ThumbnailParams {
    path: String,
    #[serde(default = "default_thumbnail_size")]
    max_size: u32,
}

fn default_thumbnail_size() -> u32 {
    256
}

async fn thumbnail(
    Query(params): Query<ThumbnailParams>,
) -> Result<Response, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, max_size = params.max_size, "Thumbnail requested");

    let bytes = tokio::task::spawn_blocking(move || {
        crate::file_service::generate_thumbnail(&params.path, params.max_size)
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "INTERNAL".to_string(),
                message: format!("Task join error: {e}"),
            }),
        )
    })?
    .map_err(core_error_to_response)?;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/jpeg")
        .header(header::CONTENT_LENGTH, bytes.len())
        .header(header::CACHE_CONTROL, "private, max-age=3600")
        .body(Body::from(bytes))
        .unwrap();

    Ok(response)
}

fn core_error_to_response(
    e: storageos_core::errors::CoreError,
) -> (StatusCode, Json<crate::dto::ErrorDto>) {
    use storageos_core::errors::ErrorKind;
    let status = match e.kind {
        ErrorKind::NotFound => StatusCode::NOT_FOUND,
        ErrorKind::PermissionDenied => StatusCode::FORBIDDEN,
        ErrorKind::InvalidArgument => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    let code = match e.kind {
        ErrorKind::NotFound => "NOT_FOUND",
        ErrorKind::PermissionDenied => "PERMISSION_DENIED",
        ErrorKind::InvalidArgument => "INVALID_ARGUMENT",
        _ => "IO_ERROR",
    };
    (
        status,
        Json(crate::dto::ErrorDto {
            code: code.to_string(),
            message: e.message,
        }),
    )
}

// --- WebSocket ---

async fn ws_upgrade(ws: WebSocketUpgrade) -> impl IntoResponse {
    tracing::info!("WebSocket connection requested");
    ws.on_upgrade(handle_ws)
}

async fn handle_ws(mut socket: WebSocket) {
    tracing::info!("WebSocket client connected");

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Close(_)) => {
                tracing::info!("WebSocket client sent close frame");
                break;
            }
            Ok(Message::Ping(data)) => {
                if socket.send(Message::Pong(data)).await.is_err() {
                    break;
                }
            }
            Ok(_) => {}
            Err(e) => {
                tracing::debug!(error = %e, "WebSocket receive error");
                break;
            }
        }
    }

    tracing::info!("WebSocket client disconnected");
}
