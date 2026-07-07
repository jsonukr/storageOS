use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;

use storageos_core::networking::RelayState;
use storageos_core::protocol::payloads::*;

use crate::dto;
use crate::server::AppState;

#[derive(Deserialize)]
pub struct RelayDeviceParams {
    pub device: String,
}

#[derive(Deserialize)]
pub struct RelayDirectoryParams {
    pub device: String,
    pub path: String,
}

#[derive(Deserialize)]
pub struct RelaySearchParams {
    pub device: String,
    pub path: String,
    pub query: String,
    #[serde(default)]
    pub recursive: bool,
}

#[derive(Deserialize)]
pub struct RelayThumbnailParams {
    pub device: String,
    pub path: String,
    #[serde(default = "default_thumb_size")]
    pub max_size: u32,
}

fn default_thumb_size() -> u32 {
    256
}

#[derive(Deserialize)]
pub struct RelayFileParams {
    pub device: String,
    pub path: String,
}

#[derive(Deserialize)]
pub struct RelayMkdirBody {
    pub parent: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct RelayRenameBody {
    pub path: String,
    pub new_name: String,
}

#[derive(Deserialize)]
pub struct RelayDeleteParams {
    pub device: String,
    pub path: String,
}

#[derive(serde::Serialize)]
pub struct OpResponse {
    success: bool,
    path: String,
}

fn relay_error(msg: &str) -> (StatusCode, Json<dto::ErrorDto>) {
    (
        StatusCode::BAD_GATEWAY,
        Json(dto::ErrorDto {
            code: "RELAY_ERROR".to_string(),
            message: msg.to_string(),
        }),
    )
}

fn check_relay(state: &AppState) -> Result<(), (StatusCode, Json<dto::ErrorDto>)> {
    if !matches!(state.relay_state(), RelayState::Connected) {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(dto::ErrorDto {
                code: "RELAY_UNAVAILABLE".to_string(),
                message: "Relay is not connected".to_string(),
            }),
        ));
    }
    Ok(())
}

fn extract_payload(raw: &serde_json::Value) -> Result<&serde_json::Value, (StatusCode, Json<dto::ErrorDto>)> {
    raw.get("payload").ok_or_else(|| relay_error("No payload in response"))
}

fn parse_data_field<T: serde::de::DeserializeOwned>(payload: &serde_json::Value) -> Result<T, (StatusCode, Json<dto::ErrorDto>)> {
    if let Some(data_str) = payload.get("data").and_then(|d| d.as_str()) {
        serde_json::from_str(data_str).map_err(|e| relay_error(&format!("Failed to parse data: {e}")))
    } else {
        serde_json::from_value(payload.clone()).map_err(|e| relay_error(&format!("Failed to parse payload: {e}")))
    }
}

pub async fn relay_roots(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RelayDeviceParams>,
) -> Result<Json<Vec<dto::LocalDriveDto>>, (StatusCode, Json<dto::ErrorDto>)> {
    check_relay(&state)?;

    let raw = state
        .relay_handle
        .request_raw(&params.device, Payload::RootsRequest(RootsRequest {}))
        .await
        .map_err(|e| relay_error(&e))?;

    let payload = extract_payload(&raw)?;
    let drives: Vec<dto::LocalDriveDto> = parse_data_field(payload)?;
    Ok(Json(drives))
}

pub async fn relay_directory(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RelayDirectoryParams>,
) -> Result<Json<Vec<dto::DirectoryEntryDto>>, (StatusCode, Json<dto::ErrorDto>)> {
    check_relay(&state)?;

    let raw = state
        .relay_handle
        .request_raw(
            &params.device,
            Payload::DirectoryRequest(DirectoryRequest {
                path: params.path,
            }),
        )
        .await
        .map_err(|e| relay_error(&e))?;

    let payload = extract_payload(&raw)?;
    let entries: Vec<dto::DirectoryEntryDto> = parse_data_field(payload)?;
    Ok(Json(entries))
}

pub async fn relay_mkdir(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RelayDeviceParams>,
    Json(body): Json<RelayMkdirBody>,
) -> Result<Json<OpResponse>, (StatusCode, Json<dto::ErrorDto>)> {
    check_relay(&state)?;

    let raw = state
        .relay_handle
        .request_raw(
            &params.device,
            Payload::CreateFolderRequest(CreateFolderRequest {
                parent: body.parent,
                name: body.name,
            }),
        )
        .await
        .map_err(|e| relay_error(&e))?;

    let payload = extract_payload(&raw)?;
    let success = payload.get("success").and_then(|s| s.as_bool()).unwrap_or(false);
    let path = payload.get("path").and_then(|p| p.as_str()).unwrap_or("").to_string();
    Ok(Json(OpResponse { success, path }))
}

pub async fn relay_rename(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RelayDeviceParams>,
    Json(body): Json<RelayRenameBody>,
) -> Result<Json<OpResponse>, (StatusCode, Json<dto::ErrorDto>)> {
    check_relay(&state)?;

    let raw = state
        .relay_handle
        .request_raw(
            &params.device,
            Payload::RenameRequest(RenameEntryRequest {
                path: body.path,
                new_name: body.new_name,
            }),
        )
        .await
        .map_err(|e| relay_error(&e))?;

    let payload = extract_payload(&raw)?;
    let success = payload.get("success").and_then(|s| s.as_bool()).unwrap_or(false);
    let path = payload.get("path").and_then(|p| p.as_str()).unwrap_or("").to_string();
    Ok(Json(OpResponse { success, path }))
}

pub async fn relay_delete(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RelayDeleteParams>,
) -> Result<Json<OpResponse>, (StatusCode, Json<dto::ErrorDto>)> {
    check_relay(&state)?;

    let raw = state
        .relay_handle
        .request_raw(
            &params.device,
            Payload::DeleteRequest(DeleteEntryRequest {
                path: params.path,
            }),
        )
        .await
        .map_err(|e| relay_error(&e))?;

    let payload = extract_payload(&raw)?;
    let success = payload.get("success").and_then(|s| s.as_bool()).unwrap_or(false);
    let path = payload.get("path").and_then(|p| p.as_str()).unwrap_or("").to_string();
    Ok(Json(OpResponse { success, path }))
}

pub async fn relay_search(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RelaySearchParams>,
) -> Result<Json<Vec<dto::DirectoryEntryDto>>, (StatusCode, Json<dto::ErrorDto>)> {
    check_relay(&state)?;

    let raw = state
        .relay_handle
        .request_raw(
            &params.device,
            Payload::SearchRequest(SearchEntryRequest {
                path: params.path,
                query: params.query,
                recursive: params.recursive,
            }),
        )
        .await
        .map_err(|e| relay_error(&e))?;

    let payload = extract_payload(&raw)?;
    let entries: Vec<dto::DirectoryEntryDto> = parse_data_field(payload)?;
    Ok(Json(entries))
}

pub async fn relay_thumbnail(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RelayThumbnailParams>,
) -> Result<Response, (StatusCode, Json<dto::ErrorDto>)> {
    check_relay(&state)?;

    let response = state
        .relay_handle
        .request(&params.device, Payload::ThumbnailRequest(ThumbnailRequest {
            path: params.path,
            max_size: params.max_size,
        }))
        .await
        .map_err(|e| relay_error(&e))?;

    match response.payload {
        Payload::ThumbnailResponse(r) => {
            use base64::Engine;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&r.data)
                .map_err(|e| relay_error(&format!("Base64 decode error: {e}")))?;

            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, r.content_type)
                .header(header::CONTENT_LENGTH, bytes.len())
                .header(header::CACHE_CONTROL, "private, max-age=3600")
                .body(Body::from(bytes))
                .unwrap())
        }
        _ => Err(relay_error("Unexpected response type")),
    }
}

pub async fn relay_download(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RelayFileParams>,
) -> Result<Response, (StatusCode, Json<dto::ErrorDto>)> {
    check_relay(&state)?;

    let transfer_id = uuid::Uuid::new_v4().to_string();

    let response = state
        .relay_handle
        .request(
            &params.device,
            Payload::DownloadRequest(DownloadRequest {
                transfer_id: transfer_id.clone(),
                path: params.path,
            }),
        )
        .await
        .map_err(|e| relay_error(&e))?;

    match response.payload {
        Payload::DownloadData(data) => {
            use base64::Engine;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&data.data)
                .map_err(|e| relay_error(&format!("Base64 decode error: {e}")))?;

            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .header(header::CONTENT_LENGTH, bytes.len())
                .body(Body::from(bytes))
                .unwrap())
        }
        _ => Err(relay_error("Unexpected response type")),
    }
}

pub async fn relay_upload(
    State(state): State<Arc<AppState>>,
    Query(params): Query<RelayDirectoryParams>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<OpResponse>, (StatusCode, Json<dto::ErrorDto>)> {
    check_relay(&state)?;

    let mut last_path = String::new();

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(dto::ErrorDto {
                code: "INVALID_ARGUMENT".to_string(),
                message: format!("Multipart error: {e}"),
            }),
        )
    })? {
        let file_name = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "upload".to_string());

        let file_bytes = field.bytes().await.map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(dto::ErrorDto {
                    code: "IO_ERROR".to_string(),
                    message: format!("Failed to read upload data: {e}"),
                }),
            )
        })?;

        let total_bytes = file_bytes.len() as u64;
        let transfer_id = uuid::Uuid::new_v4().to_string();

        let raw = state
            .relay_handle
            .request_raw(
                &params.device,
                Payload::UploadStart(UploadStart {
                    transfer_id: transfer_id.clone(),
                    path: params.path.clone(),
                    file_name: file_name.clone(),
                    total_bytes,
                }),
            )
            .await
            .map_err(|e| relay_error(&e))?;

        let payload = extract_payload(&raw)?;
        let ptype = payload.get("type").and_then(|t| t.as_str()).unwrap_or("");
        if ptype != "upload_ready" {
            return Err(relay_error("Remote device not ready for upload"));
        }

        use base64::Engine;
        let chunk_size: usize = 256 * 1024;
        let mut offset: u64 = 0;

        for chunk in file_bytes.chunks(chunk_size) {
            let data = base64::engine::general_purpose::STANDARD.encode(chunk);
            let is_last = (offset + chunk.len() as u64) >= total_bytes;

            let msg = storageos_core::protocol::envelope::Message {
                version: storageos_core::protocol::CURRENT_VERSION,
                id: storageos_core::protocol::envelope::MessageId::new(
                    uuid::Uuid::new_v4().to_string(),
                ),
                request_id: None,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64,
                source: storageos_core::models::device::DeviceId(state.device_id.clone()),
                destination: storageos_core::models::device::DeviceId(params.device.clone()),
                kind: storageos_core::protocol::envelope::MessageKind::Transfer,
                payload: Payload::UploadData(UploadData {
                    transfer_id: transfer_id.clone(),
                    offset,
                    data,
                    is_last,
                }),
            };

            let json = serde_json::to_string(&msg).map_err(|e| relay_error(&e.to_string()))?;
            state
                .relay_handle
                .send_raw(json)
                .map_err(|e| relay_error(&e))?;

            offset += chunk.len() as u64;
        }

        let complete_raw = state
            .relay_handle
            .request_raw(
                &params.device,
                Payload::UploadComplete(UploadComplete {
                    transfer_id,
                    path: params.path.clone(),
                }),
            )
            .await
            .map_err(|e| relay_error(&e))?;

        let complete_payload = extract_payload(&complete_raw)?;
        let success = complete_payload.get("success").and_then(|s| s.as_bool()).unwrap_or(false);
        last_path = complete_payload.get("path").and_then(|p| p.as_str()).unwrap_or("").to_string();

        if !success {
            return Err(relay_error("Upload completion failed"));
        }
    }

    Ok(Json(OpResponse {
        success: true,
        path: last_path,
    }))
}
