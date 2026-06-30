//! IPC command: filename search (async, non-blocking).

use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

use crate::errors::BridgeError;
use crate::events::SearchProgressPayload;
use crate::services::directory::DirectoryEntry;
use crate::services::search;

const PROGRESS_THROTTLE: Duration = Duration::from_millis(250);

#[tauri::command]
pub async fn search_directory(
    app: AppHandle,
    path: String,
    query: String,
    recursive: Option<bool>,
) -> Result<Vec<DirectoryEntry>, BridgeError> {
    let recursive = recursive.unwrap_or(false);

    tauri::async_runtime::spawn_blocking(move || {
        let mut last_emit = Instant::now().checked_sub(PROGRESS_THROTTLE).unwrap_or_else(Instant::now);

        let mut on_progress = |dirs: u64, files: u64, matches: u64| {
            let now = Instant::now();
            if now.duration_since(last_emit) >= PROGRESS_THROTTLE {
                let _ = app.emit("search:progress", SearchProgressPayload {
                    directories_scanned: dirs,
                    files_scanned: files,
                    matches_found: matches,
                });
                last_emit = now;
            }
        };

        search::search_directory(&path, &query, recursive, &mut on_progress)
    })
    .await
    .map_err(|e| BridgeError::internal(e.to_string()))?
}
