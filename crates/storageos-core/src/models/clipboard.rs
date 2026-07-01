use serde::{Deserialize, Serialize};

/// Action type for clipboard operations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClipboardAction {
    Copy,
    Cut,
}

/// A clipboard entry containing one or more item references.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClipboardEntry {
    pub id: ClipboardEntryId,
    pub source_device: super::DeviceId,
    pub action: ClipboardAction,
    pub items: Vec<super::EntryRef>,
    pub created_at: u64,
    pub expires_at: u64,
}

/// Strongly typed clipboard entry identifier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ClipboardEntryId(pub String);

impl ClipboardEntryId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}
