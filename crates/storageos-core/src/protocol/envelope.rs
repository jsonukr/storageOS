use serde::{Deserialize, Serialize};

use crate::models::device::DeviceId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProtocolVersion {
    pub major: u16,
    pub minor: u16,
}

impl ProtocolVersion {
    pub const fn new(major: u16, minor: u16) -> Self {
        Self { major, minor }
    }

    pub fn is_compatible(&self, other: &ProtocolVersion) -> bool {
        self.major == other.major
    }
}

impl std::fmt::Display for ProtocolVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}", self.major, self.minor)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct MessageId(pub String);

impl MessageId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageKind {
    Hello,
    Auth,
    Ping,
    Pong,
    Request,
    Response,
    Event,
    Transfer,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub version: ProtocolVersion,
    pub id: MessageId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<MessageId>,
    pub timestamp: i64,
    pub source: DeviceId,
    pub destination: DeviceId,
    pub kind: MessageKind,
    pub payload: super::payloads::Payload,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_compatibility() {
        let v1_0 = ProtocolVersion::new(1, 0);
        let v1_1 = ProtocolVersion::new(1, 1);
        let v2_0 = ProtocolVersion::new(2, 0);

        assert!(v1_0.is_compatible(&v1_1));
        assert!(!v1_0.is_compatible(&v2_0));
    }

    #[test]
    fn version_display() {
        assert_eq!(ProtocolVersion::new(1, 0).to_string(), "1.0");
    }

    #[test]
    fn message_id_equality() {
        let a = MessageId::new("msg-001");
        let b = MessageId::new("msg-001");
        assert_eq!(a, b);
    }
}
