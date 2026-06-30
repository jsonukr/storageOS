mod commands;
mod core;
mod errors;
mod events;

use crate::core::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::health,
            commands::version,
            commands::platform,
            commands::app_directories,
        ])
        .run(tauri::generate_context!())
        .expect("error while running StorageOS");
}
