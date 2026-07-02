use crate::device_registry::DeviceRegistry;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub fn spawn_presence_poller(registry: Arc<DeviceRegistry>) {
    tokio::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        loop {
            tokio::time::sleep(Duration::from_secs(12)).await;

            let devices = match registry.list_devices() {
                Ok(d) => d,
                Err(_) => continue,
            };

            for device in devices {
                if device.address.is_empty() {
                    continue;
                }

                let url = format!("http://{}/presence", device.address);
                let registry = registry.clone();
                let client = client.clone();
                let device_id = device.device_id.clone();
                let address = device.address.clone();

                tokio::spawn(async move {
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;

                    match client.get(&url).send().await {
                        Ok(resp) if resp.status().is_success() => {
                            let _ = registry.update_device_status(
                                &device_id,
                                "online",
                                &address,
                                now,
                            );
                        }
                        _ => {
                            let _ = registry.update_device_status(
                                &device_id,
                                "offline",
                                &address,
                                now,
                            );
                        }
                    }
                });
            }
        }
    });
}
