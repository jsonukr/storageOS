//! Application directories command.

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::errors::BridgeError;

#[derive(Serialize)]
pub struct AppDirectoriesResponse {
    data_dir: String,
    config_dir: String,
    cache_dir: String,
    log_dir: String,
}

/// Get application-specific directories (data, config, cache, log).
///
/// These are resolved by Tauri based on the platform conventions:
/// - Windows: `%APPDATA%\com.storageos.desktop\...`
/// - macOS: `~/Library/Application Support/com.storageos.desktop/...`
/// - Linux: `~/.local/share/com.storageos.desktop/...`
#[tauri::command]
pub fn app_directories(app: AppHandle) -> Result<AppDirectoriesResponse, BridgeError> {
    let path = app.path();

    let data_dir = path
        .app_data_dir()
        .map_err(|e| BridgeError::io_error(format!("Failed to resolve data dir: {e}")))?;

    let config_dir = path
        .app_config_dir()
        .map_err(|e| BridgeError::io_error(format!("Failed to resolve config dir: {e}")))?;

    let cache_dir = path
        .app_cache_dir()
        .map_err(|e| BridgeError::io_error(format!("Failed to resolve cache dir: {e}")))?;

    let log_dir = path
        .app_log_dir()
        .map_err(|e| BridgeError::io_error(format!("Failed to resolve log dir: {e}")))?;

    Ok(AppDirectoriesResponse {
        data_dir: data_dir.to_string_lossy().into_owned(),
        config_dir: config_dir.to_string_lossy().into_owned(),
        cache_dir: cache_dir.to_string_lossy().into_owned(),
        log_dir: log_dir.to_string_lossy().into_owned(),
    })
}
