use serde::{Deserialize, Serialize};

/// Strongly typed account identifier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct AccountId(pub String);

impl AccountId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

/// Result of a file operation (create, rename, delete).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OperationResult {
    pub success: bool,
    pub path: String,
}

/// Progress snapshot emitted during search operations.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchSnapshot {
    pub directories_scanned: u32,
    pub files_scanned: u32,
    pub matches_found: u32,
}
