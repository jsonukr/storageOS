use storageos_core::models::common::SearchSnapshot;
use storageos_core::protocol::envelope::{Message, MessageId, MessageKind};
use storageos_core::protocol::payloads::*;
use storageos_core::protocol::CURRENT_VERSION;

use crate::file_service;

pub async fn dispatch(request: &Message) -> Message {
    let payload = match &request.payload {
        Payload::RootsRequest(_) => handle_roots(),
        Payload::DirectoryRequest(req) => handle_directory(req),
        Payload::CreateFolderRequest(req) => handle_create_folder(req),
        Payload::RenameRequest(req) => handle_rename(req),
        Payload::DeleteRequest(req) => handle_delete(req),
        Payload::SearchRequest(req) => handle_search(req),
        Payload::ThumbnailRequest(req) => handle_thumbnail(req),
        Payload::DownloadRequest(req) => handle_download_start(req).await,
        _ => Payload::Error(ErrorPayload {
            code: ErrorCode::InvalidRequest,
            message: "Unsupported request type".to_string(),
            details: None,
        }),
    };

    let kind = match &payload {
        Payload::Error(_) => MessageKind::Error,
        _ => MessageKind::Response,
    };

    Message {
        version: CURRENT_VERSION,
        id: MessageId::new(uuid::Uuid::new_v4().to_string()),
        request_id: Some(request.id.clone()),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
        source: request.destination.clone(),
        destination: request.source.clone(),
        kind,
        payload,
    }
}

fn handle_roots() -> Payload {
    match storageos_core::filesystem::list_roots() {
        Ok(roots) => Payload::RootsResponse(RootsResponse { roots }),
        Err(e) => error_payload(ErrorCode::InternalError, &e.to_string()),
    }
}

fn handle_directory(req: &DirectoryRequest) -> Payload {
    match storageos_core::filesystem::list_directory(&req.path) {
        Ok(entries) => {
            let total_count = entries.len() as u32;
            Payload::DirectoryResponse(DirectoryResponse {
                path: req.path.clone(),
                entries,
                total_count,
            })
        }
        Err(e) => core_error_to_payload(&e),
    }
}

fn handle_create_folder(req: &CreateFolderRequest) -> Payload {
    match storageos_core::filesystem::create_folder(&req.parent, &req.name) {
        Ok(result) => Payload::OperationResponse(OperationResponse {
            success: result.success,
            path: result.path,
            error: None,
        }),
        Err(e) => core_error_to_payload(&e),
    }
}

fn handle_rename(req: &RenameEntryRequest) -> Payload {
    match storageos_core::filesystem::rename_item(&req.path, &req.new_name) {
        Ok(result) => Payload::OperationResponse(OperationResponse {
            success: result.success,
            path: result.path,
            error: None,
        }),
        Err(e) => core_error_to_payload(&e),
    }
}

fn handle_delete(req: &DeleteEntryRequest) -> Payload {
    match storageos_core::filesystem::delete_item(&req.path) {
        Ok(result) => Payload::OperationResponse(OperationResponse {
            success: result.success,
            path: result.path,
            error: None,
        }),
        Err(e) => core_error_to_payload(&e),
    }
}

fn handle_search(req: &SearchEntryRequest) -> Payload {
    let noop = |_: &SearchSnapshot| {};
    match storageos_core::search::search_directory(&req.path, &req.query, req.recursive, &noop) {
        Ok(entries) => {
            let total_count = entries.len() as u32;
            Payload::SearchResponse(SearchEntryResponse {
                entries,
                total_count,
            })
        }
        Err(e) => core_error_to_payload(&e),
    }
}

fn handle_thumbnail(req: &ThumbnailRequest) -> Payload {
    match file_service::generate_thumbnail(&req.path, req.max_size) {
        Ok(bytes) => {
            use base64::Engine;
            let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Payload::ThumbnailResponse(ThumbnailResponse {
                data,
                content_type: "image/jpeg".to_string(),
            })
        }
        Err(e) => core_error_to_payload(&e),
    }
}

async fn handle_download_start(req: &DownloadRequest) -> Payload {
    match file_service::prepare_download(&req.path) {
        Ok((canonical, content_type)) => {
            let file_name = canonical
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("download")
                .to_string();

            match std::fs::read(&canonical) {
                Ok(bytes) => {
                    use base64::Engine;
                    let total_bytes = bytes.len() as u64;
                    let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    Payload::DownloadData(DownloadData {
                        transfer_id: req.transfer_id.clone(),
                        offset: 0,
                        data,
                        is_last: true,
                    })
                }
                Err(e) => error_payload(ErrorCode::InternalError, &format!("Read error: {e}")),
            }
        }
        Err(e) => core_error_to_payload(&e),
    }
}

fn core_error_to_payload(e: &storageos_core::errors::CoreError) -> Payload {
    use storageos_core::errors::ErrorKind;
    let code = match e.kind {
        ErrorKind::NotFound => ErrorCode::NotFound,
        ErrorKind::PermissionDenied => ErrorCode::PermissionDenied,
        ErrorKind::InvalidArgument => ErrorCode::InvalidRequest,
        _ => ErrorCode::InternalError,
    };
    error_payload(code, &e.message)
}

fn error_payload(code: ErrorCode, message: &str) -> Payload {
    Payload::Error(ErrorPayload {
        code,
        message: message.to_string(),
        details: None,
    })
}
