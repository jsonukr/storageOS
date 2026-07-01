const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB", "PB"];

/// Format a byte count into a human-readable string.
///
/// Examples: `0` → `"0 B"`, `1536` → `"1.5 KB"`, `1073741824` → `"1.0 GB"`
pub fn format_bytes(bytes: u64) -> String {
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

/// Format a transfer speed in bytes/second into a human-readable string.
///
/// Examples: `0.0` → `"0 B/s"`, `1048576.0` → `"1.0 MB/s"`
pub fn format_speed(bytes_per_second: f64) -> String {
    if bytes_per_second <= 0.0 {
        return "0 B/s".to_string();
    }
    let i = bytes_per_second.log(1024.0).floor() as usize;
    let i = i.min(UNITS.len() - 1);
    let value = bytes_per_second / (1024_f64).powi(i as i32);
    if i == 0 {
        format!("{:.0} B/s", bytes_per_second)
    } else {
        format!("{value:.1} {}/s", UNITS[i])
    }
}

/// Format a duration in milliseconds into a human-readable remaining time.
///
/// Examples: `500` → `"< 1s"`, `65000` → `"1m 5s"`, `3661000` → `"1h 1m"`
pub fn format_remaining(ms: u64) -> String {
    if ms == 0 {
        return "Done".to_string();
    }
    let secs = ms / 1000;
    if secs < 1 {
        return "< 1s".to_string();
    }
    let hours = secs / 3600;
    let minutes = (secs % 3600) / 60;
    let seconds = secs % 60;
    if hours > 0 {
        format!("{hours}h {minutes}m")
    } else if minutes > 0 {
        format!("{minutes}m {seconds}s")
    } else {
        format!("{seconds}s")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bytes_formatting() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(512), "512 B");
        assert_eq!(format_bytes(1024), "1.0 KB");
        assert_eq!(format_bytes(1536), "1.5 KB");
        assert_eq!(format_bytes(1_073_741_824), "1.0 GB");
    }

    #[test]
    fn speed_formatting() {
        assert_eq!(format_speed(0.0), "0 B/s");
        assert_eq!(format_speed(1_048_576.0), "1.0 MB/s");
    }

    #[test]
    fn remaining_formatting() {
        assert_eq!(format_remaining(0), "Done");
        assert_eq!(format_remaining(500), "< 1s");
        assert_eq!(format_remaining(5000), "5s");
        assert_eq!(format_remaining(65_000), "1m 5s");
        assert_eq!(format_remaining(3_661_000), "1h 1m");
    }
}
