use crate::errors::BridgeError;
use crate::services::remote_transfer_worker;

#[tauri::command]
pub async fn remote_download(
    app: tauri::AppHandle,
    transfer_id: String,
    url: String,
    dest_path: String,
) -> Result<(), BridgeError> {
    tauri::async_runtime::spawn_blocking(move || {
        remote_transfer_worker::execute_remote_download(&app, &transfer_id, &url, &dest_path);
    });
    Ok(())
}

#[tauri::command]
pub async fn remote_upload(
    app: tauri::AppHandle,
    transfer_id: String,
    source_path: String,
    remote_upload_url: String,
) -> Result<(), BridgeError> {
    tauri::async_runtime::spawn_blocking(move || {
        remote_transfer_worker::execute_remote_upload(
            &app,
            &transfer_id,
            &source_path,
            &remote_upload_url,
        );
    });
    Ok(())
}
