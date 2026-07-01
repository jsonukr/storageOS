mod commands;
mod core;
mod errors;
mod events;
mod services;

use crate::core::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::health::health,
            commands::version::version,
            commands::platform::platform,
            commands::app_directories::app_directories,
            commands::list_drives::list_drives,
            commands::list_directory::list_dir,
            commands::file_operations::create_folder,
            commands::file_operations::rename_item,
            commands::file_operations::delete_item,
            commands::file_operations::copy_item,
            commands::file_operations::move_item,
            commands::search::search_directory,
            commands::transfer::start_transfer,
            commands::transfer::pause_transfer,
            commands::transfer::resume_transfer,
            commands::transfer::cancel_transfer,
            commands::file_attributes::get_attributes,
            commands::file_attributes::set_hidden,
            commands::file_attributes::set_readonly,
            commands::thumbnail::get_thumbnail,
            commands::agent::launch_agent,
            commands::agent::agent_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running StorageOS");
}
