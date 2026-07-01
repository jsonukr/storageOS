use crate::errors::BridgeError;
use crate::services::transfer_worker;

#[tauri::command]
pub async fn start_transfer(
    app: tauri::AppHandle,
    transfer_id: String,
    source: String,
    destination_dir: String,
    transfer_type: String,
    overwrite: Option<bool>,
    new_name: Option<String>,
) -> Result<(), BridgeError> {
    tauri::async_runtime::spawn_blocking(move || {
        transfer_worker::execute_transfer(
            &app,
            &transfer_id,
            &source,
            &destination_dir,
            &transfer_type,
            overwrite.unwrap_or(false),
            new_name.as_deref(),
        );
    });
    Ok(())
}

#[tauri::command]
pub async fn pause_transfer(transfer_id: String) -> Result<bool, BridgeError> {
    Ok(transfer_worker::set_signal(&transfer_id, transfer_worker::SIGNAL_PAUSED))
}

#[tauri::command]
pub async fn resume_transfer(transfer_id: String) -> Result<bool, BridgeError> {
    Ok(transfer_worker::set_signal(&transfer_id, transfer_worker::SIGNAL_RUNNING))
}

#[tauri::command]
pub async fn cancel_transfer(transfer_id: String) -> Result<bool, BridgeError> {
    Ok(transfer_worker::set_signal(&transfer_id, transfer_worker::SIGNAL_CANCEL))
}
