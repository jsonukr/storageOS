//! Tauri event types for backend-to-frontend communication.
//!
//! Events are emitted by the Rust backend and consumed by the
//! TypeScript `onBridgeEvent` listener.

use serde::Serialize;

/// Event names matching the TypeScript `BridgeEventName` type.
pub mod names {
    pub const BRIDGE_READY: &str = "bridge:ready";
    pub const BRIDGE_ERROR: &str = "bridge:error";
}

/// Payload for the `bridge:ready` event.
#[derive(Debug, Clone, Serialize)]
pub struct BridgeReadyPayload {
    pub timestamp: u64,
}

/// Payload for the `bridge:error` event.
#[derive(Debug, Clone, Serialize)]
pub struct BridgeErrorEventPayload {
    pub code: String,
    pub message: String,
}
