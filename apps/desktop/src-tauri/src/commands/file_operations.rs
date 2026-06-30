//! IPC commands: create folder, rename, delete.

use crate::errors::BridgeError;
use crate::services::file_operations::{self, OperationResult};

#[tauri::command]
pub fn create_folder(parent: String, name: String) -> Result<OperationResult, BridgeError> {
    file_operations::create_folder(&parent, &name)
}

#[tauri::command]
pub fn rename_item(path: String, new_name: String) -> Result<OperationResult, BridgeError> {
    file_operations::rename_item(&path, &new_name)
}

#[tauri::command]
pub fn delete_item(path: String) -> Result<OperationResult, BridgeError> {
    file_operations::delete_item(&path)
}
