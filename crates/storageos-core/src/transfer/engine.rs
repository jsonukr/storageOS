use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::{Duration, Instant};

use crate::config::constants::{TRANSFER_CHUNK_SIZE, TRANSFER_PROGRESS_INTERVAL_MS};
use crate::models::{TransferSnapshot, TransferStatus, TransferType};
use crate::transfer::controller;
use crate::utils::format_bytes;

const PAUSE_POLL: Duration = Duration::from_millis(50);

pub fn execute_transfer(
    transfer_id: &str,
    source: &str,
    destination_dir: &str,
    transfer_type: TransferType,
    overwrite: bool,
    new_name: Option<&str>,
    on_progress: &dyn Fn(&TransferSnapshot),
) {
    let src = Path::new(source);
    let dest_dir = Path::new(destination_dir);
    let start = Instant::now();

    if !src.exists() {
        emit(on_progress, transfer_id, TransferStatus::Failed, 0, 0, start, Some(format!("Source not found: {source}")));
        return;
    }
    if !dest_dir.is_dir() {
        emit(on_progress, transfer_id, TransferStatus::Failed, 0, 0, start, Some(format!("Destination not found: {destination_dir}")));
        return;
    }

    let file_name = match new_name {
        Some(name) => std::ffi::OsString::from(name),
        None => match src.file_name() {
            Some(n) => n.to_owned(),
            None => {
                emit(on_progress, transfer_id, TransferStatus::Failed, 0, 0, start, Some("Cannot determine file name".to_string()));
                return;
            }
        },
    };

    let dest = dest_dir.join(&file_name);

    if transfer_type == TransferType::Move && src == dest {
        let size = calculate_total_size(src).unwrap_or(0);
        emit(on_progress, transfer_id, TransferStatus::Completed, size, size, start, None);
        return;
    }

    if dest.exists() {
        if overwrite {
            let result = if dest.is_dir() {
                fs::remove_dir_all(&dest)
            } else {
                fs::remove_file(&dest)
            };
            if let Err(e) = result {
                emit(on_progress, transfer_id, TransferStatus::Failed, 0, 0, start, Some(format!("Cannot overwrite: {e}")));
                return;
            }
        } else {
            emit(on_progress, transfer_id, TransferStatus::Failed, 0, 0, start, Some(format!(
                "\"{}\" already exists in the destination",
                file_name.to_string_lossy()
            )));
            return;
        }
    }

    if transfer_type == TransferType::Move {
        match fs::rename(src, &dest) {
            Ok(_) => {
                let size = calculate_total_size(&dest).unwrap_or(0);
                emit(on_progress, transfer_id, TransferStatus::Completed, size, size, start, None);
                return;
            }
            Err(ref e) if e.raw_os_error() == Some(17) => {}
            Err(e) => {
                emit(on_progress, transfer_id, TransferStatus::Failed, 0, 0, start, Some(format!("Move failed: {e}")));
                return;
            }
        }
    }

    let total_bytes = match calculate_total_size(src) {
        Ok(size) => size,
        Err(e) => {
            emit(on_progress, transfer_id, TransferStatus::Failed, 0, 0, start, Some(format!("Cannot calculate size: {e}")));
            return;
        }
    };

    if let Some(free) = get_free_space(dest_dir) {
        if total_bytes > free {
            let need = format_bytes(total_bytes);
            let avail = format_bytes(free);
            emit(on_progress, transfer_id, TransferStatus::Failed, 0, total_bytes, start, Some(format!(
                "Not enough disk space. Need {need} but only {avail} available."
            )));
            return;
        }
    }

    let signal = controller::register(transfer_id);
    let mut offset = 0u64;
    let emit_interval = Duration::from_millis(TRANSFER_PROGRESS_INTERVAL_MS);
    let mut last_emit = Instant::now();

    emit(on_progress, transfer_id, TransferStatus::Running, 0, total_bytes, start, None);

    let copy_result = if src.is_dir() {
        copy_dir_chunked(src, &dest, on_progress, transfer_id, &mut offset, total_bytes, &mut last_emit, emit_interval, start, &signal)
    } else {
        copy_file_chunked(src, &dest, on_progress, transfer_id, &mut offset, total_bytes, &mut last_emit, emit_interval, start, &signal)
    };

    controller::unregister(transfer_id);

    match copy_result {
        Ok(_) => {
            if transfer_type == TransferType::Move {
                let del = if src.is_dir() {
                    fs::remove_dir_all(src)
                } else {
                    fs::remove_file(src)
                };
                if let Err(e) = del {
                    emit(on_progress, transfer_id, TransferStatus::Failed, offset, total_bytes, start, Some(format!("Copied but failed to delete source: {e}")));
                    return;
                }
            }
            emit(on_progress, transfer_id, TransferStatus::Completed, total_bytes, total_bytes, start, None);
        }
        Err(TransferError::Cancelled) => {
            cleanup_partial(&dest);
            emit(on_progress, transfer_id, TransferStatus::Cancelled, offset, total_bytes, start, None);
        }
        Err(e) => {
            cleanup_partial(&dest);
            emit(on_progress, transfer_id, TransferStatus::Failed, offset, total_bytes, start, Some(e.to_string()));
        }
    }
}

pub fn calculate_total_size(path: &Path) -> std::io::Result<u64> {
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

fn emit(
    on_progress: &dyn Fn(&TransferSnapshot),
    transfer_id: &str,
    status: TransferStatus,
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

    on_progress(&TransferSnapshot {
        transfer_id: transfer_id.to_string(),
        status,
        bytes_transferred,
        total_bytes,
        progress,
        speed_bytes_per_second: speed,
        estimated_remaining_ms: eta_ms,
        elapsed_ms,
        error,
    });
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

#[derive(Debug)]
enum ChunkAction {
    Continue,
    Cancelled,
}

fn check_signal(
    signal: &AtomicU8,
    on_progress: &dyn Fn(&TransferSnapshot),
    transfer_id: &str,
    offset: u64,
    total: u64,
    start: Instant,
) -> ChunkAction {
    loop {
        let val = signal.load(Ordering::Relaxed);
        if val == controller::SIGNAL_CANCEL {
            return ChunkAction::Cancelled;
        }
        if val == controller::SIGNAL_PAUSED {
            emit(on_progress, transfer_id, TransferStatus::Paused, offset, total, start, None);
            std::thread::sleep(PAUSE_POLL);
            continue;
        }
        return ChunkAction::Continue;
    }
}

fn copy_file_chunked(
    src: &Path,
    dest: &Path,
    on_progress: &dyn Fn(&TransferSnapshot),
    transfer_id: &str,
    offset: &mut u64,
    total: u64,
    last_emit: &mut Instant,
    emit_interval: Duration,
    start: Instant,
    signal: &AtomicU8,
) -> Result<(), TransferError> {
    let mut reader = BufReader::new(File::open(src)?);
    let mut writer = BufWriter::new(File::create(dest)?);
    let mut buf = vec![0u8; TRANSFER_CHUNK_SIZE];

    loop {
        match check_signal(signal, on_progress, transfer_id, *offset, total, start) {
            ChunkAction::Cancelled => return Err(TransferError::Cancelled),
            ChunkAction::Continue => {}
        }

        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        writer.write_all(&buf[..n])?;
        *offset += n as u64;

        if last_emit.elapsed() >= emit_interval {
            emit(on_progress, transfer_id, TransferStatus::Running, *offset, total, start, None);
            *last_emit = Instant::now();
        }
    }
    writer.flush()?;
    Ok(())
}

fn copy_dir_chunked(
    src: &Path,
    dest: &Path,
    on_progress: &dyn Fn(&TransferSnapshot),
    transfer_id: &str,
    offset: &mut u64,
    total: u64,
    last_emit: &mut Instant,
    emit_interval: Duration,
    start: Instant,
    signal: &AtomicU8,
) -> Result<(), TransferError> {
    fs::create_dir(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let entry_dest = dest.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_chunked(&entry.path(), &entry_dest, on_progress, transfer_id, offset, total, last_emit, emit_interval, start, signal)?;
        } else {
            copy_file_chunked(&entry.path(), &entry_dest, on_progress, transfer_id, offset, total, last_emit, emit_interval, start, signal)?;
        }
    }
    Ok(())
}

fn cleanup_partial(dest: &Path) {
    if dest.exists() {
        let _ = if dest.is_dir() {
            fs::remove_dir_all(dest)
        } else {
            fs::remove_file(dest)
        };
    }
}

#[cfg(target_os = "windows")]
pub fn get_free_space(path: &Path) -> Option<u64> {
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
pub fn get_free_space(_path: &Path) -> Option<u64> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    fn test_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("storageos_transfer_{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn collect_snapshots(
        transfer_id: &str,
        source: &str,
        dest_dir: &str,
        transfer_type: TransferType,
        overwrite: bool,
        new_name: Option<&str>,
    ) -> Vec<TransferSnapshot> {
        let snapshots = Arc::new(Mutex::new(Vec::new()));
        let snapshots_ref = Arc::clone(&snapshots);
        execute_transfer(transfer_id, source, dest_dir, transfer_type, overwrite, new_name, &move |s| {
            snapshots_ref.lock().unwrap().push(s.clone());
        });
        Arc::try_unwrap(snapshots).unwrap().into_inner().unwrap()
    }

    use std::sync::Arc;

    #[test]
    fn copy_file_reports_completed() {
        let src_dir = test_dir("copy_file_src");
        let dest_dir = test_dir("copy_file_dest");
        let file = src_dir.join("test.txt");
        fs::write(&file, "hello world").unwrap();

        let snaps = collect_snapshots("t1", file.to_str().unwrap(), dest_dir.to_str().unwrap(), TransferType::Copy, false, None);

        let last = snaps.last().unwrap();
        assert_eq!(last.status, TransferStatus::Completed);
        assert!(dest_dir.join("test.txt").exists());
        assert!(file.exists());

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn move_file_deletes_source() {
        let src_dir = test_dir("move_file_src");
        let dest_dir = test_dir("move_file_dest");
        let file = src_dir.join("moveme.txt");
        fs::write(&file, "data").unwrap();

        let snaps = collect_snapshots("t2", file.to_str().unwrap(), dest_dir.to_str().unwrap(), TransferType::Move, false, None);

        let last = snaps.last().unwrap();
        assert_eq!(last.status, TransferStatus::Completed);
        assert!(!file.exists());
        assert!(dest_dir.join("moveme.txt").exists());

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn source_not_found_reports_failed() {
        let dest_dir = test_dir("fail_dest");
        let snaps = collect_snapshots("t3", "Z:\\nonexistent_12345", dest_dir.to_str().unwrap(), TransferType::Copy, false, None);

        let last = snaps.last().unwrap();
        assert_eq!(last.status, TransferStatus::Failed);
        assert!(last.error.as_ref().unwrap().contains("Source not found"));

        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn conflict_without_overwrite_reports_failed() {
        let src_dir = test_dir("conflict_src");
        let dest_dir = test_dir("conflict_dest");
        let file = src_dir.join("dup.txt");
        fs::write(&file, "src").unwrap();
        fs::write(dest_dir.join("dup.txt"), "existing").unwrap();

        let snaps = collect_snapshots("t4", file.to_str().unwrap(), dest_dir.to_str().unwrap(), TransferType::Copy, false, None);

        let last = snaps.last().unwrap();
        assert_eq!(last.status, TransferStatus::Failed);
        assert!(last.error.as_ref().unwrap().contains("already exists"));

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn overwrite_replaces_existing() {
        let src_dir = test_dir("overwrite_src");
        let dest_dir = test_dir("overwrite_dest");
        let file = src_dir.join("file.txt");
        fs::write(&file, "new content").unwrap();
        fs::write(dest_dir.join("file.txt"), "old").unwrap();

        let snaps = collect_snapshots("t5", file.to_str().unwrap(), dest_dir.to_str().unwrap(), TransferType::Copy, true, None);

        let last = snaps.last().unwrap();
        assert_eq!(last.status, TransferStatus::Completed);
        assert_eq!(fs::read_to_string(dest_dir.join("file.txt")).unwrap(), "new content");

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn cancel_signal_stops_transfer() {
        let src_dir = test_dir("cancel_src");
        let dest_dir = test_dir("cancel_dest");
        let file = src_dir.join("big.bin");
        // File must span multiple chunks so check_signal runs between reads
        fs::write(&file, vec![0u8; TRANSFER_CHUNK_SIZE + 1024]).unwrap();

        let id = "t-cancel".to_string();
        std::thread::spawn(move || {
            loop {
                if controller::set_signal(&id, controller::SIGNAL_CANCEL) {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(1));
            }
        });

        let snaps = collect_snapshots("t-cancel", file.to_str().unwrap(), dest_dir.to_str().unwrap(), TransferType::Copy, false, None);

        let last = snaps.last().unwrap();
        assert_eq!(last.status, TransferStatus::Cancelled);

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn copy_directory_recursively() {
        let src_dir = test_dir("copydir_src");
        let dest_dir = test_dir("copydir_dest");
        fs::create_dir(src_dir.join("sub")).unwrap();
        fs::write(src_dir.join("a.txt"), "a").unwrap();
        fs::write(src_dir.join("sub").join("b.txt"), "b").unwrap();

        let snaps = collect_snapshots("t6", src_dir.to_str().unwrap(), dest_dir.to_str().unwrap(), TransferType::Copy, false, None);

        let last = snaps.last().unwrap();
        assert_eq!(last.status, TransferStatus::Completed);

        let copied_name = src_dir.file_name().unwrap();
        assert!(dest_dir.join(copied_name).join("a.txt").exists());
        assert!(dest_dir.join(copied_name).join("sub").join("b.txt").exists());

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn new_name_renames_at_destination() {
        let src_dir = test_dir("rename_src");
        let dest_dir = test_dir("rename_dest");
        let file = src_dir.join("original.txt");
        fs::write(&file, "data").unwrap();

        let snaps = collect_snapshots("t7", file.to_str().unwrap(), dest_dir.to_str().unwrap(), TransferType::Copy, false, Some("renamed.txt"));

        let last = snaps.last().unwrap();
        assert_eq!(last.status, TransferStatus::Completed);
        assert!(dest_dir.join("renamed.txt").exists());
        assert!(!dest_dir.join("original.txt").exists());

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn progress_reports_correct_values() {
        let src_dir = test_dir("progress_src");
        let dest_dir = test_dir("progress_dest");
        let file = src_dir.join("data.bin");
        fs::write(&file, vec![42u8; 256]).unwrap();

        let snaps = collect_snapshots("t8", file.to_str().unwrap(), dest_dir.to_str().unwrap(), TransferType::Copy, false, None);

        assert!(snaps.len() >= 2);
        let first = &snaps[0];
        assert_eq!(first.status, TransferStatus::Running);
        assert_eq!(first.bytes_transferred, 0);

        let last = snaps.last().unwrap();
        assert_eq!(last.status, TransferStatus::Completed);
        assert_eq!(last.bytes_transferred, 256);
        assert_eq!(last.total_bytes, 256);

        let _ = fs::remove_dir_all(&src_dir);
        let _ = fs::remove_dir_all(&dest_dir);
    }

    #[test]
    fn calculate_total_size_file() {
        let dir = test_dir("size_file");
        let file = dir.join("test.bin");
        fs::write(&file, vec![0u8; 1000]).unwrap();
        assert_eq!(calculate_total_size(&file).unwrap(), 1000);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn calculate_total_size_directory() {
        let dir = test_dir("size_dir");
        fs::create_dir(dir.join("sub")).unwrap();
        fs::write(dir.join("a.bin"), vec![0u8; 500]).unwrap();
        fs::write(dir.join("sub").join("b.bin"), vec![0u8; 300]).unwrap();
        assert_eq!(calculate_total_size(&dir).unwrap(), 800);
        let _ = fs::remove_dir_all(&dir);
    }
}
