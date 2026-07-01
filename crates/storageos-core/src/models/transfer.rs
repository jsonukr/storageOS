use serde::{Deserialize, Serialize};

/// Status of a transfer job.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Cancelled,
    Failed,
}

/// Type of transfer operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransferType {
    Copy,
    Move,
}

/// Point-in-time snapshot of a transfer's progress.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TransferSnapshot {
    pub transfer_id: String,
    pub status: TransferStatus,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub progress: f64,
    pub speed_bytes_per_second: f64,
    pub estimated_remaining_ms: u64,
    pub elapsed_ms: u64,
    pub error: Option<String>,
}
