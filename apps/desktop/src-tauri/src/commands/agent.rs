//! Tauri command: launch the StorageOS Agent process.

use crate::errors::BridgeError;
use crate::services::agent;
use serde::Serialize;
use storageos_core::config::constants::DEFAULT_AGENT_PORT;

#[derive(Serialize)]
pub struct AgentLaunchResult {
    pub launched: bool,
    pub binary_path: Option<String>,
    pub port: u16,
}

#[tauri::command]
pub fn launch_agent() -> Result<AgentLaunchResult, BridgeError> {
    let binary = agent::find_agent_binary().ok_or_else(|| {
        BridgeError::not_found("StorageOS Agent binary not found")
    })?;

    let port = DEFAULT_AGENT_PORT;
    agent::launch_agent(&binary, port).map_err(BridgeError::internal)?;

    Ok(AgentLaunchResult {
        launched: true,
        binary_path: Some(binary.to_string_lossy().into_owned()),
        port,
    })
}

#[tauri::command]
pub fn agent_port() -> u16 {
    DEFAULT_AGENT_PORT
}
