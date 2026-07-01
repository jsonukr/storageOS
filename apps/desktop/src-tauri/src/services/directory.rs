//! Directory listing adapter.
//!
//! `DirectoryEntry` serializes with the field names the TypeScript
//! frontend expects (is_directory, full_path, last_modified, date_created).
//! The business logic lives in `storageos_core::filesystem::list_directory`.

use serde::Serialize;

use crate::errors::BridgeError;
use storageos_core::models::{Entry, EntryId, EntryKind, EntryMetadata};

#[derive(Debug, Clone, Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub full_path: String,
    pub is_directory: bool,
    pub size: u64,
    pub last_modified: u64,
    pub date_created: u64,
    pub hidden: bool,
    pub readonly: bool,
    pub extension: String,
}

impl From<Entry> for DirectoryEntry {
    fn from(e: Entry) -> Self {
        Self {
            name: e.name,
            full_path: e.path,
            is_directory: matches!(e.kind, EntryKind::Folder),
            size: e.size,
            last_modified: e.modified_at.unwrap_or(0),
            date_created: e.created_at.unwrap_or(0),
            hidden: e.metadata.hidden.unwrap_or(false),
            readonly: e.metadata.readonly.unwrap_or(false),
            extension: e.metadata.extension.unwrap_or_default(),
        }
    }
}

impl From<DirectoryEntry> for Entry {
    fn from(d: DirectoryEntry) -> Self {
        Self {
            id: EntryId::new(&d.full_path),
            name: d.name,
            path: d.full_path,
            kind: if d.is_directory { EntryKind::Folder } else { EntryKind::File },
            size: d.size,
            created_at: Some(d.date_created),
            modified_at: Some(d.last_modified),
            metadata: EntryMetadata {
                hidden: Some(d.hidden),
                readonly: Some(d.readonly),
                extension: if d.extension.is_empty() { None } else { Some(d.extension) },
                ..Default::default()
            },
        }
    }
}

pub fn list_directory(path: &str) -> Result<Vec<DirectoryEntry>, BridgeError> {
    let entries = storageos_core::filesystem::list_directory(path)?;
    Ok(entries.into_iter().map(DirectoryEntry::from).collect())
}
