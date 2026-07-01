//! Agent process launcher.
//!
//! Locates the storageos-agent binary relative to the desktop executable
//! and spawns it as a detached background process.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Locate the agent binary.
///
/// Search order:
/// 1. Same directory as the desktop executable
/// 2. `../services/storageos-agent/` relative to desktop exe (dev layout)
/// 3. PATH fallback
pub fn find_agent_binary() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));

    if let Some(ref dir) = exe_dir {
        let candidate = dir.join("storageos-agent.exe");
        if candidate.exists() {
            return Some(candidate);
        }

        #[cfg(not(target_os = "windows"))]
        {
            let candidate = dir.join("storageos-agent");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // Dev layout: cargo target directory
    if let Some(ref dir) = exe_dir {
        if let Some(target_dir) = dir.parent() {
            let candidate = target_dir.join("storageos-agent.exe");
            if candidate.exists() {
                return Some(candidate);
            }

            #[cfg(not(target_os = "windows"))]
            {
                let candidate = target_dir.join("storageos-agent");
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }

    None
}

/// Spawn the agent as a detached background process.
/// Returns Ok(()) if the process was spawned successfully.
pub fn launch_agent(binary_path: &Path, port: u16) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        Command::new(binary_path)
            .arg("--port")
            .arg(port.to_string())
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to spawn agent: {e}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(binary_path)
            .arg("--port")
            .arg(port.to_string())
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn agent: {e}"))?;
    }

    Ok(())
}
