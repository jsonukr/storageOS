use serde::Serialize;
use std::io::{Read, Write};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

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

fn emit_progress(app: &AppHandle, payload: TransferProgressPayload) {
    let _ = app.emit("transfer:progress", payload);
}

fn fail(app: &AppHandle, id: &str, elapsed_ms: u64, msg: String) {
    storageos_core::transfer::unregister(id);
    emit_progress(app, TransferProgressPayload {
        transfer_id: id.to_string(),
        status: "failed".to_string(),
        bytes_transferred: 0,
        total_bytes: 0,
        progress: 0.0,
        speed_bytes_per_second: 0.0,
        estimated_remaining_ms: 0,
        elapsed_ms,
        error: Some(msg),
    });
}

pub fn execute_remote_download(
    app: &AppHandle,
    transfer_id: &str,
    url: &str,
    dest_path: &str,
) {
    let _signal = storageos_core::transfer::register(transfer_id);

    let response = match ureq::get(url).call() {
        Ok(r) => r,
        Err(e) => {
            fail(app, transfer_id, 0, format!("Connection failed: {e}"));
            return;
        }
    };

    let total_bytes = response
        .header("content-length")
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);

    let mut reader = response.into_reader();
    let mut file = match std::fs::File::create(dest_path) {
        Ok(f) => f,
        Err(e) => {
            fail(app, transfer_id, 0, format!("Cannot create file: {e}"));
            return;
        }
    };

    let mut buffer = [0u8; 8192];
    let mut bytes_written: u64 = 0;
    let start = Instant::now();
    let mut last_emit = start;

    loop {
        if storageos_core::transfer::get_signal(transfer_id)
            == Some(storageos_core::transfer::SIGNAL_CANCEL)
        {
            let _ = std::fs::remove_file(dest_path);
            storageos_core::transfer::unregister(transfer_id);
            emit_progress(app, TransferProgressPayload {
                transfer_id: transfer_id.to_string(),
                status: "cancelled".to_string(),
                bytes_transferred: bytes_written,
                total_bytes,
                progress: 0.0,
                speed_bytes_per_second: 0.0,
                estimated_remaining_ms: 0,
                elapsed_ms: start.elapsed().as_millis() as u64,
                error: None,
            });
            return;
        }

        let n = match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) => {
                let _ = std::fs::remove_file(dest_path);
                fail(app, transfer_id, start.elapsed().as_millis() as u64, format!("Read error: {e}"));
                return;
            }
        };

        if let Err(e) = file.write_all(&buffer[..n]) {
            let _ = std::fs::remove_file(dest_path);
            fail(app, transfer_id, start.elapsed().as_millis() as u64, format!("Write error: {e}"));
            return;
        }

        bytes_written += n as u64;
        let now = Instant::now();
        if now.duration_since(last_emit).as_millis() >= 200 {
            let elapsed_ms = start.elapsed().as_millis() as u64;
            let speed = if elapsed_ms > 0 {
                bytes_written as f64 * 1000.0 / elapsed_ms as f64
            } else {
                0.0
            };
            let progress = if total_bytes > 0 {
                bytes_written as f64 / total_bytes as f64 * 100.0
            } else {
                0.0
            };
            let remaining = if speed > 0.0 && total_bytes > 0 {
                ((total_bytes - bytes_written) as f64 / speed * 1000.0) as u64
            } else {
                0
            };

            emit_progress(app, TransferProgressPayload {
                transfer_id: transfer_id.to_string(),
                status: "running".to_string(),
                bytes_transferred: bytes_written,
                total_bytes,
                progress,
                speed_bytes_per_second: speed,
                estimated_remaining_ms: remaining,
                elapsed_ms,
                error: None,
            });
            last_emit = now;
        }
    }

    storageos_core::transfer::unregister(transfer_id);
    emit_progress(app, TransferProgressPayload {
        transfer_id: transfer_id.to_string(),
        status: "completed".to_string(),
        bytes_transferred: bytes_written,
        total_bytes: bytes_written,
        progress: 100.0,
        speed_bytes_per_second: 0.0,
        estimated_remaining_ms: 0,
        elapsed_ms: start.elapsed().as_millis() as u64,
        error: None,
    });
}

pub fn execute_remote_upload(
    app: &AppHandle,
    transfer_id: &str,
    source_path: &str,
    remote_upload_url: &str,
) {
    let _signal = storageos_core::transfer::register(transfer_id);

    let file_meta = match std::fs::metadata(source_path) {
        Ok(m) => m,
        Err(e) => {
            fail(app, transfer_id, 0, format!("Cannot read file: {e}"));
            return;
        }
    };

    let mut file = match std::fs::File::open(source_path) {
        Ok(f) => f,
        Err(e) => {
            fail(app, transfer_id, 0, format!("Cannot open file: {e}"));
            return;
        }
    };

    let file_name = std::path::Path::new(source_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "upload".to_string());

    let total_bytes = file_meta.len();
    let start = Instant::now();

    let boundary = format!("----StorageOS{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    let header = format!(
        "--{boundary}\r\n\
         Content-Disposition: form-data; name=\"file\"; filename=\"{file_name}\"\r\n\
         Content-Type: application/octet-stream\r\n\r\n"
    );
    let footer = format!("\r\n--{boundary}--\r\n");
    let content_length = header.len() as u64 + total_bytes + footer.len() as u64;

    let content_type = format!("multipart/form-data; boundary={boundary}");

    let app_clone = app.clone();
    let tid = transfer_id.to_string();

    let pipe_reader = std::io::BufReader::new(PipeRead {
        header: header.into_bytes(),
        header_pos: 0,
        file: &mut file,
        file_bytes_read: 0,
        total_file_bytes: total_bytes,
        footer: footer.into_bytes(),
        footer_pos: 0,
        phase: PipePhase::Header,
        app: &app_clone,
        transfer_id: &tid,
        start,
        last_emit: start,
    });

    match ureq::post(remote_upload_url)
        .set("Content-Type", &content_type)
        .set("Content-Length", &content_length.to_string())
        .send(pipe_reader)
    {
        Ok(_) => {
            storageos_core::transfer::unregister(transfer_id);
            emit_progress(app, TransferProgressPayload {
                transfer_id: transfer_id.to_string(),
                status: "completed".to_string(),
                bytes_transferred: total_bytes,
                total_bytes,
                progress: 100.0,
                speed_bytes_per_second: 0.0,
                estimated_remaining_ms: 0,
                elapsed_ms: start.elapsed().as_millis() as u64,
                error: None,
            });
        }
        Err(e) => {
            fail(app, transfer_id, start.elapsed().as_millis() as u64, format!("Upload failed: {e}"));
        }
    }
}

enum PipePhase {
    Header,
    File,
    Footer,
    Done,
}

struct PipeRead<'a> {
    header: Vec<u8>,
    header_pos: usize,
    file: &'a mut std::fs::File,
    file_bytes_read: u64,
    total_file_bytes: u64,
    footer: Vec<u8>,
    footer_pos: usize,
    phase: PipePhase,
    app: &'a AppHandle,
    transfer_id: &'a str,
    start: Instant,
    last_emit: Instant,
}

impl<'a> Read for PipeRead<'a> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if storageos_core::transfer::get_signal(self.transfer_id)
            == Some(storageos_core::transfer::SIGNAL_CANCEL)
        {
            storageos_core::transfer::unregister(self.transfer_id);
            emit_progress(self.app, TransferProgressPayload {
                transfer_id: self.transfer_id.to_string(),
                status: "cancelled".to_string(),
                bytes_transferred: self.file_bytes_read,
                total_bytes: self.total_file_bytes,
                progress: 0.0,
                speed_bytes_per_second: 0.0,
                estimated_remaining_ms: 0,
                elapsed_ms: self.start.elapsed().as_millis() as u64,
                error: None,
            });
            return Err(std::io::Error::new(std::io::ErrorKind::Interrupted, "cancelled"));
        }

        match self.phase {
            PipePhase::Header => {
                let remaining = &self.header[self.header_pos..];
                let n = remaining.len().min(buf.len());
                buf[..n].copy_from_slice(&remaining[..n]);
                self.header_pos += n;
                if self.header_pos >= self.header.len() {
                    self.phase = PipePhase::File;
                }
                Ok(n)
            }
            PipePhase::File => {
                let n = self.file.read(buf)?;
                if n == 0 {
                    self.phase = PipePhase::Footer;
                    return self.read(buf);
                }
                self.file_bytes_read += n as u64;

                let now = Instant::now();
                if now.duration_since(self.last_emit).as_millis() >= 200 {
                    let elapsed_ms = self.start.elapsed().as_millis() as u64;
                    let speed = if elapsed_ms > 0 {
                        self.file_bytes_read as f64 * 1000.0 / elapsed_ms as f64
                    } else {
                        0.0
                    };
                    let progress = if self.total_file_bytes > 0 {
                        self.file_bytes_read as f64 / self.total_file_bytes as f64 * 100.0
                    } else {
                        0.0
                    };
                    let remaining = if speed > 0.0 && self.total_file_bytes > 0 {
                        ((self.total_file_bytes - self.file_bytes_read) as f64 / speed * 1000.0) as u64
                    } else {
                        0
                    };

                    emit_progress(self.app, TransferProgressPayload {
                        transfer_id: self.transfer_id.to_string(),
                        status: "running".to_string(),
                        bytes_transferred: self.file_bytes_read,
                        total_bytes: self.total_file_bytes,
                        progress,
                        speed_bytes_per_second: speed,
                        estimated_remaining_ms: remaining,
                        elapsed_ms,
                        error: None,
                    });
                    self.last_emit = now;
                }
                Ok(n)
            }
            PipePhase::Footer => {
                let remaining = &self.footer[self.footer_pos..];
                let n = remaining.len().min(buf.len());
                buf[..n].copy_from_slice(&remaining[..n]);
                self.footer_pos += n;
                if self.footer_pos >= self.footer.len() {
                    self.phase = PipePhase::Done;
                }
                Ok(n)
            }
            PipePhase::Done => Ok(0),
        }
    }
}
