/// Characters forbidden in filenames on Windows.
pub const INVALID_FILENAME_CHARS: &[char] = &['\\', '/', ':', '*', '?', '"', '<', '>', '|'];

/// Maximum filename length (NTFS limit).
pub const MAX_FILENAME_LENGTH: usize = 255;

/// Windows reserved device names that cannot be used as filenames.
const RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Returns true if the filename contains no invalid characters and is not empty.
pub fn is_valid_filename(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_FILENAME_LENGTH
        && !name.chars().any(|c| INVALID_FILENAME_CHARS.contains(&c))
        && !is_reserved_name(name)
        && !name.ends_with('.')
        && !name.ends_with(' ')
}

/// Returns an error message if the filename is invalid, or None if valid.
pub fn validate_filename(name: &str) -> Option<&'static str> {
    if name.is_empty() {
        return Some("Name cannot be empty");
    }
    if name.len() > MAX_FILENAME_LENGTH {
        return Some("Name is too long");
    }
    if name.chars().any(|c| INVALID_FILENAME_CHARS.contains(&c)) {
        return Some("Name contains invalid characters");
    }
    if is_reserved_name(name) {
        return Some("Name is a reserved system name");
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Some("Name cannot end with a dot or space");
    }
    None
}

fn is_reserved_name(name: &str) -> bool {
    let stem = match name.find('.') {
        Some(i) => &name[..i],
        None => name,
    };
    RESERVED_NAMES.iter().any(|r| r.eq_ignore_ascii_case(stem))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_filenames() {
        assert!(is_valid_filename("document.txt"));
        assert!(is_valid_filename("my-file_v2 (copy)"));
        assert!(is_valid_filename("日本語ファイル.pdf"));
    }

    #[test]
    fn invalid_filenames() {
        assert!(!is_valid_filename(""));
        assert!(!is_valid_filename("file?.txt"));
        assert!(!is_valid_filename("path/name"));
        assert!(!is_valid_filename("name."));
        assert!(!is_valid_filename("name "));
        assert!(!is_valid_filename("CON"));
        assert!(!is_valid_filename("con.txt"));
        assert!(!is_valid_filename("LPT1"));
    }
}
