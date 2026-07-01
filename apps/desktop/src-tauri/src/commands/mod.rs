//! Tauri IPC commands.
//!
//! Each submodule exposes one `#[tauri::command]` function.
//! All commands are re-exported here for registration in `lib.rs`.

pub mod agent;
pub mod health;
pub mod version;
pub mod platform;
pub mod app_directories;
pub mod file_attributes;
pub mod file_operations;
pub mod list_directory;
pub mod list_drives;
pub mod search;
pub mod transfer;
pub mod thumbnail;
