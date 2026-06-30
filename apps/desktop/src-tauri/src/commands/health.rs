//! Health check command.

use serde::Serialize;
use tauri::State;

use crate::core::AppState;
use crate::errors::BridgeError;

#[derive(Serialize)]
pub struct HealthResponse {
    status: &'static str,
    uptime_ms: u64,
}

/// Check that the Rust backend is alive and responsive.
#[tauri::command]
pub fn health(state: State<'_, AppState>) -> Result<HealthResponse, BridgeError> {
    Ok(HealthResponse {
        status: "ok",
        uptime_ms: state.uptime_ms(),
    })
}
