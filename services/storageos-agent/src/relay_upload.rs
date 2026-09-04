//! Receive file uploads that arrive over the relay.
//!
//! Direct-LAN uploads use the multipart `/upload` HTTP endpoint. When the peer
//! is off-LAN there is no reachable HTTP address, so the transfer instead
//! arrives as a sequence of relay messages:
//!
//!     upload_start  → (N × upload_data, base64 chunks) → upload_complete
//!
//! We buffer the chunks into a `.part` file inside the destination directory
//! (same volume, so the final rename is atomic) keyed by `transfer_id`, and
//! move it into place on completion. This mirrors what the Android relay
//! handler does when *it* is the receiver — without it, a phone/PC on a
//! different network can browse but never upload to this agent.

use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use base64::Engine;
use serde_json::{json, Value};
use tokio::sync::Mutex;

struct UploadSession {
    temp_path: PathBuf,
    file: std::fs::File,
    dest_dir: PathBuf,
    file_name: String,
}

fn sessions() -> &'static Mutex<HashMap<String, UploadSession>> {
    static S: OnceLock<Mutex<HashMap<String, UploadSession>>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Inspect a relay message. Returns:
/// - `None`               → not an upload message; let the caller dispatch it.
/// - `Some(None)`         → handled (a data chunk), nothing to send back.
/// - `Some(Some(reply))`  → handled; send this response envelope to the peer.
pub async fn try_handle(raw: &Value, my_device_id: &str) -> Option<Option<Value>> {
    let payload = raw.get("payload")?;
    match payload.get("type").and_then(|t| t.as_str())? {
        "upload_start" => Some(Some(handle_start(raw, payload, my_device_id).await)),
        "upload_data" => {
            handle_data(payload).await;
            Some(None)
        }
        "upload_complete" => Some(Some(handle_complete(raw, payload, my_device_id).await)),
        _ => None,
    }
}

async fn handle_start(raw: &Value, payload: &Value, my_device_id: &str) -> Value {
    let transfer_id = payload.get("transfer_id").and_then(|v| v.as_str()).unwrap_or("");
    let dest = payload.get("path").and_then(|v| v.as_str()).unwrap_or("");
    // Keep only the final path component of the supplied name (no traversal).
    let raw_name = payload
        .get("file_name")
        .or_else(|| payload.get("filename"))
        .and_then(|v| v.as_str())
        .unwrap_or("upload");
    let file_name = Path::new(raw_name)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "upload".to_string());

    if transfer_id.is_empty() {
        return reply(raw, my_device_id, error_payload("Missing transfer_id"));
    }
    let dest_dir = PathBuf::from(dest);
    if !dest_dir.is_dir() {
        return reply(raw, my_device_id, error_payload(&format!("Not a directory: {dest}")));
    }

    let temp_path = dest_dir.join(format!(".storageos-upload-{transfer_id}.part"));
    let file = match std::fs::File::create(&temp_path) {
        Ok(f) => f,
        Err(e) => return reply(raw, my_device_id, error_payload(&format!("Create failed: {e}"))),
    };

    sessions().lock().await.insert(
        transfer_id.to_string(),
        UploadSession { temp_path, file, dest_dir, file_name },
    );

    reply(raw, my_device_id, json!({ "type": "upload_ready" }))
}

async fn handle_data(payload: &Value) {
    let transfer_id = match payload.get("transfer_id").and_then(|v| v.as_str()) {
        Some(t) => t,
        None => return,
    };
    let data_b64 = match payload.get("data").and_then(|v| v.as_str()) {
        Some(d) => d,
        None => return,
    };
    let bytes = match base64::engine::general_purpose::STANDARD.decode(data_b64) {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(error = %e, "Relay upload chunk: bad base64");
            return;
        }
    };

    let mut guard = sessions().lock().await;
    if let Some(session) = guard.get_mut(transfer_id) {
        if let Err(e) = session.file.write_all(&bytes) {
            tracing::warn!(error = %e, "Relay upload chunk: write failed");
        }
    } else {
        tracing::warn!(transfer_id = %transfer_id, "Relay upload chunk for unknown transfer");
    }
}

async fn handle_complete(raw: &Value, payload: &Value, my_device_id: &str) -> Value {
    let transfer_id = payload.get("transfer_id").and_then(|v| v.as_str()).unwrap_or("");

    let session = match sessions().lock().await.remove(transfer_id) {
        Some(s) => s,
        None => return reply(raw, my_device_id, error_payload("Unknown transfer")),
    };

    // Ensure all buffered bytes hit disk, then release the handle before moving.
    let UploadSession { temp_path, mut file, dest_dir, file_name } = session;
    if let Err(e) = file.flush() {
        tracing::warn!(error = %e, "Relay upload flush failed");
    }
    drop(file);

    let final_path = resolve_upload_name(&dest_dir, &file_name);
    if let Err(e) = std::fs::rename(&temp_path, &final_path) {
        let _ = std::fs::remove_file(&temp_path);
        return reply(raw, my_device_id, error_payload(&format!("Finalize failed: {e}")));
    }

    let path = final_path.to_string_lossy().into_owned();
    tracing::info!(path = %path, "File uploaded over relay");
    reply(
        raw,
        my_device_id,
        json!({ "type": "operation_response", "success": true, "path": path }),
    )
}

/// Pick a non-colliding destination name (`file.txt` → `file (1).txt`).
fn resolve_upload_name(dir: &Path, name: &str) -> PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let stem = Path::new(name)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| name.to_string());
    let ext = Path::new(name)
        .extension()
        .map(|s| format!(".{}", s.to_string_lossy()))
        .unwrap_or_default();
    let mut counter = 1u32;
    loop {
        let candidate = dir.join(format!("{stem} ({counter}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

fn error_payload(message: &str) -> Value {
    json!({ "type": "error_response", "error": message })
}

/// Build a response envelope addressed back to the message's sender, carrying
/// the request_id the peer correlates on (both envelope- and payload-level, so
/// either matching path on the client resolves it).
fn reply(raw: &Value, my_device_id: &str, mut payload: Value) -> Value {
    let req_id = raw
        .get("payload")
        .and_then(|p| p.get("request_id"))
        .and_then(|v| v.as_str())
        .or_else(|| raw.get("id").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();

    if let Some(obj) = payload.as_object_mut() {
        obj.insert("request_id".to_string(), json!(req_id));
    }

    let source = raw
        .get("destination")
        .cloned()
        .unwrap_or_else(|| json!(my_device_id));
    let destination = raw.get("source").cloned().unwrap_or_else(|| json!(""));
    let is_error = payload.get("type").and_then(|t| t.as_str()) == Some("error_response");

    json!({
        "version": { "major": 1, "minor": 0 },
        "id": uuid::Uuid::new_v4().to_string(),
        "request_id": req_id,
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        "source": source,
        "destination": destination,
        "kind": if is_error { "error" } else { "response" },
        "payload": payload,
    })
}
