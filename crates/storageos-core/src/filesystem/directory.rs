use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use crate::errors::{CoreError, CoreResult};
use crate::models::{Entry, EntryId, EntryKind, EntryMetadata};

pub fn list_directory(path: &str) -> CoreResult<Vec<Entry>> {
    let dir = Path::new(path);

    if !dir.exists() {
        return Err(CoreError::not_found(format!(
            "Directory not found: {path}"
        )));
    }

    if !dir.is_dir() {
        return Err(CoreError::invalid_argument(format!(
            "Not a directory: {path}"
        )));
    }

    let read_dir = fs::read_dir(dir).map_err(|e| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            CoreError::permission_denied(format!("Access denied: {path}"))
        } else {
            CoreError::from(e)
        }
    })?;

    let mut entries = Vec::new();

    for result in read_dir {
        let dir_entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let metadata = match dir_entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let name = dir_entry.file_name().to_string_lossy().into_owned();
        let full_path = dir_entry.path().to_string_lossy().into_owned();
        let is_directory = metadata.is_dir();
        let size = if is_directory { 0 } else { metadata.len() };

        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        let created_at = metadata
            .created()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        // Reuse the metadata we already fetched instead of a second stat per
        // entry — that second syscall roughly doubled the cost of listing large
        // (and network) folders.
        let hidden = is_hidden_meta(&name, &metadata);
        let readonly = metadata.permissions().readonly();

        let extension = if is_directory {
            None
        } else {
            dir_entry
                .path()
                .extension()
                .map(|e| e.to_string_lossy().into_owned())
        };

        entries.push(Entry {
            id: EntryId::new(&full_path),
            name,
            path: full_path,
            kind: if is_directory { EntryKind::Folder } else { EntryKind::File },
            size,
            created_at,
            modified_at,
            metadata: EntryMetadata {
                hidden: Some(hidden),
                readonly: Some(readonly),
                extension,
                ..Default::default()
            },
        });
    }

    entries.sort_by(|a, b| {
        let a_dir = matches!(a.kind, EntryKind::Folder);
        let b_dir = matches!(b.kind, EntryKind::Folder);
        b_dir
            .cmp(&a_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[cfg(target_os = "windows")]
pub(crate) fn is_hidden(entry: &fs::DirEntry) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    entry
        .metadata()
        .map(|m| m.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0)
        .unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn is_hidden(entry: &fs::DirEntry) -> bool {
    entry
        .file_name()
        .to_string_lossy()
        .starts_with('.')
}

/// Hidden check that reuses already-fetched metadata (no extra stat syscall).
#[cfg(target_os = "windows")]
fn is_hidden_meta(_name: &str, metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
}

#[cfg(not(target_os = "windows"))]
fn is_hidden_meta(name: &str, _metadata: &fs::Metadata) -> bool {
    name.starts_with('.')
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn list_nonexistent_directory() {
        let result = list_directory("Z:\\nonexistent_path_12345");
        assert!(result.is_err());
    }

    #[test]
    fn list_directory_returns_sorted_entries() {
        let dir = std::env::temp_dir().join("storageos_test_list_dir");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("banana.txt"), "").unwrap();
        fs::write(dir.join("apple.txt"), "").unwrap();
        fs::create_dir(dir.join("zebra_folder")).unwrap();

        let entries = list_directory(dir.to_str().unwrap()).unwrap();

        assert_eq!(entries.len(), 3);
        assert!(matches!(entries[0].kind, EntryKind::Folder));
        assert_eq!(entries[0].name, "zebra_folder");
        assert_eq!(entries[1].name, "apple.txt");
        assert_eq!(entries[2].name, "banana.txt");

        let _ = fs::remove_dir_all(&dir);
    }
}
