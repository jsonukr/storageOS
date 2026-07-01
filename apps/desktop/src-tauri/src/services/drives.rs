//! Local drive detection adapter.
//!
//! `LocalDrive` / `DriveType` serialize with the field names the
//! TypeScript frontend expects. The business logic lives in
//! `storageos_core::filesystem::list_roots`.

use serde::Serialize;

use crate::errors::BridgeError;
use storageos_core::models::{ProviderId, Root, RootId, RootKind, RootMetadata, StorageCapacity};

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

#[derive(Debug, Clone, Serialize)]
pub struct LocalDrive {
    pub letter: String,
    pub label: String,
    pub drive_type: DriveType,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub file_system: String,
    pub is_removable: bool,
    pub is_ready: bool,
}

impl From<LocalDrive> for Root {
    fn from(d: LocalDrive) -> Self {
        Self {
            id: RootId::new(&d.letter),
            name: if d.label.is_empty() {
                format!("Local Disk ({}:)", d.letter)
            } else {
                format!("{} ({}:)", d.label, d.letter)
            },
            kind: match d.drive_type {
                DriveType::Network => RootKind::Mount,
                _ => RootKind::Drive,
            },
            provider: ProviderId::new("local"),
            capacity: Some(StorageCapacity {
                total_bytes: d.total_bytes,
                free_bytes: d.free_bytes,
                used_bytes: d.used_bytes,
            }),
            metadata: RootMetadata {
                file_system: Some(d.file_system),
                is_removable: Some(d.is_removable),
                is_ready: Some(d.is_ready),
                ..Default::default()
            },
        }
    }
}

impl From<Root> for LocalDrive {
    fn from(r: Root) -> Self {
        let letter = r
            .metadata
            .custom
            .get("drive_letter")
            .cloned()
            .unwrap_or_else(|| r.id.0.clone());

        let label = r
            .metadata
            .custom
            .get("volume_label")
            .cloned()
            .unwrap_or_default();

        let drive_type = match r
            .metadata
            .custom
            .get("windows_drive_type")
            .map(|s| s.as_str())
        {
            Some("fixed") => DriveType::Fixed,
            Some("removable") => DriveType::Removable,
            Some("network") => DriveType::Network,
            Some("cdrom") => DriveType::CdRom,
            Some("ramdisk") => DriveType::RamDisk,
            _ => DriveType::Unknown,
        };

        let (total_bytes, free_bytes, used_bytes) = r
            .capacity
            .map(|c| (c.total_bytes, c.free_bytes, c.used_bytes))
            .unwrap_or((0, 0, 0));

        Self {
            letter,
            label,
            drive_type,
            total_bytes,
            free_bytes,
            used_bytes,
            file_system: r.metadata.file_system.unwrap_or_default(),
            is_removable: r.metadata.is_removable.unwrap_or(false),
            is_ready: r.metadata.is_ready.unwrap_or(false),
        }
    }
}

pub fn list_local_drives() -> Result<Vec<LocalDrive>, BridgeError> {
    let roots = storageos_core::filesystem::list_roots()?;
    Ok(roots.into_iter().map(LocalDrive::from).collect())
}
