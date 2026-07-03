//! Transfer engine — chunked file copy/move with progress, pause, resume, cancel.
//!
//! The engine is transport-independent. Consumers provide a progress
//! callback that receives `TransferSnapshot` events. The desktop app
//! bridges these to Tauri's event system; the Agent will bridge to
//! Named Pipe / HTTP responses; the CLI will print to stdout.

pub mod controller;
pub mod engine;

pub use controller::{get_signal, register, set_signal, unregister, SIGNAL_CANCEL, SIGNAL_PAUSED, SIGNAL_RUNNING};
pub use engine::{calculate_total_size, execute_transfer, get_free_space};

use crate::errors::CoreResult;
use crate::models::{TransferSnapshot, TransferStatus, TransferType};

/// Public API surface for the transfer engine.
///
/// Trait consumers can provide alternative implementations (e.g. for testing).
/// The free functions above are the default local-filesystem implementation.
pub trait TransferService {
    fn start_transfer(
        &self,
        source: &str,
        destination: &str,
        transfer_type: TransferType,
        overwrite: bool,
        new_name: Option<&str>,
    ) -> CoreResult<String>;

    fn pause(&self, transfer_id: &str) -> CoreResult<()>;
    fn resume(&self, transfer_id: &str) -> CoreResult<()>;
    fn cancel(&self, transfer_id: &str) -> CoreResult<()>;

    fn get_snapshot(&self, transfer_id: &str) -> CoreResult<TransferSnapshot>;
    fn get_status(&self, transfer_id: &str) -> CoreResult<TransferStatus>;
    fn list_active(&self) -> CoreResult<Vec<TransferSnapshot>>;
}
