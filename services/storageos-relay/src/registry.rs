use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tokio::sync::{mpsc, RwLock};

#[derive(Debug, Clone, Serialize)]
pub struct ConnectedDevice {
    pub device_id: String,
    pub device_name: String,
    pub public_key: String,
    pub fingerprint: String,
    pub capabilities: Vec<String>,
    pub transport: String,
    pub connected_at: i64,
    pub last_seen: i64,
    #[serde(skip)]
    pub sender: mpsc::UnboundedSender<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DevicePresence {
    pub device_id: String,
    pub device_name: String,
    pub fingerprint: String,
    pub status: String,
    pub connected_at: i64,
    pub last_seen: i64,
}

impl From<&ConnectedDevice> for DevicePresence {
    fn from(d: &ConnectedDevice) -> Self {
        Self {
            device_id: d.device_id.clone(),
            device_name: d.device_name.clone(),
            fingerprint: d.fingerprint.clone(),
            status: "online".to_string(),
            connected_at: d.connected_at,
            last_seen: d.last_seen,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PairCodeEntry {
    pub pair_code: String,
    pub device_id: String,
    pub display_name: String,
    pub fingerprint: String,
    pub registered_at: i64,
    pub ttl_secs: u64,
}

pub struct ConnectionRegistry {
    devices: RwLock<HashMap<String, ConnectedDevice>>,
    pair_codes: RwLock<HashMap<String, PairCodeEntry>>,
    max_connections: usize,
}

impl ConnectionRegistry {
    pub fn new(max_connections: usize) -> Self {
        Self {
            devices: RwLock::new(HashMap::new()),
            pair_codes: RwLock::new(HashMap::new()),
            max_connections,
        }
    }

    pub async fn register(
        &self,
        device: ConnectedDevice,
    ) -> Result<(), RegistrationError> {
        let mut devices = self.devices.write().await;

        if devices.len() >= self.max_connections && !devices.contains_key(&device.device_id) {
            return Err(RegistrationError::MaxConnectionsReached);
        }

        if let Some(existing) = devices.get(&device.device_id) {
            tracing::info!(
                device_id = %device.device_id,
                "Replacing existing connection for device"
            );
            let _ = existing.sender.send(String::new());
        }

        let device_id = device.device_id.clone();
        let device_name = device.device_name.clone();
        let fingerprint = device.fingerprint.clone();
        devices.insert(device_id.clone(), device);

        tracing::info!(
            device_id = %device_id,
            device_name = %device_name,
            fingerprint = %fingerprint,
            connected = devices.len(),
            "Device registered"
        );

        Ok(())
    }

    pub async fn unregister(&self, device_id: &str, reason: &str) {
        let mut devices = self.devices.write().await;
        if devices.remove(device_id).is_some() {
            tracing::info!(
                device_id = %device_id,
                reason = %reason,
                connected = devices.len(),
                "Device unregistered"
            );
        }
    }

    pub async fn route_message(&self, destination: &str, message: &str) -> bool {
        let devices = self.devices.read().await;
        if let Some(device) = devices.get(destination) {
            device.sender.send(message.to_string()).is_ok()
        } else {
            false
        }
    }

    pub async fn update_last_seen(&self, device_id: &str) {
        let mut devices = self.devices.write().await;
        if let Some(device) = devices.get_mut(device_id) {
            device.last_seen = now_epoch();
        }
    }

    pub async fn connected_count(&self) -> usize {
        self.devices.read().await.len()
    }

    pub async fn list_devices(&self) -> Vec<DevicePresence> {
        self.devices
            .read()
            .await
            .values()
            .map(DevicePresence::from)
            .collect()
    }

    pub async fn register_pair_code(&self, entry: PairCodeEntry) {
        let code = entry.pair_code.clone();
        let mut codes = self.pair_codes.write().await;
        tracing::info!(
            pair_code = %code,
            device_id = %entry.device_id,
            ttl = entry.ttl_secs,
            "Pair code registered"
        );
        codes.insert(code, entry);
    }

    pub async fn resolve_pair_code(&self, code: &str) -> Option<PairCodeEntry> {
        let codes = self.pair_codes.read().await;
        let entry = codes.get(code)?;
        let now = now_epoch();
        if now - entry.registered_at > entry.ttl_secs as i64 {
            return None;
        }
        Some(entry.clone())
    }

    pub async fn cleanup_expired_codes(&self) {
        let mut codes = self.pair_codes.write().await;
        let now = now_epoch();
        let before = codes.len();
        codes.retain(|_, entry| now - entry.registered_at <= entry.ttl_secs as i64);
        let removed = before - codes.len();
        if removed > 0 {
            tracing::debug!(removed, "Expired pair codes cleaned up");
        }
    }

    pub async fn stale_devices(&self, timeout_secs: u64) -> Vec<String> {
        let now = now_epoch();
        let threshold = now - timeout_secs as i64;
        self.devices
            .read()
            .await
            .iter()
            .filter(|(_, d)| d.last_seen < threshold)
            .map(|(id, _)| id.clone())
            .collect()
    }
}

#[derive(Debug)]
pub enum RegistrationError {
    MaxConnectionsReached,
}

impl std::fmt::Display for RegistrationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RegistrationError::MaxConnectionsReached => write!(f, "maximum connections reached"),
        }
    }
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

pub fn new_registry(max_connections: usize) -> Arc<ConnectionRegistry> {
    Arc::new(ConnectionRegistry::new(max_connections))
}
