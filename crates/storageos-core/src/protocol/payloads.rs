use serde::{Deserialize, Serialize};

use crate::models::device::{DeviceId, DeviceKind, Presence};
use crate::models::entry::Entry;
use crate::models::root::Root;
use crate::models::transfer::TransferStatus;
use crate::networking::TransportKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Payload {
    Hello(HelloPayload),
    Auth(AuthPayload),
    Ping(PingPayload),
    Pong(PongPayload),
    DirectoryRequest(DirectoryRequest),
    DirectoryResponse(DirectoryResponse),
    RootsRequest(RootsRequest),
    RootsResponse(RootsResponse),
    CreateFolderRequest(CreateFolderRequest),
    RenameRequest(RenameEntryRequest),
    DeleteRequest(DeleteEntryRequest),
    OperationResponse(OperationResponse),
    SearchRequest(SearchEntryRequest),
    SearchResponse(SearchEntryResponse),
    ThumbnailRequest(ThumbnailRequest),
    ThumbnailResponse(ThumbnailResponse),
    DownloadRequest(DownloadRequest),
    DownloadReady(DownloadReady),
    DownloadData(DownloadData),
    DownloadComplete(DownloadComplete),
    UploadStart(UploadStart),
    UploadReady(UploadReady),
    UploadData(UploadData),
    UploadComplete(UploadComplete),
    TransferError(TransferError),
    TransferProgress(TransferProgressPayload),
    Presence(PresencePayload),
    DeviceInfo(DeviceInfoPayload),
    Error(ErrorPayload),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelloPayload {
    pub device_id: DeviceId,
    pub device_name: String,
    pub device_kind: DeviceKind,
    pub platform: String,
    pub agent_version: String,
    pub protocol_version: super::envelope::ProtocolVersion,
    pub capabilities: Vec<String>,
    pub public_key: String,
    pub fingerprint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthPayload {
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingPayload {
    pub seq: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PongPayload {
    pub seq: u64,
    pub uptime_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryResponse {
    pub path: String,
    pub entries: Vec<Entry>,
    pub total_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootsRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootsResponse {
    pub roots: Vec<Root>,
}

// Phase 1: Filesystem RPC payloads

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFolderRequest {
    pub parent: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameEntryRequest {
    pub path: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteEntryRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResponse {
    pub success: bool,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchEntryRequest {
    pub path: String,
    pub query: String,
    pub recursive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchEntryResponse {
    pub entries: Vec<Entry>,
    pub total_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailRequest {
    pub path: String,
    #[serde(default = "default_thumbnail_size")]
    pub max_size: u32,
}

fn default_thumbnail_size() -> u32 {
    256
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailResponse {
    pub data: String,
    pub content_type: String,
}

// Phase 2: Streaming transfer payloads

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub transfer_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadReady {
    pub transfer_id: String,
    pub file_name: String,
    pub content_type: String,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadData {
    pub transfer_id: String,
    pub offset: u64,
    pub data: String,
    pub is_last: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadComplete {
    pub transfer_id: String,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadStart {
    pub transfer_id: String,
    pub path: String,
    pub file_name: String,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadReady {
    pub transfer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadData {
    pub transfer_id: String,
    pub offset: u64,
    pub data: String,
    pub is_last: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadComplete {
    pub transfer_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferError {
    pub transfer_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgressPayload {
    pub transfer_id: String,
    pub status: TransferStatus,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub progress: f64,
    pub speed_bytes_per_second: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresencePayload {
    pub device_id: DeviceId,
    pub status: Presence,
    pub uptime_secs: u64,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointInfo {
    pub transport: TransportKind,
    pub host: String,
    pub port: u16,
    pub reachable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfoPayload {
    pub device_id: DeviceId,
    pub device_name: String,
    pub device_kind: DeviceKind,
    pub platform: String,
    pub version: String,
    pub endpoints: Vec<EndpointInfo>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    Unknown,
    NotFound,
    PermissionDenied,
    InvalidRequest,
    InternalError,
    Timeout,
    Unavailable,
    VersionMismatch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}
