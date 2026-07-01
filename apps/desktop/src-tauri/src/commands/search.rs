//! IPC command: filename search (async, non-blocking).

use std::cell::Cell;
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
        let last_emit = Cell::new(
            Instant::now()
                .checked_sub(PROGRESS_THROTTLE)
                .unwrap_or_else(Instant::now),
        );

        search::search_directory(&path, &query, recursive, &|snapshot| {
            let now = Instant::now();
            if now.duration_since(last_emit.get()) >= PROGRESS_THROTTLE {
                let _ = app.emit(
                    "search:progress",
                    SearchProgressPayload {
                        directories_scanned: snapshot.directories_scanned as u64,
                        files_scanned: snapshot.files_scanned as u64,
                        matches_found: snapshot.matches_found as u64,
                    },
                );
                last_emit.set(now);
            }
        })
    })
    .await
    .map_err(|e| BridgeError::internal(e.to_string()))?
}
