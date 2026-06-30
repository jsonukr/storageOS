//! Platform information command.

use serde::Serialize;

use crate::errors::BridgeError;

#[derive(Serialize)]
pub struct PlatformResponse {
    os: &'static str,
    arch: &'static str,
    locale: Option<String>,
}

/// Get the current platform information.
#[tauri::command]
pub fn platform() -> Result<PlatformResponse, BridgeError> {
    Ok(PlatformResponse {
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        locale: get_system_locale(),
    })
}

/// Best-effort locale detection from environment variables.
fn get_system_locale() -> Option<String> {
    std::env::var("LANG")
        .or_else(|_| std::env::var("LC_ALL"))
        .or_else(|_| std::env::var("LC_MESSAGES"))
        .ok()
}
