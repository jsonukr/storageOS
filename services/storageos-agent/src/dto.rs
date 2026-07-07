//! Data Transfer Objects for Agent API responses.
//!
//! These DTOs serialize to the exact same JSON shape that the Desktop
//! TypeScript frontend expects (`LocalDriveInfo` and `DirectoryEntry`).
//! This means the UI can consume Agent responses without any changes.

use serde::{Deserialize, Serialize};
use storageos_core::models::{Entry, EntryKind, Root};

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalDriveDto {
    pub letter: String,
    pub label: String,
    pub drive_type: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub file_system: String,
    pub is_removable: bool,
    pub is_ready: bool,
}

impl From<Root> for LocalDriveDto {
    fn from(r: Root) -> Self {
        let letter = r
            .metadata
            .custom
            .get("drive_letter")
            .cloned()
            .unwrap_or_else(|| r.id.0.clone());

        let label = r
            .metadata
            .custom
            .get("volume_label")
            .cloned()
            .unwrap_or_default();

        let drive_type = r
            .metadata
            .custom
            .get("windows_drive_type")
            .cloned()
            .unwrap_or_else(|| "unknown".to_string());

        let (total_bytes, free_bytes, used_bytes) = r
            .capacity
            .map(|c| (c.total_bytes, c.free_bytes, c.used_bytes))
            .unwrap_or((0, 0, 0));

        Self {
            letter,
            label,
            drive_type,
            total_bytes,
            free_bytes,
            used_bytes,
            file_system: r.metadata.file_system.unwrap_or_default(),
            is_removable: r.metadata.is_removable.unwrap_or(false),
            is_ready: r.metadata.is_ready.unwrap_or(false),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryEntryDto {
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

impl From<Entry> for DirectoryEntryDto {
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorDto {
    pub code: String,
    pub message: String,
}
