use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use storageos_core::platform::Platform;
use tokio_util::io::ReaderStream;

pub struct AppState {
    started_at: Instant,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            started_at: Instant::now(),
        }
    }
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/version", get(version))
        .route("/roots", get(roots))
        .route("/directory", get(directory))
        .route("/file", get(file_metadata))
        .route("/download", get(download))
        .route("/thumbnail", get(thumbnail))
        .route("/ws", get(ws_upgrade))
        .with_state(state)
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    uptime_secs: u64,
    version: &'static str,
    platform: String,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    tracing::debug!("Health check requested");
    Json(HealthResponse {
        status: "ok",
        uptime_secs: state.started_at.elapsed().as_secs(),
        version: env!("CARGO_PKG_VERSION"),
        platform: Platform::current().display_name().to_string(),
    })
}

#[derive(Serialize)]
struct VersionResponse {
    agent: &'static str,
    core: &'static str,
    platform: String,
}

async fn version() -> Json<VersionResponse> {
    Json(VersionResponse {
        agent: env!("CARGO_PKG_VERSION"),
        core: env!("CARGO_PKG_VERSION"),
        platform: Platform::current().display_name().to_string(),
    })
}

async fn roots() -> Result<Json<Vec<crate::dto::LocalDriveDto>>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!("Roots requested");
    let core_roots = storageos_core::filesystem::list_roots().map_err(|e| {
        tracing::error!(error = %e, "Failed to list roots");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "IO_ERROR".to_string(),
                message: e.to_string(),
            }),
        )
    })?;
    let drives: Vec<crate::dto::LocalDriveDto> = core_roots.into_iter().map(crate::dto::LocalDriveDto::from).collect();
    Ok(Json(drives))
}

#[derive(Deserialize)]
struct DirectoryParams {
    path: String,
}

async fn directory(
    Query(params): Query<DirectoryParams>,
) -> Result<Json<Vec<crate::dto::DirectoryEntryDto>>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, "Directory listing requested");
    let entries = tokio::task::spawn_blocking(move || {
        storageos_core::filesystem::list_directory(&params.path)
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "INTERNAL".to_string(),
                message: format!("Task join error: {e}"),
            }),
        )
    })?
    .map_err(core_error_to_response)?;
    let dtos: Vec<crate::dto::DirectoryEntryDto> = entries.into_iter().map(crate::dto::DirectoryEntryDto::from).collect();
    Ok(Json(dtos))
}

#[derive(Deserialize)]
struct FileParams {
    path: String,
}

async fn file_metadata(
    Query(params): Query<FileParams>,
) -> Result<Json<crate::dto::DirectoryEntryDto>, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, "File metadata requested");
    let entry = tokio::task::spawn_blocking(move || {
        crate::file_service::get_file_metadata(&params.path)
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "INTERNAL".to_string(),
                message: format!("Task join error: {e}"),
            }),
        )
    })?
    .map_err(core_error_to_response)?;
    Ok(Json(crate::dto::DirectoryEntryDto::from(entry)))
}

async fn download(
    Query(params): Query<FileParams>,
) -> Result<Response, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, "Download requested");

    let (canonical, mime) = tokio::task::spawn_blocking({
        let path = params.path.clone();
        move || crate::file_service::prepare_download(&path)
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "INTERNAL".to_string(),
                message: format!("Task join error: {e}"),
            }),
        )
    })?
    .map_err(core_error_to_response)?;

    let file = tokio::fs::File::open(&canonical).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "IO_ERROR".to_string(),
                message: format!("Failed to open file: {e}"),
            }),
        )
    })?;

    let file_len = file
        .metadata()
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let file_name = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("download");

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, file_len)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{file_name}\""),
        )
        .body(body)
        .unwrap();

    Ok(response)
}

#[derive(Deserialize)]
struct ThumbnailParams {
    path: String,
    #[serde(default = "default_thumbnail_size")]
    max_size: u32,
}

fn default_thumbnail_size() -> u32 {
    256
}

async fn thumbnail(
    Query(params): Query<ThumbnailParams>,
) -> Result<Response, (StatusCode, Json<crate::dto::ErrorDto>)> {
    tracing::debug!(path = %params.path, max_size = params.max_size, "Thumbnail requested");

    let bytes = tokio::task::spawn_blocking(move || {
        crate::file_service::generate_thumbnail(&params.path, params.max_size)
    })
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(crate::dto::ErrorDto {
                code: "INTERNAL".to_string(),
                message: format!("Task join error: {e}"),
            }),
        )
    })?
    .map_err(core_error_to_response)?;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/jpeg")
        .header(header::CONTENT_LENGTH, bytes.len())
        .header(header::CACHE_CONTROL, "private, max-age=3600")
        .body(Body::from(bytes))
        .unwrap();

    Ok(response)
}

fn core_error_to_response(
    e: storageos_core::errors::CoreError,
) -> (StatusCode, Json<crate::dto::ErrorDto>) {
    use storageos_core::errors::ErrorKind;
    let status = match e.kind {
        ErrorKind::NotFound => StatusCode::NOT_FOUND,
        ErrorKind::PermissionDenied => StatusCode::FORBIDDEN,
        ErrorKind::InvalidArgument => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    let code = match e.kind {
        ErrorKind::NotFound => "NOT_FOUND",
        ErrorKind::PermissionDenied => "PERMISSION_DENIED",
        ErrorKind::InvalidArgument => "INVALID_ARGUMENT",
        _ => "IO_ERROR",
    };
    (
        status,
        Json(crate::dto::ErrorDto {
            code: code.to_string(),
            message: e.message,
        }),
    )
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    tracing::info!("WebSocket connection requested");
    ws.on_upgrade(handle_ws)
}

async fn handle_ws(mut socket: WebSocket) {
    tracing::info!("WebSocket client connected");

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Close(_)) => {
                tracing::info!("WebSocket client sent close frame");
                break;
            }
            Ok(Message::Ping(data)) => {
                if socket.send(Message::Pong(data)).await.is_err() {
                    break;
                }
            }
            Ok(_) => {}
            Err(e) => {
                tracing::debug!(error = %e, "WebSocket receive error");
                break;
            }
        }
    }

    tracing::info!("WebSocket client disconnected");
}
