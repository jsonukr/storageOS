//! Filename search for local filesystems.

use std::collections::VecDeque;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use crate::errors::BridgeError;
use crate::services::directory::DirectoryEntry;

pub fn search_directory(
    path: &str,
    query: &str,
    recursive: bool,
    on_progress: &mut dyn FnMut(u64, u64, u64),
) -> Result<Vec<DirectoryEntry>, BridgeError> {
    let root = Path::new(path);

    if !root.exists() {
        return Err(BridgeError::not_found(format!(
            "Directory not found: {path}"
        )));
    }

    if !root.is_dir() {
        return Err(BridgeError::invalid_argument(format!(
            "Not a directory: {path}"
        )));
    }

    if query.is_empty() {
        return Err(BridgeError::invalid_argument(
            "Search query cannot be empty".to_string(),
        ));
    }

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    let mut dirs_scanned: u64 = 0;
    let mut files_scanned: u64 = 0;

    let mut queue = VecDeque::new();
    queue.push_back(root.to_path_buf());

    while let Some(dir) = queue.pop_front() {
        let read_dir = match fs::read_dir(&dir) {
            Ok(rd) => rd,
            Err(_) => continue,
        };

        dirs_scanned += 1;

        for result in read_dir {
            let entry = match result {
                Ok(e) => e,
                Err(_) => continue,
            };

            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };

            if metadata.is_symlink() {
                continue;
            }

            let is_directory = metadata.is_dir();

            if !is_directory {
                files_scanned += 1;
            }

            if recursive && is_directory {
                queue.push_back(entry.path());
            }

            let name = entry.file_name().to_string_lossy().into_owned();

            if !name.to_lowercase().contains(&query_lower) {
                continue;
            }

            let full_path = entry.path().to_string_lossy().into_owned();
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

            results.push(DirectoryEntry {
                name,
                full_path,
                is_directory,
                size,
                last_modified,
                hidden,
                readonly,
                extension,
            });

            on_progress(dirs_scanned, files_scanned, results.len() as u64);
        }

        on_progress(dirs_scanned, files_scanned, results.len() as u64);
    }

    results.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(results)
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
