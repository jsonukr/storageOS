//! IPC command: list local drives.

use crate::errors::BridgeError;
use crate::services::drives::{list_local_drives, LocalDrive};

#[tauri::command]
pub fn list_drives() -> Result<Vec<LocalDrive>, BridgeError> {
    list_local_drives()
}
