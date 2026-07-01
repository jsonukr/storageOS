//! Search adapter — delegates to storageos_core, maps Entry → DirectoryEntry.

use storageos_core::models::SearchSnapshot;

use crate::errors::BridgeError;
use crate::services::directory::DirectoryEntry;

pub fn search_directory(
    path: &str,
    query: &str,
    recursive: bool,
    on_progress: &dyn Fn(&SearchSnapshot),
) -> Result<Vec<DirectoryEntry>, BridgeError> {
    let entries = storageos_core::search::search_directory(path, query, recursive, on_progress)?;
    Ok(entries.into_iter().map(DirectoryEntry::from).collect())
}
