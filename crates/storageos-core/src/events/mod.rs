//! Event bus — internal pub/sub for decoupled communication between services.
//!
//! Future home of:
//!   - `bus.rs`       (EventBus: publish, subscribe, unsubscribe)
//!   - `types.rs`     (all event type definitions)
//!
//! The event bus is in-process (not networked). It decouples services
//! so that, e.g., the filesystem watcher can emit FileChanged events
//! without knowing who consumes them.
//!
//! Note: The desktop app's Rust events module
//! (apps/desktop/src-tauri/src/events/) defines Tauri-specific event
//! types. Those will be replaced by core events + a thin Tauri adapter
//! that forwards core events to Tauri's event system.

use serde::Serialize;

/// Event categories emitted by core services.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum CoreEvent {
    TransferProgress {
        transfer_id: String,
        progress: f64,
    },
    TransferCompleted {
        transfer_id: String,
    },
    TransferFailed {
        transfer_id: String,
        error: String,
    },
    SearchProgress {
        directories_scanned: u32,
        files_scanned: u32,
        matches_found: u32,
    },
    FileChanged {
        path: String,
        kind: FileChangeKind,
    },
    ProviderStatusChanged {
        provider_id: String,
        status: crate::models::ConnectorStatus,
    },
}

/// Kind of filesystem change.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FileChangeKind {
    Created,
    Modified,
    Deleted,
    Renamed,
}
