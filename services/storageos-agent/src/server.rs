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
use crate::pairing::PairingManager;
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
    pub pairing_manager: Arc<PairingManager>,
}

impl AppState {
    pub fn new(
        registry: Arc<DeviceRegistry>,
        device_id: String,
        public_key: String,
        fingerprint: String,
        relay_state: watch::Receiver<RelayState>,
        relay_handle: RelayHandle,
        pairing_manager: Arc<PairingManager>,
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
            pairing_manager,
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
        .route("/pair/session", get(get_pair_session).post(create_pair_session).delete(cancel_pair_session))
        .route("/pair/initiate", post(pair_initiate))
        .route("/pair/approve", post(pair_approve))
        .route("/pair/reject", post(pair_reject))
        .route("/pair/pending", get(pair_pending))
        .route("/pair/connect-code", post(pair_connect_code))
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

pub(crate) fn detect_lan_ip() -> String {
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

async fn pair_info(State(state): State<Arc<AppState>>) -> Response {
    let session = state.pairing_manager.create_session().await;
    let host = detect_lan_ip();
    let port = storageos_core::config::constants::DEFAULT_AGENT_PORT;
    let lan_hint = format!("{host}:{port}");

    let qr_payload = state.pairing_manager.generate_qr_payload(
        &session.pair_code,
        Some(lan_hint),
    );

    tracing::info!(
        device_id = %state.device_id,
        pair_code = %session.pair_code,
        "V2 pair info requested"
    );

    let json = serde_json::to_string(&qr_payload).unwrap_or_default();
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CACHE_CONTROL, "no-cache")
        .body(Body::from(json))
        .unwrap()
}

async fn pair_qr(State(state): State<Arc<AppState>>) -> Response {
    let session = state.pairing_manager.create_session().await;
    let host = detect_lan_ip();
    let port = storageos_core::config::constants::DEFAULT_AGENT_PORT;
    let lan_hint = format!("{host}:{port}");

    let qr_payload = state.pairing_manager.generate_qr_payload(
        &session.pair_code,
        Some(lan_hint),
    );
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

// --- Universal Pairing Session Endpoints ---

async fn create_pair_session(
    State(state): State<Arc<AppState>>,
) -> Json<crate::pairing::SessionStatus> {
    let session = state.pairing_manager.create_session().await;

    tracing::info!(
        session_id = %session.session_id,
        pair_code = %session.pair_code,
        "Pair session created"
    );

    let status = state.pairing_manager.get_session(&session.session_id).await
        .unwrap_or_else(|| crate::pairing::SessionStatus {
            session_id: session.session_id,
            pair_code: session.pair_code.clone(),
            pair_code_formatted: storageos_core::protocol::pairing::format_pair_code(&session.pair_code),
            state: crate::pairing::SessionState::AwaitingPeer,
            expires_in_secs: 300,
            peer: None,
        });

    Json(status)
}

async fn get_pair_session(
    State(state): State<Arc<AppState>>,
) -> Result<Json<crate::pairing::SessionStatus>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    state.pairing_manager.get_active_session().await
        .map(Json)
        .ok_or_else(|| (
            StatusCode::NOT_FOUND,
            Json(crate::dto::ErrorDto {
                code: "NOT_FOUND".to_string(),
                message: "No active pairing session".to_string(),
            }),
        ))
}

async fn cancel_pair_session(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    if let Some(session) = state.pairing_manager.get_active_session().await {
        state.pairing_manager.cancel_session(&session.session_id).await;
    }
    Json(serde_json::json!({"ok": true}))
}

async fn pair_initiate(
    State(state): State<Arc<AppState>>,
    Json(req): Json<crate::pairing::PairInitiateRequest>,
) -> Result<Json<crate::pairing::SessionStatus>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::info!(
        pair_code = %req.pair_code,
        device_id = %req.device_id,
        display_name = %req.display_name,
        "Pair initiation received"
    );

    state.pairing_manager.initiate_pair(&req).await
        .map(Json)
        .map_err(|e| (
            StatusCode::FORBIDDEN,
            Json(crate::dto::ErrorDto {
                code: "INVALID_PAIR_CODE".to_string(),
                message: e,
            }),
        ))
}

async fn pair_approve(
    State(state): State<Arc<AppState>>,
    Json(req): Json<crate::pairing::ApproveRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    let peer = state.pairing_manager.approve(&req.session_id).await
        .map_err(|e| (
            StatusCode::BAD_REQUEST,
            Json(crate::dto::ErrorDto {
                code: "APPROVAL_ERROR".to_string(),
                message: e,
            }),
        ))?;

    let friendly = if req.friendly_name.is_empty() {
        peer.display_name.clone()
    } else {
        req.friendly_name.clone()
    };

    let now = now_epoch();
    let host = detect_lan_ip();
    let port = storageos_core::config::constants::DEFAULT_AGENT_PORT;

    let device = crate::device_registry::DeviceRecord {
        device_id: peer.device_id.clone(),
        system_name: peer.display_name.clone(),
        friendly_name: friendly,
        device_type: peer.device_kind.clone(),
        platform: peer.platform.clone(),
        version: peer.version.clone(),
        address: String::new(),
        last_seen: now,
        paired_at: now,
        status: "online".to_string(),
        capabilities: "{}".to_string(),
        permissions: "{}".to_string(),
        public_key: peer.public_key.clone(),
        endpoints: Vec::new(),
        preferred_transport: "lan".to_string(),
        connection_state: "connected".to_string(),
        fingerprint: peer.fingerprint.clone(),
        last_verified: now,
        trust_status: "trusted".to_string(),
    };

    state.registry.register_device(&device).map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(crate::dto::ErrorDto {
            code: "REGISTRY_ERROR".to_string(),
            message: e,
        }),
    ))?;

    tracing::info!(
        device_id = %peer.device_id,
        display_name = %peer.display_name,
        "Pair approved and device registered"
    );

    let pair_complete = serde_json::json!({
        "source": state.device_id,
        "destination": peer.device_id,
        "kind": "request",
        "version": "1.0.0",
        "payload": {
            "type": "pair_complete",
            "device_id": state.device_id,
            "system_name": device_name(),
            "device_type": "desktop",
            "platform": storageos_core::platform::Platform::current().display_name(),
            "version": env!("CARGO_PKG_VERSION"),
            "address": format!("{host}:{port}"),
            "public_key": state.public_key,
            "fingerprint": state.fingerprint,
        }
    });

    if let Ok(json) = serde_json::to_string(&pair_complete) {
        let _ = state.relay_handle.send_raw(json);
        tracing::info!(peer_device = %peer.device_id, "pair_complete sent via relay");
    }

    Ok(Json(serde_json::json!({
        "ok": true,
        "device_id": state.device_id,
        "system_name": device_name(),
        "device_type": "desktop",
        "platform": storageos_core::platform::Platform::current().display_name(),
        "version": env!("CARGO_PKG_VERSION"),
        "address": format!("{host}:{port}"),
        "public_key": state.public_key,
        "fingerprint": state.fingerprint,
        "paired": true,
    })))
}

async fn pair_reject(
    State(state): State<Arc<AppState>>,
    Json(req): Json<crate::pairing::RejectRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    state.pairing_manager.reject(&req.session_id).await
        .map_err(|e| (
            StatusCode::BAD_REQUEST,
            Json(crate::dto::ErrorDto {
                code: "REJECT_ERROR".to_string(),
                message: e,
            }),
        ))?;

    tracing::info!(session_id = %req.session_id, "Pair rejected");
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn pair_pending(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<crate::pairing::SessionStatus>> {
    Json(state.pairing_manager.get_pending_requests().await)
}

// --- Cross-Network Pairing via Code ---

#[derive(Deserialize)]
struct ConnectCodeRequest {
    pair_code: String,
}

async fn pair_connect_code(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConnectCodeRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    let relay_url = state.pairing_manager.relay_url()
        .ok_or_else(|| (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(crate::dto::ErrorDto {
                code: "NO_RELAY".to_string(),
                message: "Relay not configured".to_string(),
            }),
        ))?;

    let http_url = relay_url
        .replace("ws://", "http://")
        .replace("wss://", "https://")
        .trim_end_matches("/ws")
        .to_string();

    let normalized = req.pair_code.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect::<String>();

    let client = reqwest::Client::new();
    let lookup_res = client
        .post(format!("{http_url}/pair/lookup"))
        .json(&serde_json::json!({"pair_code": normalized}))
        .send()
        .await
        .map_err(|e| (
            StatusCode::BAD_GATEWAY,
            Json(crate::dto::ErrorDto {
                code: "RELAY_ERROR".to_string(),
                message: format!("Relay lookup failed: {e}"),
            }),
        ))?;

    let lookup: serde_json::Value = lookup_res.json().await.map_err(|e| (
        StatusCode::BAD_GATEWAY,
        Json(crate::dto::ErrorDto {
            code: "RELAY_ERROR".to_string(),
            message: format!("Invalid relay response: {e}"),
        }),
    ))?;

    if !lookup.get("found").and_then(|v| v.as_bool()).unwrap_or(false) {
        return Err((
            StatusCode::NOT_FOUND,
            Json(crate::dto::ErrorDto {
                code: "CODE_NOT_FOUND".to_string(),
                message: "Invalid or expired pairing code".to_string(),
            }),
        ));
    }

    let remote_device_id = lookup.get("device_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let remote_name = lookup.get("display_name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let host = detect_lan_ip();
    let port = storageos_core::config::constants::DEFAULT_AGENT_PORT;

    let pair_initiate_payload = serde_json::json!({
        "type": "pair_initiate",
        "pair_code": normalized,
        "device_id": state.device_id,
        "display_name": device_name(),
        "device_kind": "desktop",
        "platform": storageos_core::platform::Platform::current().display_name(),
        "version": env!("CARGO_PKG_VERSION"),
        "public_key": state.public_key,
        "fingerprint": state.fingerprint,
        "address": format!("{host}:{port}"),
        "capabilities": ["browse", "transfer"],
    });

    let relay_msg = serde_json::json!({
        "source": state.device_id,
        "destination": remote_device_id,
        "kind": "request",
        "version": "1.0.0",
        "payload": pair_initiate_payload,
    });

    state.relay_handle.send_raw(serde_json::to_string(&relay_msg).unwrap_or_default())
        .map_err(|e| (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(crate::dto::ErrorDto {
                code: "RELAY_SEND_ERROR".to_string(),
                message: e,
            }),
        ))?;

    tracing::info!(
        remote_device = %remote_device_id,
        remote_name = %remote_name,
        "Pair initiate sent via relay"
    );

    Ok(Json(serde_json::json!({
        "ok": true,
        "remote_device_id": remote_device_id,
        "remote_name": remote_name,
        "method": "relay",
    })))
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
