//! Filesystem operations — directory listing, file CRUD, drive detection, attributes.
//!
//! Platform-specific code (Windows APIs, Unix permissions) is isolated
//! behind `#[cfg(target_os)]` gates within each sub-module.

pub mod attributes;
pub mod directory;
pub mod drives;
pub mod operations;

pub use attributes::{get_attributes, set_hidden, set_readonly};
pub use directory::list_directory;
pub use drives::list_roots;
pub use operations::{copy_item, create_folder, delete_item, move_item, rename_item};

use crate::errors::CoreResult;
use crate::models::{Entry, EntryMetadata, OperationResult, Root};

/// Public API surface for filesystem operations.
///
/// Trait consumers can mock the filesystem for testing.
/// The free functions above are the default implementation.
pub trait FileSystemService {
    fn list_directory(&self, path: &str) -> CoreResult<Vec<Entry>>;
    fn create_folder(&self, parent: &str, name: &str) -> CoreResult<OperationResult>;
    fn rename_item(&self, path: &str, new_name: &str) -> CoreResult<OperationResult>;
    fn delete_item(&self, path: &str) -> CoreResult<OperationResult>;
    fn list_roots(&self) -> CoreResult<Vec<Root>>;
    fn get_metadata(&self, path: &str) -> CoreResult<EntryMetadata>;
    fn set_hidden(&self, path: &str, hidden: bool) -> CoreResult<EntryMetadata>;
    fn set_readonly(&self, path: &str, readonly: bool) -> CoreResult<EntryMetadata>;
}
