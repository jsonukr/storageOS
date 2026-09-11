use crate::device_registry::DeviceRegistry;
use storageos_core::models::device::DeviceId;
use storageos_core::networking::{DeviceEndpoint, RelayState, TransportKind};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::watch::Receiver;
use tokio::sync::Semaphore;

/// Cap how many devices we probe at once. Without this, one poll cycle could
/// spawn one task per paired device, and if several are unreachable the 5s
/// timeouts pile up and starve the runtime — which made the app hang once
/// several devices were paired.
const MAX_CONCURRENT_PROBES: usize = 4;

pub fn spawn_presence_poller(registry: Arc<DeviceRegistry>, relay_state: Receiver<RelayState>) {
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
                let relay_connected = matches!(*relay_state.borrow(), RelayState::Connected);

                tokio::spawn(async move {
                    let _permit = permit;
                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;

                    let mut any_online = false;

                    for ep in &endpoints {
                        // The relay endpoint has no HTTP address to probe (host is a
                        // placeholder). A peer is reachable over the relay whenever
                        // THIS agent is connected to it; the desktop's per-request
                        // success/failure tracking refines it from there. Only LAN-
                        // style endpoints get a direct /presence probe.
                        let reachable = if ep.transport == "relay" {
                            relay_connected
                        } else {
                            let endpoint = DeviceEndpoint::from_address(
                                DeviceId::new(&device_id),
                                TransportKind::Lan,
                                &format!("{}:{}", ep.host, ep.port),
                            );
                            let url = endpoint.url("/presence");
                            matches!(client.get(&url).send().await, Ok(resp) if resp.status().is_success())
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
