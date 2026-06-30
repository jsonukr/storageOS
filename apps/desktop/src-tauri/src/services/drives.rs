//! Local drive detection for Windows.
//!
//! Uses the Windows API (`GetLogicalDriveStringsW`, `GetDriveTypeW`,
//! `GetDiskFreeSpaceExW`, `GetVolumeInformationW`) to enumerate
//! all mounted drives and collect metadata.

use serde::Serialize;

use crate::errors::BridgeError;

/// Type of drive as reported by Windows `GetDriveType`.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DriveType {
    Fixed,
    Removable,
    Network,
    CdRom,
    RamDisk,
    Unknown,
}

/// Information about a single local drive.
#[derive(Debug, Clone, Serialize)]
pub struct LocalDrive {
    /// Drive letter (e.g. "C").
    pub letter: String,
    /// Volume label (e.g. "Windows", "USB Drive"). Empty if none.
    pub label: String,
    /// Drive type classification.
    pub drive_type: DriveType,
    /// Total capacity in bytes.
    pub total_bytes: u64,
    /// Free space in bytes.
    pub free_bytes: u64,
    /// Used space in bytes.
    pub used_bytes: u64,
    /// File system name (e.g. "NTFS", "FAT32", "exFAT").
    pub file_system: String,
    /// Whether this is a removable drive (USB, SD card, etc.).
    pub is_removable: bool,
    /// Whether the drive is ready (mounted and accessible).
    pub is_ready: bool,
}

/// Enumerate all local drives on the system.
///
/// On Windows, this uses Win32 APIs. On other platforms, returns an
/// empty list (future: implement for Linux/macOS).
pub fn list_local_drives() -> Result<Vec<LocalDrive>, BridgeError> {
    #[cfg(target_os = "windows")]
    {
        list_drives_windows()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[cfg(target_os = "windows")]
fn list_drives_windows() -> Result<Vec<LocalDrive>, BridgeError> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    // Get drive strings — returns "C:\\\0D:\\\0\0"
    let buffer_len = unsafe { windows_sys::Win32::Storage::FileSystem::GetLogicalDriveStringsW(0, std::ptr::null_mut()) };

    if buffer_len == 0 {
        return Err(BridgeError::io_error("Failed to query logical drives"));
    }

    let mut buffer: Vec<u16> = vec![0u16; buffer_len as usize];
    let written = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetLogicalDriveStringsW(
            buffer_len,
            buffer.as_mut_ptr(),
        )
    };

    if written == 0 {
        return Err(BridgeError::io_error("Failed to enumerate logical drives"));
    }

    // Parse null-separated drive roots
    let drive_roots: Vec<String> = buffer[..written as usize]
        .split(|&c| c == 0)
        .filter(|s| !s.is_empty())
        .map(|s| OsString::from_wide(s).to_string_lossy().into_owned())
        .collect();

    let mut drives = Vec::new();

    for root in &drive_roots {
        match probe_drive(root) {
            Ok(drive) => drives.push(drive),
            Err(_) => {
                // Drive exists but isn't ready (e.g. empty card reader)
                // Skip silently
            }
        }
    }

    Ok(drives)
}

#[cfg(target_os = "windows")]
fn probe_drive(root: &str) -> Result<LocalDrive, BridgeError> {
    let root_wide: Vec<u16> = root.encode_utf16().chain(std::iter::once(0)).collect();

    // Get drive type
    let raw_type = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(root_wide.as_ptr())
    };

    let drive_type = match raw_type {
        windows_sys::Win32::System::WindowsProgramming::DRIVE_FIXED => DriveType::Fixed,
        windows_sys::Win32::System::WindowsProgramming::DRIVE_REMOVABLE => DriveType::Removable,
        windows_sys::Win32::System::WindowsProgramming::DRIVE_REMOTE => DriveType::Network,
        windows_sys::Win32::System::WindowsProgramming::DRIVE_CDROM => DriveType::CdRom,
        windows_sys::Win32::System::WindowsProgramming::DRIVE_RAMDISK => DriveType::RamDisk,
        _ => DriveType::Unknown,
    };

    // Get volume label and file system
    let mut label_buf: [u16; 261] = [0; 261];
    let mut fs_buf: [u16; 261] = [0; 261];

    let vol_ok = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetVolumeInformationW(
            root_wide.as_ptr(),
            label_buf.as_mut_ptr(),
            label_buf.len() as u32,
            std::ptr::null_mut(), // serial number
            std::ptr::null_mut(), // max component length
            std::ptr::null_mut(), // fs flags
            fs_buf.as_mut_ptr(),
            fs_buf.len() as u32,
        )
    };

    if vol_ok == 0 {
        // Drive not ready (e.g. empty CD-ROM)
        return Err(BridgeError::io_error(format!("Drive {root} is not ready")));
    }

    let label = wide_to_string(&label_buf);
    let file_system = wide_to_string(&fs_buf);

    // Get disk space
    let mut free_bytes_available: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free_bytes: u64 = 0;

    let space_ok = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
            root_wide.as_ptr(),
            &mut free_bytes_available as *mut u64 as *mut _,
            &mut total_bytes as *mut u64 as *mut _,
            &mut total_free_bytes as *mut u64 as *mut _,
        )
    };

    if space_ok == 0 {
        return Err(BridgeError::io_error(format!(
            "Failed to read disk space for {root}"
        )));
    }

    // Extract drive letter from root like "C:\\"
    let letter = root
        .chars()
        .next()
        .map(|c| c.to_uppercase().to_string())
        .unwrap_or_default();

    let is_removable = drive_type == DriveType::Removable;

    Ok(LocalDrive {
        letter,
        label,
        drive_type,
        total_bytes,
        free_bytes: total_free_bytes,
        used_bytes: total_bytes.saturating_sub(total_free_bytes),
        file_system,
        is_removable,
        is_ready: true,
    })
}

#[cfg(target_os = "windows")]
fn wide_to_string(buf: &[u16]) -> String {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    OsString::from_wide(&buf[..end])
        .to_string_lossy()
        .into_owned()
}
