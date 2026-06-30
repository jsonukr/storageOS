//! IPC command: list directory contents.

use crate::errors::BridgeError;
use crate::services::directory::{list_directory, DirectoryEntry};

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirectoryEntry>, BridgeError> {
    list_directory(&path)
}
