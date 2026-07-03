use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedFile {
    pub path: String,
    pub name: String,
    pub size: u64,
}

#[tauri::command]
pub async fn pick_files() -> Result<Vec<PickedFile>, crate::errors::BridgeError> {
    let handles = rfd::AsyncFileDialog::new()
        .set_title("Select files to upload")
        .pick_files()
        .await;

    let Some(handles) = handles else {
        return Ok(Vec::new());
    };

    let mut files = Vec::with_capacity(handles.len());
    for h in handles {
        let path = h.path().to_string_lossy().to_string();
        let name = h.file_name();
        let size = std::fs::metadata(&path)
            .map(|m| m.len())
            .unwrap_or(0);
        files.push(PickedFile { path, name, size });
    }
    Ok(files)
}
