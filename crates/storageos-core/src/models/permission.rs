use serde::{Deserialize, Serialize};

/// Per-device permissions granted by the Account owner.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct DevicePermissions {
    pub read: bool,
    pub write: bool,
    pub delete: bool,
    pub transfer_send: bool,
    pub transfer_receive: bool,
    pub clipboard_read: bool,
    pub clipboard_write: bool,
    pub search: bool,
    pub notifications: bool,
    pub settings_read: bool,
    pub settings_write: bool,
    pub device_manage: bool,
    pub provider_manage: bool,
}

impl Default for DevicePermissions {
    fn default() -> Self {
        Self {
            read: true,
            write: true,
            delete: true,
            transfer_send: true,
            transfer_receive: true,
            clipboard_read: true,
            clipboard_write: true,
            search: true,
            notifications: true,
            settings_read: true,
            settings_write: false,
            device_manage: false,
            provider_manage: false,
        }
    }
}
