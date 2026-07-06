use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::extract::Multipart;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use storageos_core::platform::Platform;
use tokio_util::io::ReaderStream;
use tower_http::cors::{Any, CorsLayer};

use storageos_core::networking::RelayState;
use tokio::sync::watch;

use crate::device_registry::{DeviceRecord, DeviceRegistry};
use crate::relay_handle::RelayHandle;

pub struct AppState {
    started_at: Instant,
    pub registry: Arc<DeviceRegistry>,
    pub device_id: String,
    pub pairing_token: String,
    pub public_key: String,
    pub fingerprint: String,
    pub relay_state: watch::Receiver<RelayState>,
    pub relay_handle: RelayHandle,
}

impl AppState {
    pub fn new(
        registry: Arc<DeviceRegistry>,
        device_id: String,
        public_key: String,
        fingerprint: String,
        relay_state: watch::Receiver<RelayState>,
        relay_handle: RelayHandle,
    ) -> Self {
        let pairing_token = uuid::Uuid::new_v4().to_string();
        Self {
            started_at: Instant::now(),
            registry,
            device_id,
            pairing_token,
            public_key,
            fingerprint,
            relay_state,
            relay_handle,
        }
    }

    pub fn relay_state(&self) -> RelayState {
        *self.relay_state.borrow()
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
        .route("/mkdir", post(mkdir))
        .route("/rename", post(rename))
        .route("/entry", delete(delete_entry))
        .route("/upload", post(upload))
        .route("/ws", get(ws_upgrade))
        .route("/relay/roots", get(crate::relay_proxy::relay_roots))
        .route("/relay/directory", get(crate::relay_proxy::relay_directory))
        .route("/relay/mkdir", post(crate::relay_proxy::relay_mkdir))
        .route("/relay/rename", post(crate::relay_proxy::relay_rename))
        .route("/relay/entry", delete(crate::relay_proxy::relay_delete))
        .route("/relay/search", get(crate::relay_proxy::relay_search))
        .route("/relay/thumbnail", get(crate::relay_proxy::relay_thumbnail))
        .route("/relay/download", get(crate::relay_proxy::relay_download))
        .route("/relay/upload", post(crate::relay_proxy::relay_upload))
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
    relay_status: RelayState,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        uptime_secs: state.started_at.elapsed().as_secs(),
        version: env!("CARGO_PKG_VERSION"),
        platform: Platform::current().display_name().to_string(),
        device_id: state.device_id.clone(),
        relay_status: state.relay_state(),
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
    public_key: String,
    fingerprint: String,
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
        public_key: state.public_key.clone(),
        fingerprint: state.fingerprint.clone(),
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
        public_key: state.public_key.clone(),
        fingerprint: state.fingerprint.clone(),
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
    #[serde(default)]
    public_key: String,
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
    public_key: String,
    fingerprint: String,
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
        public_key: req.public_key.clone(),
        endpoints: Vec::new(),
        preferred_transport: "lan".to_string(),
        connection_state: "connected".to_string(),
        fingerprint: String::new(),
        last_verified: now,
        trust_status: "trusted".to_string(),
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
        has_public_key = !req.public_key.is_empty(),
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
        public_key: state.public_key.clone(),
        fingerprint: state.fingerprint.clone(),
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

// --- File Operations ---

#[derive(Deserialize)]
struct MkdirRequest {
    parent: String,
    name: String,
}

#[derive(Serialize)]
struct OperationResponse {
    success: bool,
    path: String,
}

async fn mkdir(
    Json(req): Json<MkdirRequest>,
) -> Result<Json<OperationResponse>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(parent = %req.parent, name = %req.name, "Create folder requested");
    let parent = req.parent;
    let name = req.name;
    let result = tokio::task::spawn_blocking(move || {
        storageos_core::filesystem::create_folder(&parent, &name)
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
    Ok(Json(OperationResponse {
        success: result.success,
        path: result.path,
    }))
}

#[derive(Deserialize)]
struct RenameEntryRequest {
    path: String,
    new_name: String,
}

async fn rename(
    Json(req): Json<RenameEntryRequest>,
) -> Result<Json<OperationResponse>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %req.path, new_name = %req.new_name, "Rename requested");
    let path = req.path;
    let new_name = req.new_name;
    let result = tokio::task::spawn_blocking(move || {
        storageos_core::filesystem::rename_item(&path, &new_name)
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
    Ok(Json(OperationResponse {
        success: result.success,
        path: result.path,
    }))
}

#[derive(Deserialize)]
struct DeleteParams {
    path: String,
}

async fn delete_entry(
    Query(params): Query<DeleteParams>,
) -> Result<Json<OperationResponse>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, "Delete requested");
    let path = params.path;
    let result = tokio::task::spawn_blocking(move || {
        storageos_core::filesystem::delete_item(&path)
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
    Ok(Json(OperationResponse {
        success: result.success,
        path: result.path,
    }))
}

#[derive(Deserialize)]
struct UploadParams {
    path: String,
}

async fn upload(
    Query(params): Query<UploadParams>,
    mut multipart: Multipart,
) -> Result<Json<OperationResponse>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, "Upload requested");

    let dest_dir = std::path::Path::new(&params.path);
    if !dest_dir.is_dir() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(crate::dto::ErrorDto {
                code: "INVALID_ARGUMENT".to_string(),
                message: format!("Destination is not a directory: {}", params.path),
            }),
        ));
    }

    let mut last_path = String::new();
    let mut total_written: u64 = 0;
    while let Some(mut field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(crate::dto::ErrorDto {
                code: "INVALID_ARGUMENT".to_string(),
                message: format!("Multipart error: {e}"),
            }),
        )
    })? {
        let file_name = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "upload".to_string());

        let dest_file = resolve_upload_name(dest_dir, &file_name);
        last_path = dest_file.to_string_lossy().into_owned();

        let mut out = tokio::fs::File::create(&dest_file).await.map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(crate::dto::ErrorDto {
                    code: "IO_ERROR".to_string(),
                    message: format!("Failed to create file: {e}"),
                }),
            )
        })?;

        let mut bytes_written: u64 = 0;
        while let Some(chunk) = field.chunk().await.map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(crate::dto::ErrorDto {
                    code: "IO_ERROR".to_string(),
                    message: format!("Failed to read upload data: {e}"),
                }),
            )
        })? {
            use tokio::io::AsyncWriteExt;
            out.write_all(&chunk).await.map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(crate::dto::ErrorDto {
                        code: "IO_ERROR".to_string(),
                        message: format!("Failed to write file: {e}"),
                    }),
                )
            })?;
            bytes_written += chunk.len() as u64;
        }

        total_written += bytes_written;
        tracing::info!(path = %last_path, size = bytes_written, "File uploaded");
    }

    Ok(Json(OperationResponse {
        success: true,
        path: last_path,
    }))
}

fn resolve_upload_name(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let stem = std::path::Path::new(name)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| name.to_string());
    let ext = std::path::Path::new(name)
        .extension()
        .map(|s| format!(".{}", s.to_string_lossy()))
        .unwrap_or_default();
    let mut counter = 1u32;
    loop {
        let new_name = format!("{stem} ({counter}){ext}");
        let path = dir.join(&new_name);
        if !path.exists() {
            return path;
        }
        counter += 1;
    }
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
