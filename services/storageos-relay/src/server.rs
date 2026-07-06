use std::sync::Arc;
use std::time::Instant;

use axum::extract::ws::WebSocketUpgrade;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::routing::get;
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
        .route("/devices", get(list_devices))
        .route("/ws", get(ws_upgrade))
        .layer(cors)
        .with_state(state)
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
