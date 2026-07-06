use ed25519_dalek::SigningKey;
use sha2::{Sha256, Digest};
use storageos_core::identity::format_fingerprint;

use crate::device_registry::DeviceRegistry;

pub struct DeviceKeys {
    pub public_key_hex: String,
    pub fingerprint: String,
}

pub fn ensure_keypair(registry: &DeviceRegistry) -> Result<DeviceKeys, String> {
    if let Some(pub_hex) = registry.get_identity("public_key")? {
        let fingerprint = registry
            .get_identity("fingerprint")?
            .unwrap_or_else(|| compute_fingerprint_from_hex(&pub_hex));
        return Ok(DeviceKeys {
            public_key_hex: pub_hex,
            fingerprint,
        });
    }

    let mut csprng = rand_core::OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();

    let secret_hex = hex_encode(signing_key.as_bytes());
    let public_hex = hex_encode(verifying_key.as_bytes());
    let fingerprint = compute_fingerprint_from_bytes(verifying_key.as_bytes());

    registry.set_identity("private_key", &secret_hex)?;
    registry.set_identity("public_key", &public_hex)?;
    registry.set_identity("fingerprint", &fingerprint)?;

    Ok(DeviceKeys {
        public_key_hex: public_hex,
        fingerprint,
    })
}

fn compute_fingerprint_from_bytes(public_key_bytes: &[u8]) -> String {
    let hash = Sha256::digest(public_key_bytes);
    format_fingerprint(&hash[..6])
}

fn compute_fingerprint_from_hex(hex_key: &str) -> String {
    let bytes = hex_decode(hex_key);
    compute_fingerprint_from_bytes(&bytes)
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn hex_decode(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .filter_map(|i| {
            hex.get(i..i + 2)
                .and_then(|byte_str| u8::from_str_radix(byte_str, 16).ok())
        })
        .collect()
}
