//! Bridge error types.
//!
//! Every Rust command returns `Result<T, BridgeError>`.
//! Errors are serialized to JSON and mapped to `BridgeError` on the TS side.

use serde::Serialize;

/// Error codes matching the TypeScript `BridgeErrorCode` type.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BridgeErrorCode {
    Internal,
    NotFound,
    PermissionDenied,
    InvalidArgument,
    IoError,
    Timeout,
}

/// Structured error returned by all Tauri commands.
#[derive(Debug, Clone, Serialize)]
pub struct BridgeError {
    pub code: BridgeErrorCode,
    pub message: String,
}

impl BridgeError {
    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            code: BridgeErrorCode::Internal,
            message: message.into(),
        }
    }

    pub fn io_error(message: impl Into<String>) -> Self {
        Self {
            code: BridgeErrorCode::IoError,
            message: message.into(),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            code: BridgeErrorCode::NotFound,
            message: message.into(),
        }
    }
}

impl std::fmt::Display for BridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{:?}] {}", self.code, self.message)
    }
}

impl std::error::Error for BridgeError {}

impl From<std::io::Error> for BridgeError {
    fn from(err: std::io::Error) -> Self {
        Self::io_error(err.to_string())
    }
}

/// Serialize `BridgeError` as JSON for the Tauri IPC boundary.
impl From<BridgeError> for tauri::ipc::InvokeError {
    fn from(err: BridgeError) -> Self {
        tauri::ipc::InvokeError::from_serde_json(
            serde_json::to_value(err).unwrap_or_else(|_| {
                serde_json::json!({
                    "code": "INTERNAL",
                    "message": "Failed to serialize error"
                })
            }),
        )
    }
}
