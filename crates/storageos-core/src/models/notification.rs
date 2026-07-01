use serde::{Deserialize, Serialize};

/// Strongly typed notification identifier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct NotificationId(pub String);

impl NotificationId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

/// Notification priority level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Normal,
    High,
    Critical,
}

/// Delivery target for a notification.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NotificationTarget {
    AllDevices,
    Device(super::DeviceId),
}
