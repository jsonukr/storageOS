use crate::device_registry::DeviceRegistry;
use storageos_core::models::device::DeviceId;
use storageos_core::networking::{DeviceEndpoint, TransportKind};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::Semaphore;

/// Cap how many devices we probe at once. Without this, one poll cycle could
/// spawn one task per paired device, and if several are unreachable the 5s
/// timeouts pile up and starve the runtime — which made the app hang once
/// several devices were paired.
const MAX_CONCURRENT_PROBES: usize = 4;

pub fn spawn_presence_poller(registry: Arc<DeviceRegistry>) {
    tokio::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_PROBES));

        loop {
            tokio::time::sleep(Duration::from_secs(12)).await;

            let devices = match registry.list_devices() {
                Ok(d) => d,
                Err(_) => continue,
            };

            for device in devices {
                if device.address.is_empty() && device.endpoints.is_empty() {
                    continue;
                }

                // Blocks here until a slot frees up, bounding concurrency.
                let permit = match semaphore.clone().acquire_owned().await {
                    Ok(p) => p,
                    Err(_) => break,
                };

                let registry = registry.clone();
                let client = client.clone();
                let device_id = device.device_id.clone();
                let address = device.address.clone();

                let endpoints = device.endpoints.clone();

                tokio::spawn(async move {
                    let _permit = permit;
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;

                    let mut any_online = false;

                    for ep in &endpoints {
                        let endpoint = DeviceEndpoint::from_address(
                            DeviceId::new(&device_id),
                            TransportKind::Lan,
                            &format!("{}:{}", ep.host, ep.port),
                        );
                        let url = endpoint.url("/presence");

                        let reachable = match client.get(&url).send().await {
                            Ok(resp) if resp.status().is_success() => true,
                            _ => false,
                        };

                        let _ = registry.update_endpoint_reachability(
                            &device_id,
                            &ep.transport,
                            reachable,
                            now,
                        );

                        if reachable {
                            any_online = true;
                        }
                    }

                    if endpoints.is_empty() && !address.is_empty() {
                        let endpoint = DeviceEndpoint::from_address(
                            DeviceId::new(&device_id),
                            TransportKind::Lan,
                            &address,
                        );
                        let url = endpoint.url("/presence");

                        any_online = match client.get(&url).send().await {
                            Ok(resp) if resp.status().is_success() => true,
                            _ => false,
                        };
                    }

                    let status = if any_online { "online" } else { "offline" };
                    let _ = registry.update_device_status(
                        &device_id,
                        status,
                        &address,
                        now,
                    );
                });
            }
        }
    });
}
