//! Platform detection and abstraction.
//!
//! Provides a clean `Platform` enum so the rest of the codebase can
//! branch on platform identity without scattered `#[cfg(target_os)]` gates.

use serde::{Deserialize, Serialize};

/// The platform the current binary was compiled for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Windows,
    Linux,
    #[serde(rename = "macos")]
    MacOS,
    Android,
    #[serde(rename = "ios")]
    IOS,
}

impl Platform {
    /// Returns the platform this binary was compiled for.
    pub fn current() -> Self {
        #[cfg(target_os = "windows")]
        { Platform::Windows }
        #[cfg(target_os = "linux")]
        {
            #[cfg(target_os = "android")]
            { return Platform::Android; }
            #[cfg(not(target_os = "android"))]
            { Platform::Linux }
        }
        #[cfg(target_os = "macos")]
        { Platform::MacOS }
        #[cfg(target_os = "ios")]
        { Platform::IOS }
        #[cfg(not(any(
            target_os = "windows",
            target_os = "linux",
            target_os = "macos",
            target_os = "ios"
        )))]
        { Platform::Linux }
    }

    pub fn is_windows(self) -> bool {
        self == Platform::Windows
    }

    pub fn is_linux(self) -> bool {
        self == Platform::Linux
    }

    pub fn is_macos(self) -> bool {
        self == Platform::MacOS
    }

    pub fn is_desktop(self) -> bool {
        matches!(self, Platform::Windows | Platform::Linux | Platform::MacOS)
    }

    pub fn is_mobile(self) -> bool {
        matches!(self, Platform::Android | Platform::IOS)
    }

    /// The native path separator for this platform.
    pub fn path_separator(self) -> char {
        if self.is_windows() { '\\' } else { '/' }
    }

    /// Human-readable display name.
    pub fn display_name(self) -> &'static str {
        match self {
            Platform::Windows => "Windows",
            Platform::Linux => "Linux",
            Platform::MacOS => "macOS",
            Platform::Android => "Android",
            Platform::IOS => "iOS",
        }
    }
}

impl std::fmt::Display for Platform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.display_name())
    }
}
