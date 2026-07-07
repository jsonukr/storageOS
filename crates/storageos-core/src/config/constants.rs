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

/// Default Relay server port.
pub const DEFAULT_RELAY_PORT: u16 = 19800;

/// Default Relay URL for development (Render hosted).
pub const DEFAULT_RELAY_URL: &str = "wss://storageos.onrender.com/ws";

/// Default Relay URL for local development (self-hosted).
pub const DEFAULT_RELAY_URL_LOCAL: &str = "ws://localhost:19800/ws";

/// Default Relay URL for production (placeholder).
pub const DEFAULT_RELAY_URL_PROD: &str = "wss://relay.storageos.app/ws";

/// Relay: heartbeat interval (30 seconds).
pub const RELAY_HEARTBEAT_INTERVAL_SECS: u64 = 30;

/// Relay: connection timeout (90 seconds — Render free tier cold starts take 30-60s).
pub const RELAY_CONNECTION_TIMEOUT_SECS: u64 = 90;

/// Relay: reconnect backoff steps in seconds.
pub const RELAY_RECONNECT_DELAYS: &[u64] = &[1, 2, 5, 10, 30, 60];

/// Relay server: heartbeat timeout — disconnect clients after this many seconds without activity.
pub const RELAY_HEARTBEAT_TIMEOUT_SECS: u64 = 90;

/// Relay server: maximum concurrent connections.
pub const RELAY_MAX_CONNECTIONS: usize = 1000;
