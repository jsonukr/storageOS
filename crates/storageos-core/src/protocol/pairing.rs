use serde::{Deserialize, Serialize};

const PAIR_CODE_CHARSET: &[u8] = b"23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const PAIR_CODE_LENGTH: usize = 12;
const PAIR_CODE_GROUP_SIZE: usize = 4;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrPayloadV2 {
    pub v: u8,
    pub id: String,
    pub pk: String,
    pub fp: String,
    pub name: String,
    pub code: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub caps: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relay: Option<String>,
    pub ts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sig: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<QrLanHint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrLanHint {
    pub lan: String,
}

impl QrPayloadV2 {
    pub fn sign_data(&self) -> String {
        format!("{}|{}|{}|{}", self.id, self.pk, self.fp, self.ts)
    }
}

pub fn generate_pair_code(random_bytes: &[u8; 12]) -> String {
    let chars: Vec<char> = random_bytes
        .iter()
        .map(|b| PAIR_CODE_CHARSET[(*b as usize) % PAIR_CODE_CHARSET.len()] as char)
        .collect();

    chars
        .chunks(PAIR_CODE_GROUP_SIZE)
        .map(|chunk| chunk.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn normalize_pair_code(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

pub fn validate_pair_code(code: &str) -> bool {
    let normalized = normalize_pair_code(code);
    if normalized.len() != PAIR_CODE_LENGTH {
        return false;
    }
    normalized
        .bytes()
        .all(|b| PAIR_CODE_CHARSET.contains(&b))
}

pub fn format_pair_code(raw: &str) -> String {
    let normalized = normalize_pair_code(raw);
    normalized
        .as_bytes()
        .chunks(PAIR_CODE_GROUP_SIZE)
        .map(|chunk| std::str::from_utf8(chunk).unwrap_or(""))
        .collect::<Vec<_>>()
        .join("-")
}

pub fn detect_qr_version(json: &str) -> u8 {
    if json.contains("\"v\":2") || json.contains("\"v\": 2") {
        2
    } else {
        1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pair_code_generation() {
        let bytes = [0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        let code = generate_pair_code(&bytes);
        assert_eq!(code.len(), 14); // 12 chars + 2 dashes
        assert!(code.chars().filter(|c| *c == '-').count() == 2);
    }

    #[test]
    fn pair_code_validation() {
        assert!(validate_pair_code("4H7K-9Q2M-XP83"));
        assert!(validate_pair_code("4H7K9Q2MXP83"));
        assert!(!validate_pair_code("4H7K-9Q2M")); // too short
        assert!(!validate_pair_code("0000-1111-LLLL")); // ambiguous chars
    }

    #[test]
    fn pair_code_normalization() {
        assert_eq!(normalize_pair_code("4h7k-9q2m-xp83"), "4H7K9Q2MXP83");
        assert_eq!(normalize_pair_code("  4H7K  9Q2M  XP83  "), "4H7K9Q2MXP83");
    }

    #[test]
    fn pair_code_formatting() {
        assert_eq!(format_pair_code("4H7K9Q2MXP83"), "4H7K-9Q2M-XP83");
    }

    #[test]
    fn qr_version_detection() {
        assert_eq!(detect_qr_version(r#"{"v":2,"id":"abc"}"#), 2);
        assert_eq!(detect_qr_version(r#"{"host":"192.168.1.1","port":19742}"#), 1);
    }
}
