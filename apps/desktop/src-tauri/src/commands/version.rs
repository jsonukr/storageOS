//! Version information command.

use serde::Serialize;

use crate::errors::BridgeError;

#[derive(Serialize)]
pub struct VersionResponse {
    app_version: String,
    tauri_version: String,
}

/// Get the app and Tauri framework versions.
#[tauri::command]
pub fn version() -> Result<VersionResponse, BridgeError> {
    Ok(VersionResponse {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
    })
}
