use std::path::Path;

use crate::errors::{CoreError, CoreResult};
use crate::models::EntryMetadata;

pub fn get_attributes(path: &str) -> CoreResult<EntryMetadata> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(CoreError::not_found(format!("Item not found: {path}")));
    }

    #[cfg(target_os = "windows")]
    {
        let attrs = win::get_attrs(p)?;
        Ok(win::decode(attrs))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let meta = std::fs::metadata(p)?;
        Ok(EntryMetadata {
            hidden: Some(
                p.file_name()
                    .map(|n| n.to_string_lossy().starts_with('.'))
                    .unwrap_or(false),
            ),
            readonly: Some(meta.permissions().readonly()),
            system: Some(false),
            archive: Some(false),
            ..Default::default()
        })
    }
}

pub fn set_hidden(path: &str, hidden: bool) -> CoreResult<EntryMetadata> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(CoreError::not_found(format!("Item not found: {path}")));
    }

    #[cfg(target_os = "windows")]
    {
        let current = win::get_attrs(p)?;
        let updated = win::toggle_bit(current, win::HIDDEN_BIT, hidden);
        if updated != current {
            win::set_attrs(p, updated)?;
        }
        Ok(win::decode(updated))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = hidden;
        Err(CoreError::not_supported(
            "File attributes are not supported on this platform",
        ))
    }
}

pub fn set_readonly(path: &str, readonly: bool) -> CoreResult<EntryMetadata> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(CoreError::not_found(format!("Item not found: {path}")));
    }

    #[cfg(target_os = "windows")]
    {
        let current = win::get_attrs(p)?;
        let updated = win::toggle_bit(current, win::READONLY_BIT, readonly);
        if updated != current {
            win::set_attrs(p, updated)?;
        }
        Ok(win::decode(updated))
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let meta = std::fs::metadata(p)?;
        let mut perms = meta.permissions();
        let mode = perms.mode();
        if readonly {
            perms.set_mode(mode & !0o222);
        } else {
            perms.set_mode(mode | 0o644);
        }
        std::fs::set_permissions(p, perms)?;
        get_attributes(path)
    }
}

#[cfg(target_os = "windows")]
mod win {
    use std::path::Path;

    use crate::errors::{CoreError, CoreResult};
    use crate::models::EntryMetadata;

    const FILE_ATTRIBUTE_READONLY: u32 = 0x1;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;
    const FILE_ATTRIBUTE_ARCHIVE: u32 = 0x20;
    const INVALID_FILE_ATTRIBUTES: u32 = 0xFFFF_FFFF;

    fn to_wide(path: &Path) -> Vec<u16> {
        path.to_string_lossy()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect()
    }

    pub fn get_attrs(path: &Path) -> CoreResult<u32> {
        let wide = to_wide(path);
        let attrs = unsafe {
            windows_sys::Win32::Storage::FileSystem::GetFileAttributesW(wide.as_ptr())
        };
        if attrs == INVALID_FILE_ATTRIBUTES {
            return Err(CoreError::not_found(format!(
                "Cannot read attributes: {}",
                path.display()
            )));
        }
        Ok(attrs)
    }

    pub fn set_attrs(path: &Path, attrs: u32) -> CoreResult<()> {
        let wide = to_wide(path);
        let ok = unsafe {
            windows_sys::Win32::Storage::FileSystem::SetFileAttributesW(wide.as_ptr(), attrs)
        };
        if ok == 0 {
            return Err(CoreError::permission_denied(format!(
                "Cannot set attributes: {}",
                path.display()
            )));
        }
        Ok(())
    }

    pub fn decode(attrs: u32) -> EntryMetadata {
        EntryMetadata {
            hidden: Some(attrs & FILE_ATTRIBUTE_HIDDEN != 0),
            readonly: Some(attrs & FILE_ATTRIBUTE_READONLY != 0),
            system: Some(attrs & FILE_ATTRIBUTE_SYSTEM != 0),
            archive: Some(attrs & FILE_ATTRIBUTE_ARCHIVE != 0),
            ..Default::default()
        }
    }

    pub fn toggle_bit(current: u32, bit: u32, on: bool) -> u32 {
        if on {
            current | bit
        } else {
            current & !bit
        }
    }

    pub const HIDDEN_BIT: u32 = FILE_ATTRIBUTE_HIDDEN;
    pub const READONLY_BIT: u32 = FILE_ATTRIBUTE_READONLY;
}
