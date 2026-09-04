use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::errors::{CoreError, CoreResult};
use crate::models::{Entry, EntryId, EntryKind, EntryMetadata};

/// Upper bound on entries returned for a single directory. Enumerating names is
/// cheap even for huge folders, but stat-ing and serializing every entry is not
/// — so we sort names first and only fully load this many. Folders larger than
/// this return the first page (alphabetical, folders first); use search to
/// reach the rest. Chosen well above any normal folder.
const MAX_ENTRIES: usize = 10_000;

struct ShallowEntry {
    name: String,
    path: PathBuf,
    is_dir: bool,
}

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

    // Phase 1 — cheap enumerate: name + type only, no per-entry stat. On Windows
    // (and most Unix) DirEntry::file_type() needs no extra syscall, so even a
    // folder with hundreds of thousands of files enumerates quickly.
    let mut shallow: Vec<ShallowEntry> = Vec::new();
    for result in read_dir {
        let dir_entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        let is_dir = dir_entry
            .file_type()
            .map(|t| t.is_dir())
            .unwrap_or(false);
        shallow.push(ShallowEntry {
            name: dir_entry.file_name().to_string_lossy().into_owned(),
            path: dir_entry.path(),
            is_dir,
        });
    }

    shallow.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    // Cap after sorting so the returned page is deterministic (folders first,
    // then alphabetical) rather than an arbitrary slice.
    shallow.truncate(MAX_ENTRIES);

    // Phase 2 — stat only the (capped) page for size / dates / attributes.
    let mut entries = Vec::with_capacity(shallow.len());
    for s in shallow {
        let metadata = match fs::symlink_metadata(&s.path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let size = if s.is_dir { 0 } else { metadata.len() };

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

        let hidden = is_hidden_meta(&s.name, &metadata);
        let readonly = metadata.permissions().readonly();

        let extension = if s.is_dir {
            None
        } else {
            s.path.extension().map(|e| e.to_string_lossy().into_owned())
        };

        entries.push(Entry {
            id: EntryId::new(s.path.to_string_lossy().as_ref()),
            name: s.name,
            path: s.path.to_string_lossy().into_owned(),
            kind: if s.is_dir { EntryKind::Folder } else { EntryKind::File },
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
