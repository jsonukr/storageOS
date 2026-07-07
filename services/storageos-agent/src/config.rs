use serde::Deserialize;
use std::path::{Path, PathBuf};
use storageos_core::config::constants::DEFAULT_AGENT_PORT;

#[derive(Debug, Clone, Deserialize)]
pub struct AgentConfig {
    #[serde(default)]
    pub server: ServerConfig,
    #[serde(default)]
    pub logging: LoggingConfig,
    #[serde(default)]
    pub database: DatabaseConfig,
    #[serde(default)]
    pub storage: StorageConfig,
    #[serde(default)]
    pub relay: RelayAgentConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_bind")]
    pub bind: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoggingConfig {
    #[serde(default = "default_log_level")]
    pub level: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    #[serde(default)]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StorageConfig {
    #[serde(default)]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RelayAgentConfig {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default = "default_heartbeat_interval")]
    pub heartbeat_interval_secs: u64,
    #[serde(default = "default_connection_timeout")]
    pub connection_timeout_secs: u64,
}

impl Default for RelayAgentConfig {
    fn default() -> Self {
        Self {
            url: Some(storageos_core::config::constants::DEFAULT_RELAY_URL.to_string()),
            heartbeat_interval_secs: default_heartbeat_interval(),
            connection_timeout_secs: default_connection_timeout(),
        }
    }
}

impl RelayAgentConfig {
    pub fn apply_env_overrides(&mut self) {
        if let Ok(url) = std::env::var("RELAY_URL") {
            if !url.is_empty() {
                self.url = Some(url);
            }
        }
    }
}

fn default_heartbeat_interval() -> u64 {
    storageos_core::config::constants::RELAY_HEARTBEAT_INTERVAL_SECS
}

fn default_connection_timeout() -> u64 {
    storageos_core::config::constants::RELAY_CONNECTION_TIMEOUT_SECS
}

fn default_port() -> u16 {
    DEFAULT_AGENT_PORT
}

fn default_bind() -> String {
    "127.0.0.1".to_string()
}

fn default_log_level() -> String {
    "info".to_string()
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            logging: LoggingConfig::default(),
            database: DatabaseConfig::default(),
            storage: StorageConfig::default(),
            relay: RelayAgentConfig::default(),
        }
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: default_port(),
            bind: default_bind(),
        }
    }
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: default_log_level(),
        }
    }
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self { path: None }
    }
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self { path: None }
    }
}

impl AgentConfig {
    pub fn load(config_path: Option<&Path>) -> Result<Self, String> {
        let path = match config_path {
            Some(p) => {
                if p.exists() {
                    Some(p.to_path_buf())
                } else {
                    return Err(format!("Config file not found: {}", p.display()));
                }
            }
            None => default_config_path().filter(|p| p.exists()),
        };

        let config = match path {
            Some(p) => {
                let content = std::fs::read_to_string(&p)
                    .map_err(|e| format!("Failed to read config {}: {e}", p.display()))?;
                toml::from_str(&content)
                    .map_err(|e| format!("Failed to parse config {}: {e}", p.display()))?
            }
            None => Self::default(),
        };

        Ok(config)
    }

    pub fn database_path(&self) -> PathBuf {
        match &self.database.path {
            Some(p) => PathBuf::from(p),
            None => data_dir().join("agent.db"),
        }
    }

    pub fn storage_path(&self) -> PathBuf {
        match &self.storage.path {
            Some(p) => PathBuf::from(p),
            None => data_dir(),
        }
    }

    pub fn log_dir(&self) -> PathBuf {
        data_dir().join("logs")
    }
}

fn data_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local_app_data).join("StorageOS").join("data");
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("storageos");
        }
    }

    PathBuf::from("data")
}

fn default_config_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            return Some(
                PathBuf::from(local_app_data)
                    .join("StorageOS")
                    .join("config.toml"),
            );
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(
                PathBuf::from(home)
                    .join(".config")
                    .join("storageos")
                    .join("config.toml"),
            );
        }
    }

    None
}

pub struct CliArgs {
    pub config_path: Option<PathBuf>,
    pub port_override: Option<u16>,
    pub bind_override: Option<String>,
    pub relay_url_override: Option<String>,
}

pub fn parse_args() -> CliArgs {
    let args: Vec<String> = std::env::args().collect();
    let mut config_path = None;
    let mut port_override = None;
    let mut bind_override = None;
    let mut relay_url_override = None;
    let mut i = 1;

    while i < args.len() {
        match args[i].as_str() {
            "--config" => {
                i += 1;
                if i < args.len() {
                    config_path = Some(PathBuf::from(&args[i]));
                }
            }
            "--port" => {
                i += 1;
                if i < args.len() {
                    port_override = args[i].parse().ok();
                }
            }
            "--bind" => {
                i += 1;
                if i < args.len() {
                    bind_override = Some(args[i].clone());
                }
            }
            "--relay-url" => {
                i += 1;
                if i < args.len() {
                    relay_url_override = Some(args[i].clone());
                }
            }
            _ => {}
        }
        i += 1;
    }

    CliArgs {
        config_path,
        port_override,
        bind_override,
        relay_url_override,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_valid() {
        let config = AgentConfig::default();
        assert_eq!(config.server.port, DEFAULT_AGENT_PORT);
        assert_eq!(config.logging.level, "info");
        assert!(config.database.path.is_none());
        assert!(config.storage.path.is_none());
    }

    #[test]
    fn parse_toml_config() {
        let toml_str = r#"
[server]
port = 8080

[logging]
level = "debug"

[database]
path = "/tmp/test.db"
"#;
        let config: AgentConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.server.port, 8080);
        assert_eq!(config.logging.level, "debug");
        assert_eq!(config.database.path.as_deref(), Some("/tmp/test.db"));
    }

    #[test]
    fn partial_toml_uses_defaults() {
        let toml_str = r#"
[server]
port = 9000
"#;
        let config: AgentConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.server.port, 9000);
        assert_eq!(config.logging.level, "info");
        assert!(config.database.path.is_none());
    }
}
