//! Storage providers — the connector interface and registry.
//!
//! Every storage backend (local filesystem, Google Drive, OneDrive,
//! Dropbox, SMB, SFTP) implements the `StorageConnector` trait.
//! The provider registry manages active connections.
//!
//! Future home of:
//!   - `connector.rs`    (StorageConnector trait definition)
//!   - `registry.rs`     (provider lifecycle: connect, disconnect, status)
//!   - `capabilities.rs` (ConnectorCapabilities flags)
//!
//! Built-in connector implementations live in separate crates
//! under `connectors/` (e.g., connectors/local/, connectors/google-drive/).

use crate::errors::CoreResult;
use crate::models::{ConnectorCapabilities, ConnectorStatus, Entry};

/// The universal storage connector interface.
///
/// Not yet implemented — this documents the target trait from
/// the Agent architecture (docs/architecture/Agent.md, Section 14).
pub trait StorageConnector: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn capabilities(&self) -> ConnectorCapabilities;
    fn status(&self) -> ConnectorStatus;

    fn list(&self, path: &str) -> CoreResult<Vec<Entry>>;
    fn create_folder(&self, path: &str, name: &str) -> CoreResult<()>;
    fn delete(&self, path: &str) -> CoreResult<()>;
    fn rename(&self, path: &str, new_name: &str) -> CoreResult<()>;
}
