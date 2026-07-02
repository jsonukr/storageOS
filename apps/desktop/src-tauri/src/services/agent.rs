//! Agent process launcher.
//!
//! Locates the storageos-agent binary relative to the desktop executable
//! and spawns it as a detached background process.

use std::path::{Path, PathBuf};
use std::process::Command;

pub fn find_agent_binary() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));

    let bin_name = if cfg!(windows) { "storageos-agent.exe" } else { "storageos-agent" };

    if let Some(ref dir) = exe_dir {
        let candidate = dir.join(bin_name);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // Dev layout: desktop exe is at apps/desktop/src-tauri/target/debug/
    // Agent is at services/storageos-agent/target/debug/
    // Walk up to project root and look for agent
    if let Some(ref dir) = exe_dir {
        let mut ancestor = dir.as_path();
        for _ in 0..6 {
            if let Some(parent) = ancestor.parent() {
                ancestor = parent;
                let candidate = ancestor
                    .join("services")
                    .join("storageos-agent")
                    .join("target")
                    .join("debug")
                    .join(bin_name);
                if candidate.exists() {
                    return Some(candidate);
                }
                let release = ancestor
                    .join("services")
                    .join("storageos-agent")
                    .join("target")
                    .join("release")
                    .join(bin_name);
                if release.exists() {
                    return Some(release);
                }
            }
        }
    }

    None
}

pub fn launch_agent(binary_path: &Path, port: u16) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        Command::new(binary_path)
            .arg("--port")
            .arg(port.to_string())
            .arg("--bind")
            .arg("0.0.0.0")
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to spawn agent: {e}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(binary_path)
            .arg("--port")
            .arg(port.to_string())
            .arg("--bind")
            .arg("0.0.0.0")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn agent: {e}"))?;
    }

    Ok(())
}
