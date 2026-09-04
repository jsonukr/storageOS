//! Self-update: download the latest installer and launch it.

use std::io::Read;

use crate::errors::BridgeError;

/// Download the update installer from `url` (an https GitHub release asset),
/// launch it, and quit the app so the installer can replace the running files.
/// The NSIS installer closes the old instance, updates in place, and relaunches.
#[tauri::command]
pub async fn install_update(app: tauri::AppHandle, url: String) -> Result<(), BridgeError> {
    if !url.starts_with("https://") {
        return Err(BridgeError::internal(
            "Only https update URLs are allowed".to_string(),
        ));
    }

    let dest = std::env::temp_dir().join("StorageOS-Update-Setup.exe");

    // Download off the UI thread.
    let dl_dest = dest.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let resp = ureq::get(&url).call().map_err(|e| e.to_string())?;
        let mut bytes = Vec::new();
        resp.into_reader()
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        // Guard against an HTML error page / missing asset being saved as ".exe".
        if bytes.len() < 100_000 {
            return Err("Downloaded installer is too small — the release asset may be missing".to_string());
        }
        std::fs::write(&dl_dest, &bytes).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| BridgeError::internal(e.to_string()))?
    .map_err(BridgeError::internal)?;

    // Launch the installer detached, then exit so it can overwrite the app exe.
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;
        std::process::Command::new(&dest)
            .creation_flags(DETACHED_PROCESS)
            .spawn()
            .map_err(|e| BridgeError::internal(format!("Failed to launch installer: {e}")))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = &dest;
        return Err(BridgeError::internal(
            "Self-install is only supported on Windows".to_string(),
        ));
    }

    app.exit(0);
    Ok(())
}
