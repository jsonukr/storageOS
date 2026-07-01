//! Clipboard — Agent-owned file clipboard with history and cross-device sync.
//!
//! Future home of:
//!   - `service.rs`  (clipboard state management, history, expiration)
//!   - `sync.rs`     (cross-device clipboard synchronization — Phase 2+)
//!
//! Note: The current desktop clipboard lives in TypeScript
//! (apps/desktop/src/services/clipboard/). That will migrate here
//! so the Agent owns clipboard state and it persists across UI restarts.

use crate::errors::CoreResult;
use crate::models::{ClipboardAction, EntryRef};

/// Public API surface for the clipboard.
///
/// Not yet implemented — this documents the target interface.
pub trait ClipboardService {
    fn copy(&self, items: Vec<EntryRef>) -> CoreResult<()>;
    fn cut(&self, items: Vec<EntryRef>) -> CoreResult<()>;
    fn paste(&self, destination: &str) -> CoreResult<Vec<String>>;
    fn clear(&self) -> CoreResult<()>;
    fn get_items(&self) -> CoreResult<Vec<EntryRef>>;
    fn get_action(&self) -> CoreResult<Option<ClipboardAction>>;
    fn has_items(&self) -> bool;
}
