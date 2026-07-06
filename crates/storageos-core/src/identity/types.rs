use serde::{Deserialize, Serialize};

use crate::models::device::DeviceId;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeviceIdentity {
    pub device_id: DeviceId,
    pub public_key: String,
    pub fingerprint: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrustStatus {
    Pending,
    Trusted,
    Revoked,
}

impl TrustStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TrustStatus::Pending => "pending",
            TrustStatus::Trusted => "trusted",
            TrustStatus::Revoked => "revoked",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "trusted" => TrustStatus::Trusted,
            "revoked" => TrustStatus::Revoked,
            _ => TrustStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustRecord {
    pub device_id: DeviceId,
    pub friendly_name: String,
    pub public_key: String,
    pub fingerprint: String,
    pub paired_at: i64,
    pub last_verified: i64,
    pub trust_status: TrustStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCertificate {
    pub device_id: DeviceId,
    pub public_key: String,
    pub fingerprint: String,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issuer_device_id: Option<DeviceId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
    pub revoked: bool,
}

pub fn verify_identity(stored_public_key: &str, presented_public_key: &str) -> IdentityVerification {
    if stored_public_key.is_empty() || presented_public_key.is_empty() {
        return IdentityVerification::NoKey;
    }
    if stored_public_key == presented_public_key {
        IdentityVerification::Match
    } else {
        IdentityVerification::Mismatch
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityVerification {
    Match,
    Mismatch,
    NoKey,
}

pub fn format_fingerprint(bytes: &[u8]) -> String {
    if bytes.len() < 6 {
        return String::from("0000-0000-0000");
    }
    format!(
        "{:02X}{:02X}-{:02X}{:02X}-{:02X}{:02X}",
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verify_matching_keys() {
        let key = "abc123def456";
        assert_eq!(verify_identity(key, key), IdentityVerification::Match);
    }

    #[test]
    fn verify_mismatched_keys() {
        assert_eq!(
            verify_identity("key_a", "key_b"),
            IdentityVerification::Mismatch
        );
    }

    #[test]
    fn verify_empty_key() {
        assert_eq!(verify_identity("", "key"), IdentityVerification::NoKey);
        assert_eq!(verify_identity("key", ""), IdentityVerification::NoKey);
    }

    #[test]
    fn fingerprint_format() {
        let bytes = [0xA7, 0xF2, 0x19, 0xCD, 0x83, 0xAE];
        assert_eq!(format_fingerprint(&bytes), "A7F2-19CD-83AE");
    }

    #[test]
    fn fingerprint_short_input() {
        assert_eq!(format_fingerprint(&[0x01, 0x02]), "0000-0000-0000");
    }

    #[test]
    fn trust_status_roundtrip() {
        assert_eq!(TrustStatus::from_str("trusted"), TrustStatus::Trusted);
        assert_eq!(TrustStatus::from_str("revoked"), TrustStatus::Revoked);
        assert_eq!(TrustStatus::from_str("pending"), TrustStatus::Pending);
        assert_eq!(TrustStatus::from_str("unknown"), TrustStatus::Pending);
    }
}
