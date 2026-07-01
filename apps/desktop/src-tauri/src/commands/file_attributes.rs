//! IPC commands: get/set file attributes (hidden, readonly).

use crate::errors::BridgeError;
use crate::services::file_attributes::{self, FileAttributes};

#[tauri::command]
pub fn get_attributes(path: String) -> Result<FileAttributes, BridgeError> {
    file_attributes::get_attributes(&path)
}

#[tauri::command]
pub fn set_hidden(path: String, hidden: bool) -> Result<FileAttributes, BridgeError> {
    file_attributes::set_hidden(&path, hidden)
}

#[tauri::command]
pub fn set_readonly(path: String, readonly: bool) -> Result<FileAttributes, BridgeError> {
    file_attributes::set_readonly(&path, readonly)
}
