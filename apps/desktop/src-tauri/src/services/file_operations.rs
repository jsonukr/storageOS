//! File operations adapter.
//!
//! Thin wrappers that delegate to `storageos_core::filesystem::operations`
//! and convert `CoreError` → `BridgeError` via the existing `From` impl.

use crate::errors::BridgeError;
pub use storageos_core::models::OperationResult;

pub fn create_folder(parent: &str, name: &str) -> Result<OperationResult, BridgeError> {
    Ok(storageos_core::filesystem::create_folder(parent, name)?)
}

pub fn rename_item(path: &str, new_name: &str) -> Result<OperationResult, BridgeError> {
    Ok(storageos_core::filesystem::rename_item(path, new_name)?)
}

pub fn delete_item(path: &str) -> Result<OperationResult, BridgeError> {
    Ok(storageos_core::filesystem::delete_item(path)?)
}

pub fn copy_item(
    source: &str,
    destination_dir: &str,
    overwrite: bool,
    new_name: Option<&str>,
) -> Result<OperationResult, BridgeError> {
    Ok(storageos_core::filesystem::copy_item(
        source,
        destination_dir,
        overwrite,
        new_name,
    )?)
}

pub fn move_item(
    source: &str,
    destination_dir: &str,
    overwrite: bool,
    new_name: Option<&str>,
) -> Result<OperationResult, BridgeError> {
    Ok(storageos_core::filesystem::move_item(
        source,
        destination_dir,
        overwrite,
        new_name,
    )?)
}
