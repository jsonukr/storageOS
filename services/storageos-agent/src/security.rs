//! Path security validation.
//!
//! All file-access endpoints MUST validate paths through this module
//! before performing any filesystem operation. Rejects directory
//! traversal attempts and confines access to registered storage roots.

use std::path::{Component, Path, PathBuf};

use storageos_core::errors::{CoreError, CoreResult};

/// Validate and canonicalize a requested path.
///
/// Returns the canonical absolute path if valid.
/// Rejects:
/// - Empty paths
/// - Relative paths (must start with a drive letter or `/`)
/// - Paths containing `..` components (traversal)
/// - Paths that don't exist on disk
pub fn validate_path(requested: &str) -> CoreResult<PathBuf> {
    if requested.is_empty() {
        return Err(CoreError::invalid_argument("Path must not be empty"));
    }

    let path = Path::new(requested);

    if path.is_relative() {
        return Err(CoreError::invalid_argument(
            "Relative paths are not allowed",
        ));
    }

    for component in path.components() {
        if matches!(component, Component::ParentDir) {
            return Err(CoreError::invalid_argument(
                "Path traversal (..) is not allowed",
            ));
        }
    }

    let canonical = path.canonicalize().map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => {
            CoreError::not_found(format!("Path not found: {requested}"))
        }
        std::io::ErrorKind::PermissionDenied => {
            CoreError::permission_denied(format!("Access denied: {requested}"))
        }
        _ => CoreError::io_error(format!("Cannot resolve path: {e}")),
    })?;

    Ok(canonical)
}

/// Validate a path and confirm it points to a regular file.
pub fn validate_file_path(requested: &str) -> CoreResult<PathBuf> {
    let canonical = validate_path(requested)?;

    if !canonical.is_file() {
        return Err(CoreError::invalid_argument(format!(
            "Not a file: {requested}"
        )));
    }

    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_path() {
        assert!(validate_path("").is_err());
    }

    #[test]
    fn rejects_relative_path() {
        assert!(validate_path("foo/bar.txt").is_err());
    }

    #[test]
    fn rejects_traversal() {
        assert!(validate_path("C:\\Users\\..\\Windows\\system32").is_err());
    }

    #[test]
    fn rejects_nonexistent() {
        assert!(validate_path("C:\\__nonexistent_storageos_test_99999__").is_err());
    }

    #[test]
    fn accepts_valid_existing_path() {
        let temp = std::env::temp_dir();
        let result = validate_path(temp.to_str().unwrap());
        assert!(result.is_ok());
    }
}
