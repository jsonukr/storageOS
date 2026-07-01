use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const CHUNK_SIZE: usize = 4 * 1024 * 1024;
const EMIT_INTERVAL: Duration = Duration::from_millis(100);
const PAUSE_POLL: Duration = Duration::from_millis(50);

const SIGNAL_RUNNING: u8 = 0;
const SIGNAL_PAUSED: u8 = 1;
const SIGNAL_CANCEL: u8 = 2;

static CONTROLS: Lazy<Mutex<HashMap<String, Arc<AtomicU8>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub fn register(id: &str) -> Arc<AtomicU8> {
    let signal = Arc::new(AtomicU8::new(SIGNAL_RUNNING));
    CONTROLS.lock().unwrap().insert(id.to_string(), Arc::clone(&signal));
    signal
}

pub fn unregister(id: &str) {
    CONTROLS.lock().unwrap().remove(id);
}

pub fn set_signal(id: &str, value: u8) -> bool {
    if let Some(signal) = CONTROLS.lock().unwrap().get(id) {
        signal.store(value, Ordering::Relaxed);
        true
    } else {
        false
    }
}

#[derive(Debug)]
enum ChunkAction {
    Continue,
    Cancelled,
}

fn check_signal(signal: &AtomicU8, app: &AppHandle, transfer_id: &str, offset: u64, total: u64, start: Instant) -> ChunkAction {
    loop {
        let val = signal.load(Ordering::Relaxed);
        if val == SIGNAL_CANCEL {
            return ChunkAction::Cancelled;
        }
        if val == SIGNAL_PAUSED {
            emit_progress(app, transfer_id, "paused", offset, total, start, None);
            std::thread::sleep(PAUSE_POLL);
            continue;
        }
        return ChunkAction::Continue;
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferProgressPayload {
    transfer_id: String,
    status: String,
    bytes_transferred: u64,
    total_bytes: u64,
    progress: f64,
    speed_bytes_per_second: f64,
    estimated_remaining_ms: u64,
    elapsed_ms: u64,
    error: Option<String>,
}

fn emit_progress(
    app: &AppHandle,
    transfer_id: &str,
    status: &str,
    bytes_transferred: u64,
    total_bytes: u64,
    start: Instant,
    error: Option<String>,
) {
    let elapsed_ms = start.elapsed().as_millis() as u64;
    let speed = if elapsed_ms > 0 {
        bytes_transferred as f64 / (elapsed_ms as f64 / 1000.0)
    } else {
        0.0
    };
    let remaining = total_bytes.saturating_sub(bytes_transferred);
    let eta_ms = if speed > 0.0 {
        (remaining as f64 / speed * 1000.0) as u64
    } else {
        0
    };
    let progress = if total_bytes > 0 {
        (bytes_transferred as f64 / total_bytes as f64) * 100.0
    } else {
        0.0
    };

    let _ = app.emit(
        "transfer:progress",
        TransferProgressPayload {
            transfer_id: transfer_id.to_string(),
            status: status.to_string(),
            bytes_transferred,
            total_bytes,
            progress,
            speed_bytes_per_second: speed,
            estimated_remaining_ms: eta_ms,
            elapsed_ms,
            error,
        },
    );
}

fn calculate_total_size(path: &Path) -> std::io::Result<u64> {
    if path.is_file() {
        Ok(fs::metadata(path)?.len())
    } else if path.is_dir() {
        let mut total = 0u64;
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let p = entry.path();
            if p.is_dir() {
                total += calculate_total_size(&p)?;
            } else {
                total += fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
            }
        }
        Ok(total)
    } else {
        Ok(0)
    }
}

fn copy_file_chunked(
    src: &Path,
    dest: &Path,
    app: &AppHandle,
    transfer_id: &str,
    offset: &mut u64,
    total: u64,
    last_emit: &mut Instant,
    start: Instant,
    signal: &AtomicU8,
) -> Result<(), TransferError> {
    let mut reader = BufReader::new(File::open(src)?);
    let mut writer = BufWriter::new(File::create(dest)?);
    let mut buf = vec![0u8; CHUNK_SIZE];

    loop {
        match check_signal(signal, app, transfer_id, *offset, total, start) {
            ChunkAction::Cancelled => return Err(TransferError::Cancelled),
            ChunkAction::Continue => {}
        }

        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        writer.write_all(&buf[..n])?;
        *offset += n as u64;

        if last_emit.elapsed() >= EMIT_INTERVAL {
            emit_progress(app, transfer_id, "running", *offset, total, start, None);
            *last_emit = Instant::now();
        }
    }
    writer.flush()?;
    Ok(())
}

#[derive(Debug)]
enum TransferError {
    Io(std::io::Error),
    Cancelled,
}

impl From<std::io::Error> for TransferError {
    fn from(e: std::io::Error) -> Self {
        TransferError::Io(e)
    }
}

impl std::fmt::Display for TransferError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransferError::Io(e) => write!(f, "{e}"),
            TransferError::Cancelled => write!(f, "Transfer cancelled"),
        }
    }
}

fn copy_dir_chunked(
    src: &Path,
    dest: &Path,
    app: &AppHandle,
    transfer_id: &str,
    offset: &mut u64,
    total: u64,
    last_emit: &mut Instant,
    start: Instant,
    signal: &AtomicU8,
) -> Result<(), TransferError> {
    fs::create_dir(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let entry_dest = dest.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_chunked(
                &entry.path(),
                &entry_dest,
                app,
                transfer_id,
                offset,
                total,
                last_emit,
                start,
                signal,
            )?;
        } else {
            copy_file_chunked(
                &entry.path(),
                &entry_dest,
                app,
                transfer_id,
                offset,
                total,
                last_emit,
                start,
                signal,
            )?;
        }
    }
    Ok(())
}

pub fn execute_transfer(
    app: &AppHandle,
    transfer_id: &str,
    source: &str,
    destination_dir: &str,
    transfer_type: &str,
    overwrite: bool,
    new_name: Option<&str>,
) {
    let src = Path::new(source);
    let dest_dir = Path::new(destination_dir);
    let start = Instant::now();

    if !src.exists() {
        emit_progress(
            app,
            transfer_id,
            "failed",
            0,
            0,
            start,
            Some(format!("Source not found: {source}")),
        );
        return;
    }
    if !dest_dir.is_dir() {
        emit_progress(
            app,
            transfer_id,
            "failed",
            0,
            0,
            start,
            Some(format!("Destination not found: {destination_dir}")),
        );
        return;
    }

    let file_name = match new_name {
        Some(name) => std::ffi::OsString::from(name),
        None => match src.file_name() {
            Some(n) => n.to_owned(),
            None => {
                emit_progress(
                    app,
                    transfer_id,
                    "failed",
                    0,
                    0,
                    start,
                    Some("Cannot determine file name".to_string()),
                );
                return;
            }
        },
    };

    let dest = dest_dir.join(&file_name);

    if dest.exists() {
        if overwrite {
            let result = if dest.is_dir() {
                fs::remove_dir_all(&dest)
            } else {
                fs::remove_file(&dest)
            };
            if let Err(e) = result {
                emit_progress(
                    app,
                    transfer_id,
                    "failed",
                    0,
                    0,
                    start,
                    Some(format!("Cannot overwrite: {e}")),
                );
                return;
            }
        } else {
            emit_progress(
                app,
                transfer_id,
                "failed",
                0,
                0,
                start,
                Some(format!(
                    "\"{}\" already exists in the destination",
                    file_name.to_string_lossy()
                )),
            );
            return;
        }
    }

    // Move: try rename first (instant on same volume)
    if transfer_type == "move" {
        match fs::rename(src, &dest) {
            Ok(_) => {
                let size = if dest.is_dir() {
                    calculate_total_size(&dest).unwrap_or(0)
                } else {
                    fs::metadata(&dest).map(|m| m.len()).unwrap_or(0)
                };
                emit_progress(app, transfer_id, "completed", size, size, start, None);
                return;
            }
            // ERROR_NOT_SAME_DEVICE (Windows error 17) — cross-volume, fall through to copy+delete
            Err(ref e) if e.raw_os_error() == Some(17) => {}
            Err(e) => {
                emit_progress(
                    app,
                    transfer_id,
                    "failed",
                    0,
                    0,
                    start,
                    Some(format!("Move failed: {e}")),
                );
                return;
            }
        }
    }

    let total_bytes = match calculate_total_size(src) {
        Ok(size) => size,
        Err(e) => {
            emit_progress(
                app,
                transfer_id,
                "failed",
                0,
                0,
                start,
                Some(format!("Cannot calculate size: {e}")),
            );
            return;
        }
    };

    if let Some(free) = get_free_space(dest_dir) {
        if total_bytes > free {
            let need = format_bytes(total_bytes);
            let avail = format_bytes(free);
            emit_progress(
                app,
                transfer_id,
                "failed",
                0,
                total_bytes,
                start,
                Some(format!(
                    "Not enough disk space. Need {need} but only {avail} available."
                )),
            );
            return;
        }
    }

    let signal = register(transfer_id);
    let mut offset = 0u64;
    let mut last_emit = Instant::now();

    emit_progress(app, transfer_id, "running", 0, total_bytes, start, None);

    let copy_result = if src.is_dir() {
        copy_dir_chunked(
            src,
            &dest,
            app,
            transfer_id,
            &mut offset,
            total_bytes,
            &mut last_emit,
            start,
            &signal,
        )
    } else {
        copy_file_chunked(
            src,
            &dest,
            app,
            transfer_id,
            &mut offset,
            total_bytes,
            &mut last_emit,
            start,
            &signal,
        )
    };

    unregister(transfer_id);

    match copy_result {
        Ok(_) => {
            if transfer_type == "move" {
                let del = if src.is_dir() {
                    fs::remove_dir_all(src)
                } else {
                    fs::remove_file(src)
                };
                if let Err(e) = del {
                    emit_progress(
                        app,
                        transfer_id,
                        "failed",
                        offset,
                        total_bytes,
                        start,
                        Some(format!("Copied but failed to delete source: {e}")),
                    );
                    return;
                }
            }
            emit_progress(
                app,
                transfer_id,
                "completed",
                total_bytes,
                total_bytes,
                start,
                None,
            );
        }
        Err(TransferError::Cancelled) => {
            if dest.exists() {
                let _ = if dest.is_dir() {
                    fs::remove_dir_all(&dest)
                } else {
                    fs::remove_file(&dest)
                };
            }
            emit_progress(
                app,
                transfer_id,
                "cancelled",
                offset,
                total_bytes,
                start,
                None,
            );
        }
        Err(e) => {
            if dest.exists() {
                let _ = if dest.is_dir() {
                    fs::remove_dir_all(&dest)
                } else {
                    fs::remove_file(&dest)
                };
            }
            emit_progress(
                app,
                transfer_id,
                "failed",
                offset,
                total_bytes,
                start,
                Some(e.to_string()),
            );
        }
    }
}

#[cfg(target_os = "windows")]
fn get_free_space(path: &Path) -> Option<u64> {
    let wide: Vec<u16> = path
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    let mut free: u64 = 0;
    let ok = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free as *mut u64 as *mut _,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if ok != 0 { Some(free) } else { None }
}

#[cfg(not(target_os = "windows"))]
fn get_free_space(_path: &Path) -> Option<u64> {
    None
}

fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    if bytes == 0 {
        return "0 B".to_string();
    }
    let i = (bytes as f64).log(1024.0).floor() as usize;
    let i = i.min(UNITS.len() - 1);
    let value = bytes as f64 / (1024_f64).powi(i as i32);
    if i == 0 {
        format!("{bytes} B")
    } else {
        format!("{value:.1} {}", UNITS[i])
    }
}
