use serde::{Deserialize, Serialize};

use crate::models::device::DeviceId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransportKind {
    Lan,
    Relay,
    Usb,
    Bluetooth,
    Vpn,
}

impl TransportKind {
    pub fn default_priority(&self) -> u8 {
        match self {
            TransportKind::Lan => 10,
            TransportKind::Usb => 20,
            TransportKind::Vpn => 30,
            TransportKind::Bluetooth => 40,
            TransportKind::Relay => 50,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            TransportKind::Lan => "LAN",
            TransportKind::Relay => "Relay",
            TransportKind::Usb => "USB",
            TransportKind::Bluetooth => "Bluetooth",
            TransportKind::Vpn => "VPN",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceEndpoint {
    pub device_id: DeviceId,
    pub transport: TransportKind,
    pub host: String,
    pub port: u16,
    pub priority: u8,
    pub reachable: bool,
    pub last_seen: Option<i64>,
    pub last_successful: Option<i64>,
}

impl DeviceEndpoint {
    pub fn lan(device_id: DeviceId, host: impl Into<String>, port: u16) -> Self {
        Self {
            device_id,
            transport: TransportKind::Lan,
            host: host.into(),
            port,
            priority: TransportKind::Lan.default_priority(),
            reachable: false,
            last_seen: None,
            last_successful: None,
        }
    }

    pub fn address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    pub fn base_url(&self) -> String {
        match self.transport {
            TransportKind::Lan | TransportKind::Vpn => {
                format!("http://{}:{}", self.host, self.port)
            }
            _ => format!("http://{}:{}", self.host, self.port),
        }
    }

    pub fn url(&self, path: &str) -> String {
        let base = self.base_url();
        if path.starts_with('/') {
            format!("{}{}", base, path)
        } else {
            format!("{}/{}", base, path)
        }
    }

    pub fn from_address(device_id: DeviceId, transport: TransportKind, address: &str) -> Self {
        let (host, port) = parse_host_port(address);
        Self {
            device_id,
            transport,
            host,
            port,
            priority: transport.default_priority(),
            reachable: false,
            last_seen: None,
            last_successful: None,
        }
    }
}

fn parse_host_port(address: &str) -> (String, u16) {
    if let Some(colon) = address.rfind(':') {
        if let Ok(port) = address[colon + 1..].parse::<u16>() {
            return (address[..colon].to_string(), port);
        }
    }
    (address.to_string(), storageos_default_port())
}

fn storageos_default_port() -> u16 {
    crate::config::constants::DEFAULT_AGENT_PORT
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub device_id: DeviceId,
    pub endpoints: Vec<DeviceEndpoint>,
    pub active_transport: TransportKind,
    pub state: ConnectionState,
    pub connected_at: Option<i64>,
}

impl ConnectionInfo {
    pub fn active_endpoint(&self) -> Option<&DeviceEndpoint> {
        self.endpoints
            .iter()
            .find(|e| e.transport == self.active_transport && e.reachable)
            .or_else(|| self.best_endpoint())
    }

    pub fn best_endpoint(&self) -> Option<&DeviceEndpoint> {
        self.endpoints
            .iter()
            .filter(|e| e.reachable)
            .min_by_key(|e| e.priority)
    }

    pub fn endpoint_count(&self) -> usize {
        self.endpoints.len()
    }

    pub fn reachable_count(&self) -> usize {
        self.endpoints.iter().filter(|e| e.reachable).count()
    }
}

pub trait DeviceResolver {
    fn resolve(&self, device_id: &DeviceId) -> Option<DeviceEndpoint>;
    fn resolve_all(&self, device_id: &DeviceId) -> Vec<DeviceEndpoint>;
    fn register(&mut self, endpoint: DeviceEndpoint);
    fn remove(&mut self, device_id: &DeviceId);
    fn remove_endpoint(&mut self, device_id: &DeviceId, transport: TransportKind);
    fn invalidate(&mut self, device_id: &DeviceId);
    fn all_endpoints(&self) -> Vec<DeviceEndpoint>;
}

pub trait Transport {
    fn kind(&self) -> TransportKind;
    fn is_available(&self) -> bool;
    fn priority(&self) -> u8;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RelayState {
    Disabled,
    Disconnected,
    Connecting,
    Connected,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayConfig {
    pub url: Option<String>,
    pub heartbeat_interval_secs: u64,
    pub connection_timeout_secs: u64,
}

impl Default for RelayConfig {
    fn default() -> Self {
        Self {
            url: None,
            heartbeat_interval_secs: crate::config::constants::RELAY_HEARTBEAT_INTERVAL_SECS,
            connection_timeout_secs: crate::config::constants::RELAY_CONNECTION_TIMEOUT_SECS,
        }
    }
}
