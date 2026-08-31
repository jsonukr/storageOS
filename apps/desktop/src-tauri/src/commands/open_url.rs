//! Open an external URL in the user's default browser.

use crate::errors::BridgeError;

/// Open an http(s) URL in the default browser. Used by the update banner to
/// send the user to the download website.
#[tauri::command]
pub fn open_url(url: String) -> Result<(), BridgeError> {
    // Only allow http(s) so this can never be used to launch arbitrary programs.
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err(BridgeError::internal(
            "Only http(s) URLs may be opened".to_string(),
        ));
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| BridgeError::internal(e.to_string()))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let opener = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(opener)
            .arg(&url)
            .spawn()
            .map_err(|e| BridgeError::internal(e.to_string()))?;
    }

    Ok(())
}
