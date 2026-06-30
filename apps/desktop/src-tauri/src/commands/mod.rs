//! Tauri IPC commands.
//!
//! Each submodule exposes one `#[tauri::command]` function.
//! All commands are re-exported here for registration in `lib.rs`.

mod health;
mod version;
mod platform;
mod app_directories;

pub use health::health;
pub use version::version;
pub use platform::platform;
pub use app_directories::app_directories;
