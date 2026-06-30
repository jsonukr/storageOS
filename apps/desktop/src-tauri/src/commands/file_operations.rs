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

#[tauri::command]
pub fn copy_item(
    source: String,
    destination_dir: String,
    overwrite: Option<bool>,
    new_name: Option<String>,
) -> Result<OperationResult, BridgeError> {
    file_operations::copy_item(&source, &destination_dir, overwrite.unwrap_or(false), new_name.as_deref())
}

#[tauri::command]
pub fn move_item(
    source: String,
    destination_dir: String,
    overwrite: Option<bool>,
    new_name: Option<String>,
) -> Result<OperationResult, BridgeError> {
    file_operations::move_item(&source, &destination_dir, overwrite.unwrap_or(false), new_name.as_deref())
}
