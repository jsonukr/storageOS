use crate::errors::BridgeError;
use crate::services::thumbnail;

#[tauri::command]
pub async fn get_thumbnail(path: String, max_size: u32) -> Result<String, BridgeError> {
    tauri::async_runtime::spawn_blocking(move || {
        thumbnail::generate_thumbnail(&path, max_size)
    })
    .await
    .map_err(|e| BridgeError::internal(format!("Thumbnail task failed: {e}")))?
}
