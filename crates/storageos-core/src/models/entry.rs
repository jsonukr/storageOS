use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// The universal storage item. Files and folders are both Entries.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Entry {
    pub id: EntryId,
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    pub size: u64,
    pub created_at: Option<u64>,
    pub modified_at: Option<u64>,
    pub metadata: EntryMetadata,
}

/// Strongly typed entry identifier. Holds the provider-native ID.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct EntryId(pub String);

impl EntryId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

impl From<String> for EntryId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

/// Whether this entry is a file or folder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Folder,
}

/// Provider-specific metadata attached to an Entry.
///
/// Uses optional fields rather than provider-specific enums so that
/// UIs can display metadata from any provider uniformly.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct EntryMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hidden: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub readonly: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archive: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shared: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_class: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub custom: HashMap<String, String>,
}

/// A cross-device, cross-provider pointer to an Entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct EntryRef {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_id: Option<super::DeviceId>,
    pub provider_id: super::ProviderId,
    pub root_id: super::RootId,
    pub path: String,
}
