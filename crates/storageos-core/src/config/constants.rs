//! Application-wide constants and limits.

/// Default Agent IPC port.
pub const DEFAULT_AGENT_PORT: u16 = 19742;

/// Transfer engine: chunk size for buffered read/write (4 MB).
pub const TRANSFER_CHUNK_SIZE: usize = 4 * 1024 * 1024;

/// Transfer engine: minimum interval between progress events.
pub const TRANSFER_PROGRESS_INTERVAL_MS: u64 = 100;

/// Search: throttle interval for search progress events.
pub const SEARCH_PROGRESS_INTERVAL_MS: u64 = 250;

/// Clipboard: default expiration time (24 hours in seconds).
pub const CLIPBOARD_EXPIRY_SECS: u64 = 24 * 60 * 60;

/// Device presence: heartbeat interval (30 seconds).
pub const HEARTBEAT_INTERVAL_SECS: u64 = 30;

/// Device presence: consider offline after this many missed heartbeats.
pub const OFFLINE_THRESHOLD_MISSED: u32 = 3;

/// Application name used for data directories and window titles.
pub const APP_NAME: &str = "StorageOS";

/// Application identifier for OS-level registration.
pub const APP_IDENTIFIER: &str = "com.storageos.desktop";
