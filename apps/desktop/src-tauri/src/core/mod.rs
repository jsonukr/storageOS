//! Core application state and shared utilities.
//!
//! This module will grow as the app gains features (storage registry,
//! transfer engine, etc.). For now it holds the startup timestamp
//! used by the health command.

use std::time::Instant;

/// Shared application state managed by Tauri.
pub struct AppState {
    /// When the app started (for uptime calculation).
    pub started_at: Instant,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            started_at: Instant::now(),
        }
    }

    /// Milliseconds since the app started.
    pub fn uptime_ms(&self) -> u64 {
        self.started_at.elapsed().as_millis() as u64
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
