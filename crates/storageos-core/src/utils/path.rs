/// Extract the parent path from a path string.
///
/// Returns None if the path is already a root (e.g. `C:\`).
/// Handles both Windows (`\`) and Unix (`/`) separators.
pub fn parent_path(path: &str) -> Option<String> {
    let normalized = path.trim_end_matches(|c| c == '\\' || c == '/');

    // Windows drive root: "C:" or "C:\"
    if normalized.len() <= 3 && normalized.contains(':') {
        return None;
    }

    // Unix root
    if normalized == "/" || normalized.is_empty() {
        return None;
    }

    let sep_pos = normalized.rfind(|c: char| c == '\\' || c == '/');
    sep_pos.map(|i| {
        let parent = &normalized[..i];
        // Windows drive letter without trailing slash → add it back
        if parent.len() == 2 && parent.as_bytes()[1] == b':' {
            format!("{}\\", parent)
        } else if parent.is_empty() {
            "/".to_string()
        } else {
            parent.to_string()
        }
    })
}

/// Returns true if the path is a filesystem root.
///
/// Examples: `C:\`, `D:\`, `/`, `C:`
pub fn is_root_path(path: &str) -> bool {
    let trimmed = path.trim_end_matches(|c| c == '\\' || c == '/');
    trimmed == "/"
        || trimmed.is_empty()
        || (trimmed.len() == 2 && trimmed.as_bytes()[1] == b':')
}

/// Extract the file extension from a path.
///
/// Returns an empty string for directories or files with no extension.
pub fn file_extension(path: &str) -> &str {
    let name = path
        .rsplit(|c: char| c == '\\' || c == '/')
        .next()
        .unwrap_or(path);
    match name.rfind('.') {
        Some(i) if i > 0 && i < name.len() - 1 => &name[i + 1..],
        _ => "",
    }
}

/// Normalize a path to use the platform-native separator.
///
/// On Windows, converts `/` to `\`. On other platforms, converts `\` to `/`.
pub fn normalize_separators(path: &str) -> String {
    if cfg!(windows) {
        path.replace('/', "\\")
    } else {
        path.replace('\\', "/")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parent_of_file() {
        assert_eq!(parent_path("C:\\Users\\test\\file.txt"), Some("C:\\Users\\test".into()));
    }

    #[test]
    fn parent_of_drive_root() {
        assert_eq!(parent_path("C:\\"), None);
        assert_eq!(parent_path("D:"), None);
    }

    #[test]
    fn parent_of_one_level() {
        assert_eq!(parent_path("C:\\Users"), Some("C:\\".into()));
    }

    #[test]
    fn unix_parent() {
        assert_eq!(parent_path("/home/user/file"), Some("/home/user".into()));
        assert_eq!(parent_path("/home"), Some("/".into()));
        assert_eq!(parent_path("/"), None);
    }

    #[test]
    fn root_detection() {
        assert!(is_root_path("C:\\"));
        assert!(is_root_path("D:"));
        assert!(is_root_path("/"));
        assert!(!is_root_path("C:\\Users"));
        assert!(!is_root_path("/home"));
    }

    #[test]
    fn extensions() {
        assert_eq!(file_extension("document.txt"), "txt");
        assert_eq!(file_extension("archive.tar.gz"), "gz");
        assert_eq!(file_extension("no_extension"), "");
        assert_eq!(file_extension(".hidden"), "");
        assert_eq!(file_extension("C:\\path\\to\\file.rs"), "rs");
    }
}
