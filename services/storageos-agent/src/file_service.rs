//! File access service — metadata, streaming download, thumbnails.
//!
//! All filesystem logic is delegated to storageos-core.
//! This module adds path validation and thumbnail generation.

use std::io::Cursor;
use std::path::Path;
use std::time::UNIX_EPOCH;

use storageos_core::errors::{CoreError, CoreResult};
use storageos_core::models::{Entry, EntryId, EntryKind, EntryMetadata};

use crate::security;

/// Get metadata for a single file or folder.
pub fn get_file_metadata(requested_path: &str) -> CoreResult<Entry> {
    let canonical = security::validate_path(requested_path)?;
    let meta = std::fs::metadata(&canonical)?;

    let name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();

    let full_path = canonical.to_string_lossy().into_owned();
    let is_dir = meta.is_dir();
    let size = if is_dir { 0 } else { meta.len() };

    let modified_at = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    let created_at = meta
        .created()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    let extension = if is_dir {
        None
    } else {
        canonical
            .extension()
            .map(|e| e.to_string_lossy().into_owned())
    };

    let attrs = storageos_core::filesystem::get_attributes(requested_path).unwrap_or_default();

    Ok(Entry {
        id: EntryId::new(&full_path),
        name,
        path: full_path,
        kind: if is_dir {
            EntryKind::Folder
        } else {
            EntryKind::File
        },
        size,
        created_at,
        modified_at,
        metadata: EntryMetadata {
            hidden: attrs.hidden,
            readonly: attrs.readonly,
            system: attrs.system,
            archive: attrs.archive,
            extension,
            ..Default::default()
        },
    })
}

/// Validate a file path for download and return the canonical path + mime type.
pub fn prepare_download(requested_path: &str) -> CoreResult<(std::path::PathBuf, String)> {
    let canonical = security::validate_file_path(requested_path)?;

    let mime = mime_guess::from_path(&canonical)
        .first_or_octet_stream()
        .to_string();

    Ok((canonical, mime))
}

const THUMBNAIL_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "bmp",
];

/// Check if a file extension supports thumbnail generation.
pub fn supports_thumbnail(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| THUMBNAIL_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Generate a JPEG thumbnail for an image file.
/// Returns the raw JPEG bytes.
pub fn generate_thumbnail(requested_path: &str, max_size: u32) -> CoreResult<Vec<u8>> {
    let canonical = security::validate_file_path(requested_path)?;

    if !supports_thumbnail(&canonical) {
        return Err(CoreError::invalid_argument(format!(
            "Unsupported image format: {}",
            canonical
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("unknown")
        )));
    }

    let img = image::open(&canonical).map_err(|e| {
        CoreError::io_error(format!("Failed to open image: {e}"))
    })?;

    let thumb = img.thumbnail(max_size, max_size);

    let mut buf = Vec::with_capacity(16_384);
    thumb
        .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Jpeg)
        .map_err(|e| CoreError::io_error(format!("Failed to encode thumbnail: {e}")))?;

    Ok(buf)
}
