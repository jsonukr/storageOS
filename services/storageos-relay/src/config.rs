use storageos_core::config::constants::{
    DEFAULT_RELAY_PORT, RELAY_HEARTBEAT_TIMEOUT_SECS, RELAY_MAX_CONNECTIONS,
};

#[derive(Debug, Clone)]
pub struct RelayConfig {
    pub bind: String,
    pub port: u16,
    pub heartbeat_timeout_secs: u64,
    pub max_connections: usize,
    pub log_level: String,
}

impl Default for RelayConfig {
    fn default() -> Self {
        Self {
            bind: "0.0.0.0".to_string(),
            port: DEFAULT_RELAY_PORT,
            heartbeat_timeout_secs: RELAY_HEARTBEAT_TIMEOUT_SECS,
            max_connections: RELAY_MAX_CONNECTIONS,
            log_level: "info".to_string(),
        }
    }
}

pub struct CliArgs {
    pub bind: Option<String>,
    pub port: Option<u16>,
    pub heartbeat_timeout: Option<u64>,
    pub max_connections: Option<usize>,
    pub log_level: Option<String>,
}

pub fn parse_args() -> CliArgs {
    let args: Vec<String> = std::env::args().collect();
    let mut bind = None;
    let mut port = None;
    let mut heartbeat_timeout = None;
    let mut max_connections = None;
    let mut log_level = None;
    let mut i = 1;

    while i < args.len() {
        match args[i].as_str() {
            "--bind" => {
                i += 1;
                if i < args.len() {
                    bind = Some(args[i].clone());
                }
            }
            "--port" => {
                i += 1;
                if i < args.len() {
                    port = args[i].parse().ok();
                }
            }
            "--heartbeat-timeout" => {
                i += 1;
                if i < args.len() {
                    heartbeat_timeout = args[i].parse().ok();
                }
            }
            "--max-connections" => {
                i += 1;
                if i < args.len() {
                    max_connections = args[i].parse().ok();
                }
            }
            "--log-level" => {
                i += 1;
                if i < args.len() {
                    log_level = Some(args[i].clone());
                }
            }
            _ => {}
        }
        i += 1;
    }

    CliArgs {
        bind,
        port,
        heartbeat_timeout,
        max_connections,
        log_level,
    }
}

impl RelayConfig {
    pub fn with_args(mut self, args: CliArgs) -> Self {
        if let Some(bind) = args.bind {
            self.bind = bind;
        }
        if let Some(port) = args.port {
            self.port = port;
        }
        if let Some(timeout) = args.heartbeat_timeout {
            self.heartbeat_timeout_secs = timeout;
        }
        if let Some(max) = args.max_connections {
            self.max_connections = max;
        }
        if let Some(level) = args.log_level {
            self.log_level = level;
        }
        self
    }
}
