//! Configuration — Agent and application settings, constants, limits.

pub mod constants;

use serde::{Deserialize, Serialize};

/// Application-level configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub data_dir: String,
    pub log_dir: String,
    pub port: u16,
    pub log_level: LogLevel,
}

/// Log verbosity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            data_dir: String::new(),
            log_dir: String::new(),
            port: constants::DEFAULT_AGENT_PORT,
            log_level: LogLevel::Info,
        }
    }
}
