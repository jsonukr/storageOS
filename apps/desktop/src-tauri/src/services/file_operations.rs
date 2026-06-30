//! File operations: create folder, rename, delete.
//!
//! NOTE: delete_item performs permanent deletion.
//! Future improvement: use Windows Shell API (IFileOperation) to move to Recycle Bin.
//! The function signature is designed so the switch is transparent to callers.

use serde::Serialize;
use std::fs;
use std::path::Path;

use crate::errors::BridgeError;

#[derive(Debug, Clone, Serialize)]
pub struct OperationResult {
    pub success: bool,
    pub path: String,
}

pub fn create_folder(parent: &str, name: &str) -> Result<OperationResult, BridgeError> {
    if name.is_empty() {
        return Err(BridgeError::invalid_argument("Folder name cannot be empty"));
    }

    if name.contains(['\\', '/', ':', '*', '?', '"', '<', '>', '|']) {
        return Err(BridgeError::invalid_argument(
            "Folder name contains invalid characters",
        ));
    }

    let parent_path = Path::new(parent);
    if !parent_path.exists() {
        return Err(BridgeError::not_found(format!(
            "Parent directory not found: {parent}"
        )));
    }
    if !parent_path.is_dir() {
        return Err(BridgeError::invalid_argument(format!(
            "Not a directory: {parent}"
        )));
    }

    let new_path = parent_path.join(name);
    if new_path.exists() {
        return Err(BridgeError::invalid_argument(format!(
            "A file or folder named \"{name}\" already exists"
        )));
    }

    fs::create_dir(&new_path).map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => {
            BridgeError::permission_denied(format!("Access denied: {parent}"))
        }
        _ => BridgeError::from(e),
    })?;

    Ok(OperationResult {
        success: true,
        path: new_path.to_string_lossy().into_owned(),
    })
}

pub fn rename_item(path: &str, new_name: &str) -> Result<OperationResult, BridgeError> {
    if new_name.is_empty() {
        return Err(BridgeError::invalid_argument("Name cannot be empty"));
    }

    if new_name.contains(['\\', '/', ':', '*', '?', '"', '<', '>', '|']) {
        return Err(BridgeError::invalid_argument(
            "Name contains invalid characters",
        ));
    }

    let source = Path::new(path);
    if !source.exists() {
        return Err(BridgeError::not_found(format!("Item not found: {path}")));
    }

    let parent = source
        .parent()
        .ok_or_else(|| BridgeError::invalid_argument("Cannot rename a root path"))?;

    let dest = parent.join(new_name);
    if dest.exists() {
        return Err(BridgeError::invalid_argument(format!(
            "A file or folder named \"{new_name}\" already exists"
        )));
    }

    fs::rename(source, &dest).map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => {
            BridgeError::permission_denied(format!("Access denied: {path}"))
        }
        _ => BridgeError::from(e),
    })?;

    Ok(OperationResult {
        success: true,
        path: dest.to_string_lossy().into_owned(),
    })
}

/// Permanently deletes a file or folder.
/// Future: replace with IFileOperation::DeleteItem for Recycle Bin support.
pub fn delete_item(path: &str) -> Result<OperationResult, BridgeError> {
    let target = Path::new(path);
    if !target.exists() {
        return Err(BridgeError::not_found(format!("Item not found: {path}")));
    }

    let result = if target.is_dir() {
        fs::remove_dir_all(target)
    } else {
        fs::remove_file(target)
    };

    result.map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => {
            BridgeError::permission_denied(format!("Access denied: {path}"))
        }
        _ => BridgeError::from(e),
    })?;

    Ok(OperationResult {
        success: true,
        path: path.to_string(),
    })
}
