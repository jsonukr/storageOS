//! Transfer worker adapter.
//!
//! `TransferProgressPayload` serializes with camelCase for TypeScript.
//! The business logic lives in `storageos_core::transfer::engine`.

use serde::Serialize;
use storageos_core::models::{TransferSnapshot, TransferType};
use tauri::{AppHandle, Emitter};

pub use storageos_core::transfer::{set_signal, SIGNAL_CANCEL, SIGNAL_PAUSED, SIGNAL_RUNNING};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferProgressPayload {
    transfer_id: String,
    status: String,
    bytes_transferred: u64,
    total_bytes: u64,
    progress: f64,
    speed_bytes_per_second: f64,
    estimated_remaining_ms: u64,
    elapsed_ms: u64,
    error: Option<String>,
}

impl From<&TransferSnapshot> for TransferProgressPayload {
    fn from(s: &TransferSnapshot) -> Self {
        Self {
            transfer_id: s.transfer_id.clone(),
            status: serde_json::to_value(&s.status)
                .ok()
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_else(|| format!("{:?}", s.status).to_lowercase()),
            bytes_transferred: s.bytes_transferred,
            total_bytes: s.total_bytes,
            progress: s.progress,
            speed_bytes_per_second: s.speed_bytes_per_second,
            estimated_remaining_ms: s.estimated_remaining_ms,
            elapsed_ms: s.elapsed_ms,
            error: s.error.clone(),
        }
    }
}

pub fn execute_transfer(
    app: &AppHandle,
    transfer_id: &str,
    source: &str,
    destination_dir: &str,
    transfer_type: &str,
    overwrite: bool,
    new_name: Option<&str>,
) {
    let tt = match transfer_type {
        "move" => TransferType::Move,
        _ => TransferType::Copy,
    };

    let app = app.clone();
    storageos_core::transfer::execute_transfer(
        transfer_id,
        source,
        destination_dir,
        tt,
        overwrite,
        new_name,
        &|snapshot| {
            let payload = TransferProgressPayload::from(snapshot);
            let _ = app.emit("transfer:progress", payload);
        },
    );
}
