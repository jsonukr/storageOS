use serde::{Deserialize, Serialize};

/// Strongly typed provider identifier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ProviderId(pub String);

impl ProviderId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

/// Capabilities a storage connector may support.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConnectorCapabilities {
    pub can_list: bool,
    pub can_search: bool,
    pub can_read: bool,
    pub can_write: bool,
    pub can_delete: bool,
    pub can_rename: bool,
    pub can_copy: bool,
    pub can_move: bool,
    pub can_create_folder: bool,
    pub can_watch: bool,
    pub can_get_thumbnail: bool,
}

/// Connection status of a provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectorStatus {
    Connected,
    Disconnected,
    AuthRequired,
    Error,
}
