mod config;
mod handler;
mod registry;
mod server;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use config::{parse_args, RelayConfig};

#[tokio::main]
async fn main() {
    let args = parse_args();
    let cfg = RelayConfig::default().with_args(args);

    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&cfg.log_level));

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();

    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        port = cfg.port,
        bind = %cfg.bind,
        heartbeat_timeout_secs = cfg.heartbeat_timeout_secs,
        max_connections = cfg.max_connections,
        "StorageOS Relay starting"
    );

    let conn_registry = registry::new_registry(cfg.max_connections);

    spawn_reaper(conn_registry.clone(), cfg.heartbeat_timeout_secs);

    let state = Arc::new(server::RelayState {
        registry: conn_registry,
        config: cfg.clone(),
        started_at: Instant::now(),
    });

    let app = server::router(state);

    let bind_ip: std::net::IpAddr = cfg.bind.parse().unwrap_or_else(|_| {
        tracing::warn!(bind = %cfg.bind, "Invalid bind address, falling back to 0.0.0.0");
        std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED)
    });
    let addr = SocketAddr::from((bind_ip, cfg.port));

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!(error = %e, addr = %addr, "Failed to bind");
            std::process::exit(1);
        }
    };

    tracing::info!(addr = %addr, "StorageOS Relay ready");

    let server = axum::serve(listener, app).with_graceful_shutdown(shutdown_signal());

    if let Err(e) = server.await {
        tracing::error!(error = %e, "Server error");
    }

    tracing::info!("StorageOS Relay stopped");
}

fn spawn_reaper(registry: Arc<registry::ConnectionRegistry>, timeout_secs: u64) {
    tokio::spawn(async move {
        let interval = std::time::Duration::from_secs(timeout_secs / 2);
        let mut ticker = tokio::time::interval(interval);
        ticker.tick().await;

        loop {
            ticker.tick().await;
            let stale = registry.stale_devices(timeout_secs).await;
            for device_id in stale {
                registry.unregister(&device_id, "heartbeat_timeout_reaper").await;
            }
        }
    });
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for Ctrl+C");
    tracing::info!("Shutdown signal received");
}
