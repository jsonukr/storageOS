use std::collections::VecDeque;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use crate::errors::{CoreError, CoreResult};
use crate::filesystem::directory::is_hidden;
use crate::models::{Entry, EntryId, EntryKind, EntryMetadata, SearchSnapshot};

/// BFS filename search across a directory tree.
///
/// Matches entries whose name contains `query` (case-insensitive).
/// Symlinks are skipped. Results are sorted folders-first, then
/// alphabetically by name.
///
/// `on_progress` is invoked after each matching entry and after each
/// directory is fully scanned — callers may throttle on their side.
pub fn search_directory(
    path: &str,
    query: &str,
    recursive: bool,
    on_progress: &dyn Fn(&SearchSnapshot),
) -> CoreResult<Vec<Entry>> {
    let root = Path::new(path);

    if !root.exists() {
        return Err(CoreError::not_found(format!(
            "Directory not found: {path}"
        )));
    }

    if !root.is_dir() {
        return Err(CoreError::invalid_argument(format!(
            "Not a directory: {path}"
        )));
    }

    if query.is_empty() {
        return Err(CoreError::invalid_argument(
            "Search query cannot be empty".to_string(),
        ));
    }

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    let mut dirs_scanned: u32 = 0;
    let mut files_scanned: u32 = 0;

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

            let hidden = is_hidden(&entry);
            let readonly = metadata.permissions().readonly();

            let extension = if is_directory {
                None
            } else {
                entry
                    .path()
                    .extension()
                    .map(|e| e.to_string_lossy().into_owned())
            };

            results.push(Entry {
                id: EntryId::new(&full_path),
                name,
                path: full_path,
                kind: if is_directory {
                    EntryKind::Folder
                } else {
                    EntryKind::File
                },
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

            on_progress(&SearchSnapshot {
                directories_scanned: dirs_scanned,
                files_scanned,
                matches_found: results.len() as u32,
            });
        }

        on_progress(&SearchSnapshot {
            directories_scanned: dirs_scanned,
            files_scanned,
            matches_found: results.len() as u32,
        });
    }

    results.sort_by(|a, b| {
        let a_dir = matches!(a.kind, EntryKind::Folder);
        let b_dir = matches!(b.kind, EntryKind::Folder);
        b_dir
            .cmp(&a_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    fn test_dir(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("storageos_search_{name}"))
    }

    fn setup_tree(base: &std::path::Path) {
        let _ = fs::remove_dir_all(base);
        fs::create_dir_all(base).unwrap();
        fs::write(base.join("report.txt"), "").unwrap();
        fs::write(base.join("readme.md"), "").unwrap();
        fs::write(base.join("image.png"), "").unwrap();
        fs::create_dir(base.join("Reports")).unwrap();
        fs::write(base.join("Reports").join("annual_report.txt"), "").unwrap();
        fs::write(base.join("Reports").join("budget.xlsx"), "").unwrap();
    }

    #[test]
    fn search_nonexistent_directory() {
        let result = search_directory(
            "Z:\\nonexistent_search_12345",
            "test",
            false,
            &|_| {},
        );
        assert!(result.is_err());
    }

    #[test]
    fn search_empty_query() {
        let dir = test_dir("empty_query");
        let _ = fs::create_dir_all(&dir);
        let result = search_directory(dir.to_str().unwrap(), "", false, &|_| {});
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn search_not_a_directory() {
        let dir = test_dir("not_a_dir");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("file.txt");
        fs::write(&file, "").unwrap();
        let result = search_directory(file.to_str().unwrap(), "test", false, &|_| {});
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn search_non_recursive_finds_only_top_level() {
        let dir = test_dir("non_recursive");
        setup_tree(&dir);

        let results = search_directory(dir.to_str().unwrap(), "report", false, &|_| {}).unwrap();

        let names: Vec<&str> = results.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"Reports"));
        assert!(names.contains(&"report.txt"));
        assert!(!names.contains(&"annual_report.txt"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn search_recursive_finds_nested() {
        let dir = test_dir("recursive");
        setup_tree(&dir);

        let results = search_directory(dir.to_str().unwrap(), "report", true, &|_| {}).unwrap();

        let names: Vec<&str> = results.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"Reports"));
        assert!(names.contains(&"report.txt"));
        assert!(names.contains(&"annual_report.txt"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn search_case_insensitive() {
        let dir = test_dir("case_insensitive");
        setup_tree(&dir);

        let results = search_directory(dir.to_str().unwrap(), "REPORT", true, &|_| {}).unwrap();

        let names: Vec<&str> = results.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"Reports"));
        assert!(names.contains(&"report.txt"));
        assert!(names.contains(&"annual_report.txt"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn search_results_sorted_folders_first() {
        let dir = test_dir("sorted");
        setup_tree(&dir);

        let results = search_directory(dir.to_str().unwrap(), "report", true, &|_| {}).unwrap();

        let first = &results[0];
        assert!(matches!(first.kind, EntryKind::Folder));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn search_progress_callback_invoked() {
        let dir = test_dir("progress");
        setup_tree(&dir);

        let call_count = AtomicU32::new(0);
        let _ = search_directory(dir.to_str().unwrap(), "report", false, &|_snapshot| {
            call_count.fetch_add(1, Ordering::Relaxed);
        })
        .unwrap();

        assert!(call_count.load(Ordering::Relaxed) > 0);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn search_no_matches_returns_empty() {
        let dir = test_dir("no_matches");
        setup_tree(&dir);

        let results =
            search_directory(dir.to_str().unwrap(), "zzz_no_match_zzz", false, &|_| {}).unwrap();
        assert!(results.is_empty());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn search_entry_has_correct_metadata() {
        let dir = test_dir("metadata");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("notes.txt"), "hello").unwrap();

        let results = search_directory(dir.to_str().unwrap(), "notes", false, &|_| {}).unwrap();

        assert_eq!(results.len(), 1);
        let entry = &results[0];
        assert_eq!(entry.name, "notes.txt");
        assert!(matches!(entry.kind, EntryKind::File));
        assert_eq!(entry.size, 5);
        assert_eq!(entry.metadata.extension.as_deref(), Some("txt"));
        assert!(entry.created_at.is_some());
        assert!(entry.modified_at.is_some());

        let _ = fs::remove_dir_all(&dir);
    }
}
