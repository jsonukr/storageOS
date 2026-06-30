//! Directory listing for local filesystems.

use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use crate::errors::BridgeError;

#[derive(Debug, Clone, Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub full_path: String,
    pub is_directory: bool,
    pub size: u64,
    pub last_modified: u64,
    pub hidden: bool,
    pub readonly: bool,
    pub extension: String,
}

pub fn list_directory(path: &str) -> Result<Vec<DirectoryEntry>, BridgeError> {
    let dir = Path::new(path);

    if !dir.exists() {
        return Err(BridgeError::not_found(format!(
            "Directory not found: {path}"
        )));
    }

    if !dir.is_dir() {
        return Err(BridgeError::invalid_argument(format!(
            "Not a directory: {path}"
        )));
    }

    let read_dir = fs::read_dir(dir).map_err(|e| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            BridgeError::permission_denied(format!("Access denied: {path}"))
        } else {
            BridgeError::from(e)
        }
    })?;

    let mut entries = Vec::new();

    for result in read_dir {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let name = entry.file_name().to_string_lossy().into_owned();
        let full_path = entry.path().to_string_lossy().into_owned();
        let is_directory = metadata.is_dir();
        let size = if is_directory { 0 } else { metadata.len() };

        let last_modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let hidden = is_hidden(&entry);
        let readonly = metadata.permissions().readonly();

        let extension = if is_directory {
            String::new()
        } else {
            entry
                .path()
                .extension()
                .map(|e| e.to_string_lossy().into_owned())
                .unwrap_or_default()
        };

        entries.push(DirectoryEntry {
            name,
            full_path,
            is_directory,
            size,
            last_modified,
            hidden,
            readonly,
            extension,
        });
    }

    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[cfg(target_os = "windows")]
fn is_hidden(entry: &fs::DirEntry) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    entry
        .metadata()
        .map(|m| m.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0)
        .unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
fn is_hidden(entry: &fs::DirEntry) -> bool {
    entry
        .file_name()
        .to_string_lossy()
        .starts_with('.')
}
