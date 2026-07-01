use crate::errors::{CoreError, CoreResult};
use crate::models::{ProviderId, Root, RootId, RootKind, RootMetadata, StorageCapacity};

pub fn list_roots() -> CoreResult<Vec<Root>> {
    #[cfg(target_os = "windows")]
    {
        list_roots_windows()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[cfg(target_os = "windows")]
fn list_roots_windows() -> CoreResult<Vec<Root>> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    let buffer_len = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetLogicalDriveStringsW(
            0,
            std::ptr::null_mut(),
        )
    };

    if buffer_len == 0 {
        return Err(CoreError::io_error("Failed to query logical drives"));
    }

    let mut buffer: Vec<u16> = vec![0u16; buffer_len as usize];
    let written = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetLogicalDriveStringsW(
            buffer_len,
            buffer.as_mut_ptr(),
        )
    };

    if written == 0 {
        return Err(CoreError::io_error("Failed to enumerate logical drives"));
    }

    let drive_roots: Vec<String> = buffer[..written as usize]
        .split(|&c| c == 0)
        .filter(|s| !s.is_empty())
        .map(|s| OsString::from_wide(s).to_string_lossy().into_owned())
        .collect();

    let mut roots = Vec::new();

    for root_path in &drive_roots {
        match probe_root(root_path) {
            Ok(root) => roots.push(root),
            Err(_) => {}
        }
    }

    Ok(roots)
}

#[cfg(target_os = "windows")]
fn probe_root(root_path: &str) -> CoreResult<Root> {
    let root_wide: Vec<u16> = root_path.encode_utf16().chain(std::iter::once(0)).collect();

    let raw_type = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(root_wide.as_ptr())
    };

    let (kind, drive_type_str) = match raw_type {
        windows_sys::Win32::System::WindowsProgramming::DRIVE_FIXED => {
            (RootKind::Drive, "fixed")
        }
        windows_sys::Win32::System::WindowsProgramming::DRIVE_REMOVABLE => {
            (RootKind::Drive, "removable")
        }
        windows_sys::Win32::System::WindowsProgramming::DRIVE_REMOTE => {
            (RootKind::Mount, "network")
        }
        windows_sys::Win32::System::WindowsProgramming::DRIVE_CDROM => {
            (RootKind::Drive, "cdrom")
        }
        windows_sys::Win32::System::WindowsProgramming::DRIVE_RAMDISK => {
            (RootKind::Drive, "ramdisk")
        }
        _ => (RootKind::Drive, "unknown"),
    };

    let mut label_buf: [u16; 261] = [0; 261];
    let mut fs_buf: [u16; 261] = [0; 261];

    let vol_ok = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetVolumeInformationW(
            root_wide.as_ptr(),
            label_buf.as_mut_ptr(),
            label_buf.len() as u32,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            fs_buf.as_mut_ptr(),
            fs_buf.len() as u32,
        )
    };

    if vol_ok == 0 {
        return Err(CoreError::io_error(format!(
            "Drive {root_path} is not ready"
        )));
    }

    let volume_label = wide_to_string(&label_buf);
    let file_system = wide_to_string(&fs_buf);

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
        return Err(CoreError::io_error(format!(
            "Failed to read disk space for {root_path}"
        )));
    }

    let letter = root_path
        .chars()
        .next()
        .map(|c| c.to_uppercase().to_string())
        .unwrap_or_default();

    let is_removable = drive_type_str == "removable";

    let display_name = if volume_label.is_empty() {
        format!("Local Disk ({letter}:)")
    } else {
        format!("{volume_label} ({letter}:)")
    };

    let mut metadata = RootMetadata {
        file_system: Some(file_system),
        is_removable: Some(is_removable),
        is_ready: Some(true),
        ..Default::default()
    };
    metadata
        .custom
        .insert("volume_label".to_string(), volume_label);
    metadata
        .custom
        .insert("windows_drive_type".to_string(), drive_type_str.to_string());
    metadata
        .custom
        .insert("drive_letter".to_string(), letter.clone());

    Ok(Root {
        id: RootId::new(&letter),
        name: display_name,
        kind,
        provider: ProviderId::new("local"),
        capacity: Some(StorageCapacity {
            total_bytes,
            free_bytes: total_free_bytes,
            used_bytes: total_bytes.saturating_sub(total_free_bytes),
        }),
        metadata,
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
