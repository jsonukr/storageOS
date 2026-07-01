use std::fs;
use std::path::Path;

use crate::errors::{CoreError, CoreResult};
use crate::models::OperationResult;
use crate::utils::validate_filename;

pub fn create_folder(parent: &str, name: &str) -> CoreResult<OperationResult> {
    if let Some(reason) = validate_filename(name) {
        return Err(CoreError::invalid_argument(reason));
    }

    let parent_path = Path::new(parent);
    if !parent_path.exists() {
        return Err(CoreError::not_found(format!(
            "Parent directory not found: {parent}"
        )));
    }
    if !parent_path.is_dir() {
        return Err(CoreError::invalid_argument(format!(
            "Not a directory: {parent}"
        )));
    }

    let new_path = parent_path.join(name);
    if new_path.exists() {
        return Err(CoreError::already_exists(format!(
            "A file or folder named \"{name}\" already exists"
        )));
    }

    fs::create_dir(&new_path).map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => {
            CoreError::permission_denied(format!("Access denied: {parent}"))
        }
        _ => CoreError::from(e),
    })?;

    Ok(OperationResult {
        success: true,
        path: new_path.to_string_lossy().into_owned(),
    })
}

pub fn rename_item(path: &str, new_name: &str) -> CoreResult<OperationResult> {
    if let Some(reason) = validate_filename(new_name) {
        return Err(CoreError::invalid_argument(reason));
    }

    let source = Path::new(path);
    if !source.exists() {
        return Err(CoreError::not_found(format!("Item not found: {path}")));
    }

    let parent = source
        .parent()
        .ok_or_else(|| CoreError::invalid_argument("Cannot rename a root path"))?;

    let dest = parent.join(new_name);
    if dest.exists() {
        return Err(CoreError::already_exists(format!(
            "A file or folder named \"{new_name}\" already exists"
        )));
    }

    fs::rename(source, &dest).map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => {
            CoreError::permission_denied(format!("Access denied: {path}"))
        }
        _ => CoreError::from(e),
    })?;

    Ok(OperationResult {
        success: true,
        path: dest.to_string_lossy().into_owned(),
    })
}

pub fn delete_item(path: &str) -> CoreResult<OperationResult> {
    let target = Path::new(path);
    if !target.exists() {
        return Err(CoreError::not_found(format!("Item not found: {path}")));
    }

    let result = if target.is_dir() {
        fs::remove_dir_all(target)
    } else {
        fs::remove_file(target)
    };

    result.map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => {
            CoreError::permission_denied(format!("Access denied: {path}"))
        }
        _ => CoreError::from(e),
    })?;

    Ok(OperationResult {
        success: true,
        path: path.to_string(),
    })
}

pub fn copy_item(
    source: &str,
    destination_dir: &str,
    overwrite: bool,
    new_name: Option<&str>,
) -> CoreResult<OperationResult> {
    let src = Path::new(source);
    if !src.exists() {
        return Err(CoreError::not_found(format!("Source not found: {source}")));
    }

    let dest_dir = Path::new(destination_dir);
    if !dest_dir.is_dir() {
        return Err(CoreError::not_found(format!(
            "Destination directory not found: {destination_dir}"
        )));
    }

    let file_name = match new_name {
        Some(name) => std::ffi::OsString::from(name),
        None => src
            .file_name()
            .ok_or_else(|| CoreError::invalid_argument("Cannot determine file name"))?
            .to_owned(),
    };

    let dest = dest_dir.join(&file_name);
    if dest.exists() {
        if overwrite {
            if dest.is_dir() {
                fs::remove_dir_all(&dest)?;
            } else {
                fs::remove_file(&dest)?;
            }
        } else {
            return Err(CoreError::already_exists(format!(
                "\"{}\" already exists in the destination",
                file_name.to_string_lossy()
            )));
        }
    }

    if src.is_dir() {
        copy_dir_recursive(src, &dest)?;
    } else {
        fs::copy(src, &dest).map_err(|e| match e.kind() {
            std::io::ErrorKind::PermissionDenied => {
                CoreError::permission_denied(format!("Access denied: {source}"))
            }
            _ => CoreError::from(e),
        })?;
    }

    Ok(OperationResult {
        success: true,
        path: dest.to_string_lossy().into_owned(),
    })
}

pub fn move_item(
    source: &str,
    destination_dir: &str,
    overwrite: bool,
    new_name: Option<&str>,
) -> CoreResult<OperationResult> {
    let src = Path::new(source);
    if !src.exists() {
        return Err(CoreError::not_found(format!("Source not found: {source}")));
    }

    let dest_dir = Path::new(destination_dir);
    if !dest_dir.is_dir() {
        return Err(CoreError::not_found(format!(
            "Destination directory not found: {destination_dir}"
        )));
    }

    let file_name = match new_name {
        Some(name) => std::ffi::OsString::from(name),
        None => src
            .file_name()
            .ok_or_else(|| CoreError::invalid_argument("Cannot determine file name"))?
            .to_owned(),
    };

    let dest = dest_dir.join(&file_name);
    if dest.exists() {
        if overwrite {
            if dest.is_dir() {
                fs::remove_dir_all(&dest)?;
            } else {
                fs::remove_file(&dest)?;
            }
        } else {
            return Err(CoreError::already_exists(format!(
                "\"{}\" already exists in the destination",
                file_name.to_string_lossy()
            )));
        }
    }

    fs::rename(src, &dest).map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => {
            CoreError::permission_denied(format!("Access denied: {source}"))
        }
        _ => CoreError::from(e),
    })?;

    Ok(OperationResult {
        success: true,
        path: dest.to_string_lossy().into_owned(),
    })
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> CoreResult<()> {
    fs::create_dir(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let entry_dest = dest.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&entry.path(), &entry_dest)?;
        } else {
            fs::copy(entry.path(), &entry_dest)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn test_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("storageos_test_{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn create_and_delete_folder() {
        let dir = test_dir("create_delete");
        let result = create_folder(dir.to_str().unwrap(), "new_folder").unwrap();
        assert!(result.success);
        assert!(Path::new(&result.path).is_dir());

        let del = delete_item(&result.path).unwrap();
        assert!(del.success);
        assert!(!Path::new(&result.path).exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn create_folder_invalid_name() {
        let dir = test_dir("invalid_name");
        let result = create_folder(dir.to_str().unwrap(), "bad?name");
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rename_item_works() {
        let dir = test_dir("rename");
        let file = dir.join("original.txt");
        fs::write(&file, "content").unwrap();

        let result = rename_item(file.to_str().unwrap(), "renamed.txt").unwrap();
        assert!(result.success);
        assert!(!file.exists());
        assert!(dir.join("renamed.txt").exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn copy_item_works() {
        let src_dir = test_dir("copy_src");
        let dest_dir = test_dir("copy_dest");
        let file = src_dir.join("file.txt");
        fs::write(&file, "hello").unwrap();

        let result = copy_item(
            file.to_str().unwrap(),
            dest_dir.to_str().unwrap(),
            false,
            None,
        )
        .unwrap();
        assert!(result.success);
        assert!(file.exists());
        assert!(dest_dir.join("file.txt").exists());

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn move_item_works() {
        let src_dir = test_dir("move_src");
        let dest_dir = test_dir("move_dest");
        let file = src_dir.join("moveme.txt");
        fs::write(&file, "data").unwrap();

        let result = move_item(
            file.to_str().unwrap(),
            dest_dir.to_str().unwrap(),
            false,
            None,
        )
        .unwrap();
        assert!(result.success);
        assert!(!file.exists());
        assert!(dest_dir.join("moveme.txt").exists());

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }
}
