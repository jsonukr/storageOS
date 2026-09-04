use serde_json::{json, Value};
use storageos_core::models::common::SearchSnapshot;
use storageos_core::protocol::envelope::{Message, MessageId, MessageKind};
use storageos_core::protocol::payloads::*;
use storageos_core::protocol::CURRENT_VERSION;

use crate::dto;
use crate::file_service;

/// Dispatch a relay request and return the response **envelope as JSON**.
///
/// The response payload uses the exact shape the Android relay handler emits —
/// client-facing DTOs carried as a JSON string under `data` (browse/search) or
/// as flat `success`/`path` fields (operations). This is what BOTH relay
/// consumers parse (the desktop `relay_proxy` and the Android relay client).
/// Previously the desktop served the internal typed protocol payloads (e.g.
/// `{ "type": "roots_response", "roots": [<core Root>] }`), which neither
/// consumer could parse — so a desktop answering over the relay produced an
/// unreadable response and PC↔PC (and mobile→PC) drive/folder listing failed,
/// while PC→mobile worked because the phone already emits this `data` format.
pub async fn dispatch(request: &Message) -> Value {
    let request_id = request.id.0.clone();

    let payload = match &request.payload {
        Payload::RootsRequest(_) => roots_payload(&request_id),
        Payload::DirectoryRequest(req) => directory_payload(&req.path, &request_id),
        Payload::CreateFolderRequest(req) => create_folder_payload(req, &request_id),
        Payload::RenameRequest(req) => rename_payload(req, &request_id),
        Payload::DeleteRequest(req) => delete_payload(req, &request_id),
        Payload::SearchRequest(req) => search_payload(req, &request_id),
        Payload::ThumbnailRequest(req) => thumbnail_payload(req, &request_id),
        Payload::DownloadRequest(req) => download_payload(req, &request_id),
        _ => error_payload(&request_id, "Unsupported request type"),
    };

    let is_error = payload.get("type").and_then(|t| t.as_str()) == Some("error_response");

    // Build the envelope with the real Message type so its field names and the
    // envelope-level `request_id` (used for correlation) are byte-identical to
    // before; then swap in the JSON payload (Message.payload is a typed enum
    // and can't hold arbitrary JSON).
    let envelope = Message {
        version: CURRENT_VERSION,
        id: MessageId::new(uuid::Uuid::new_v4().to_string()),
        request_id: Some(request.id.clone()),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
        source: request.destination.clone(),
        destination: request.source.clone(),
        kind: if is_error { MessageKind::Error } else { MessageKind::Response },
        payload: Payload::RootsRequest(RootsRequest {}), // placeholder, replaced below
    };

    let mut value = serde_json::to_value(&envelope).unwrap_or_else(|_| json!({}));
    if let Some(obj) = value.as_object_mut() {
        obj.insert("payload".to_string(), payload);
    }
    value
}

/// `{ "type": kind, "request_id": id, "data": "<json string of `data`>" }`
fn data_response<T: serde::Serialize>(kind: &str, request_id: &str, data: &T) -> Value {
    let data_str = serde_json::to_string(data).unwrap_or_else(|_| "[]".to_string());
    json!({ "type": kind, "request_id": request_id, "data": data_str })
}

fn roots_payload(request_id: &str) -> Value {
    match storageos_core::filesystem::list_roots() {
        Ok(roots) => {
            let dtos: Vec<dto::LocalDriveDto> =
                roots.into_iter().map(dto::LocalDriveDto::from).collect();
            data_response("roots_response", request_id, &dtos)
        }
        Err(e) => error_payload(request_id, &e.to_string()),
    }
}

fn directory_payload(path: &str, request_id: &str) -> Value {
    match storageos_core::filesystem::list_directory(path) {
        Ok(entries) => {
            let dtos: Vec<dto::DirectoryEntryDto> =
                entries.into_iter().map(dto::DirectoryEntryDto::from).collect();
            data_response("directory_response", request_id, &dtos)
        }
        Err(e) => core_error_payload(request_id, &e),
    }
}

fn search_payload(req: &SearchEntryRequest, request_id: &str) -> Value {
    let noop = |_: &SearchSnapshot| {};
    match storageos_core::search::search_directory(&req.path, &req.query, req.recursive, &noop) {
        Ok(entries) => {
            let dtos: Vec<dto::DirectoryEntryDto> =
                entries.into_iter().map(dto::DirectoryEntryDto::from).collect();
            data_response("search_response", request_id, &dtos)
        }
        Err(e) => core_error_payload(request_id, &e),
    }
}

fn operation_response(success: bool, path: String) -> Value {
    json!({ "type": "operation_response", "success": success, "path": path })
}

fn create_folder_payload(req: &CreateFolderRequest, request_id: &str) -> Value {
    match storageos_core::filesystem::create_folder(&req.parent, &req.name) {
        Ok(r) => operation_response(r.success, r.path),
        Err(e) => core_error_payload(request_id, &e),
    }
}

fn rename_payload(req: &RenameEntryRequest, request_id: &str) -> Value {
    match storageos_core::filesystem::rename_item(&req.path, &req.new_name) {
        Ok(r) => operation_response(r.success, r.path),
        Err(e) => core_error_payload(request_id, &e),
    }
}

fn delete_payload(req: &DeleteEntryRequest, request_id: &str) -> Value {
    match storageos_core::filesystem::delete_item(&req.path) {
        Ok(r) => operation_response(r.success, r.path),
        Err(e) => core_error_payload(request_id, &e),
    }
}

fn thumbnail_payload(req: &ThumbnailRequest, request_id: &str) -> Value {
    match file_service::generate_thumbnail(&req.path, req.max_size) {
        Ok(bytes) => {
            use base64::Engine;
            let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
            json!({ "type": "thumbnail_response", "data": data, "content_type": "image/jpeg" })
        }
        Err(e) => core_error_payload(request_id, &e),
    }
}

fn download_payload(req: &DownloadRequest, request_id: &str) -> Value {
    match file_service::prepare_download(&req.path) {
        Ok((canonical, _content_type)) => match std::fs::read(&canonical) {
            Ok(bytes) => {
                use base64::Engine;
                let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
                json!({
                    "type": "download_data",
                    "transfer_id": req.transfer_id.clone(),
                    "offset": 0,
                    "data": data,
                    "is_last": true,
                })
            }
            Err(e) => error_payload(request_id, &format!("Read error: {e}")),
        },
        Err(e) => core_error_payload(request_id, &e),
    }
}

fn core_error_payload(request_id: &str, e: &storageos_core::errors::CoreError) -> Value {
    error_payload(request_id, &e.message)
}

fn error_payload(request_id: &str, message: &str) -> Value {
    json!({ "type": "error_response", "request_id": request_id, "error": message })
}
