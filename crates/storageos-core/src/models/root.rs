use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// A navigable top-level container within a Provider.
///
/// Drive letters, mount points, S3 buckets, SharePoint libraries,
/// Google Shared Drives — these are all Roots.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Root {
    pub id: RootId,
    pub name: String,
    pub kind: RootKind,
    pub provider: super::ProviderId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capacity: Option<StorageCapacity>,
    pub metadata: RootMetadata,
}

/// Strongly typed root identifier. Holds the provider-native ID.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct RootId(pub String);

impl RootId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

impl From<String> for RootId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

/// Classification of a Root.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RootKind {
    Drive,
    Bucket,
    Library,
    SharedDrive,
    Volume,
    Mount,
    Container,
}

/// Capacity information for a Root.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct StorageCapacity {
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
}

/// Provider-specific metadata on a Root.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct RootMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_removable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_ready: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mount_point: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub custom: HashMap<String, String>,
}
