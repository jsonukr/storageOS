use std::sync::Arc;
use std::time::Instant;

use axum::extract::ws::WebSocketUpgrade;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Serialize;
use tower_http::cors::{Any, CorsLayer};

use crate::config::RelayConfig;
use crate::handler;
use crate::registry::{ConnectionRegistry, DevicePresence};

pub struct RelayState {
    pub registry: Arc<ConnectionRegistry>,
    pub config: RelayConfig,
    pub started_at: Instant,
}

pub fn router(state: Arc<RelayState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health))
        .route("/version", get(version))
        .route("/devices", get(list_devices))
        .route("/pair/lookup", post(pair_code_lookup))
        .route("/ws", get(ws_upgrade))
        .layer(cors)
        .with_state(state)
}

/// Update manifest served to clients, embedded at compile time.
/// To publish an update: bump `version.json` and redeploy the relay.
const VERSION_MANIFEST: &str = include_str!("../version.json");

/// `GET /version` — returns the app update manifest (latest versions +
/// download URL). Clients compare it to their own version and, if newer,
/// prompt the user to download the latest build from the website.
async fn version() -> impl IntoResponse {
    ([("content-type", "application/json")], VERSION_MANIFEST)
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    uptime_secs: u64,
    version: &'static str,
    connected_devices: usize,
}

async fn health(State(state): State<Arc<RelayState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        uptime_secs: state.started_at.elapsed().as_secs(),
        version: env!("CARGO_PKG_VERSION"),
        connected_devices: state.registry.connected_count().await,
    })
}

async fn list_devices(
    State(state): State<Arc<RelayState>>,
) -> Json<Vec<DevicePresence>> {
    Json(state.registry.list_devices().await)
}

#[derive(serde::Deserialize)]
struct PairLookupRequest {
    pair_code: String,
}

#[derive(Serialize)]
struct PairLookupResponse {
    found: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    device_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    fingerprint: Option<String>,
}

async fn pair_code_lookup(
    State(state): State<Arc<RelayState>>,
    Json(req): Json<PairLookupRequest>,
) -> Json<PairLookupResponse> {
    let normalized = req.pair_code.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect::<String>();

    match state.registry.resolve_pair_code(&normalized).await {
        Some(entry) => Json(PairLookupResponse {
            found: true,
            device_id: Some(entry.device_id),
            display_name: Some(entry.display_name),
            fingerprint: Some(entry.fingerprint),
        }),
        None => Json(PairLookupResponse {
            found: false,
            device_id: None,
            display_name: None,
            fingerprint: None,
        }),
    }
}

async fn ws_upgrade(
    State(state): State<Arc<RelayState>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let registry = state.registry.clone();
    let heartbeat_timeout = state.config.heartbeat_timeout_secs;

    tracing::debug!("WebSocket upgrade requested");
    ws.on_upgrade(move |socket| {
        handler::handle_connection(socket, registry, heartbeat_timeout)
    })
}
