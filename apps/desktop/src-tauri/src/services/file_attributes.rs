//! File attribute adapter.
//!
//! `FileAttributes` serializes with flat boolean fields for TypeScript.
//! The business logic lives in `storageos_core::filesystem::attributes`.

use serde::Serialize;

use crate::errors::BridgeError;
use storageos_core::models::EntryMetadata;

#[derive(Debug, Clone, Serialize)]
pub struct FileAttributes {
    pub hidden: bool,
    pub readonly: bool,
    pub system: bool,
    pub archive: bool,
}

impl From<EntryMetadata> for FileAttributes {
    fn from(m: EntryMetadata) -> Self {
        Self {
            hidden: m.hidden.unwrap_or(false),
            readonly: m.readonly.unwrap_or(false),
            system: m.system.unwrap_or(false),
            archive: m.archive.unwrap_or(false),
        }
    }
}

impl From<FileAttributes> for EntryMetadata {
    fn from(a: FileAttributes) -> Self {
        Self {
            hidden: Some(a.hidden),
            readonly: Some(a.readonly),
            system: Some(a.system),
            archive: Some(a.archive),
            ..Default::default()
        }
    }
}

pub fn get_attributes(path: &str) -> Result<FileAttributes, BridgeError> {
    let meta = storageos_core::filesystem::get_attributes(path)?;
    Ok(FileAttributes::from(meta))
}

pub fn set_hidden(path: &str, hidden: bool) -> Result<FileAttributes, BridgeError> {
    let meta = storageos_core::filesystem::set_hidden(path, hidden)?;
    Ok(FileAttributes::from(meta))
}

pub fn set_readonly(path: &str, readonly: bool) -> Result<FileAttributes, BridgeError> {
    let meta = storageos_core::filesystem::set_readonly(path, readonly)?;
    Ok(FileAttributes::from(meta))
}
