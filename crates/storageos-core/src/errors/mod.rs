//! Unified error types for StorageOS.
//!
//! All core operations return `Result<T, CoreError>`.
//! Transport layers (Tauri IPC, HTTP, Named Pipe) map CoreError
//! to their own wire format.

use serde::Serialize;
use thiserror::Error;

/// Error categories shared across all StorageOS operations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorKind {
    NotFound,
    PermissionDenied,
    InvalidArgument,
    IoError,
    AlreadyExists,
    NotSupported,
    ProviderError,
    Timeout,
    Cancelled,
    Internal,
}

/// The core error type returned by all storageos-core operations.
#[derive(Debug, Clone, Error, Serialize)]
#[error("[{kind:?}] {message}")]
pub struct CoreError {
    pub kind: ErrorKind,
    pub message: String,
}

impl CoreError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::NotFound, message)
    }

    pub fn permission_denied(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::PermissionDenied, message)
    }

    pub fn invalid_argument(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::InvalidArgument, message)
    }

    pub fn io_error(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::IoError, message)
    }

    pub fn already_exists(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::AlreadyExists, message)
    }

    pub fn not_supported(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::NotSupported, message)
    }

    pub fn provider_error(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::ProviderError, message)
    }

    pub fn cancelled(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Cancelled, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Internal, message)
    }

    pub fn is_retryable(&self) -> bool {
        matches!(self.kind, ErrorKind::IoError | ErrorKind::Timeout)
    }
}

impl From<std::io::Error> for CoreError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => Self::not_found(err.to_string()),
            std::io::ErrorKind::PermissionDenied => Self::permission_denied(err.to_string()),
            std::io::ErrorKind::AlreadyExists => Self::already_exists(err.to_string()),
            std::io::ErrorKind::TimedOut => Self::new(ErrorKind::Timeout, err.to_string()),
            _ => Self::io_error(err.to_string()),
        }
    }
}

/// Alias for convenience.
pub type CoreResult<T> = Result<T, CoreError>;
