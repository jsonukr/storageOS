#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod database;
mod device_registry;
mod dispatcher;
mod dto;
mod file_service;
mod identity;
mod logging;
mod pairing;
mod presence;
mod relay;
mod relay_handle;
mod relay_proxy;
mod security;
mod server;
mod tray;

use config::{parse_args, AgentConfig};
use database::Database;
use device_registry::DeviceRegistry;
use server::AppState;
use std::net::SocketAddr;
use std::sync::Arc;
use storageos_core::platform::Platform;

#[tokio::main]
async fn main() {
    let args = parse_args();

    let mut cfg = match AgentConfig::load(args.config_path.as_deref()) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Configuration error: {e}");
            std::process::exit(1);
        }
    };

    if let Some(port) = args.port_override {
        cfg.server.port = port;
    }

    if let Some(bind) = args.bind_override {
        cfg.server.bind = bind;
    }

    if let Some(relay_url) = args.relay_url_override {
        cfg.relay.url = Some(relay_url);
    }

    logging::init(&cfg.logging.level, &cfg.log_dir());

    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        platform = %Platform::current(),
        port = cfg.server.port,
        "StorageOS Agent starting"
    );

    tracing::info!(
        db_path = %cfg.database_path().display(),
        storage_path = %cfg.storage_path().display(),
        log_dir = %cfg.log_dir().display(),
        log_level = %cfg.logging.level,
        "Configuration loaded"
    );

    let db = match Database::open(&cfg.database_path()) {
        Ok(db) => db,
        Err(e) => {
            tracing::error!(error = %e, "Failed to initialize database");
            std::process::exit(1);
        }
    };

    match db.schema_version() {
        Ok(v) => tracing::info!(schema_version = v, "Database initialized"),
        Err(e) => tracing::warn!(error = %e, "Could not read schema version"),
    }

    let registry_path = cfg.database_path().with_file_name("devices.db");
    let registry = match DeviceRegistry::open(&registry_path) {
        Ok(r) => Arc::new(r),
        Err(e) => {
            tracing::error!(error = %e, "Failed to initialize device registry");
            std::process::exit(1);
        }
    };

    let device_id = match registry.get_or_create_device_id() {
        Ok(id) => id,
        Err(e) => {
            tracing::error!(error = %e, "Failed to get device identity");
            std::process::exit(1);
        }
    };

    let device_keys = match identity::ensure_keypair(&registry) {
        Ok(keys) => keys,
        Err(e) => {
            tracing::error!(error = %e, "Failed to initialize device keypair");
            std::process::exit(1);
        }
    };

    tracing::info!(
        device_id = %device_id,
        fingerprint = %device_keys.fingerprint,
        "Device identity established"
    );

    tracing::info!("Local Storage Provider registered");

    cfg.relay.apply_env_overrides();

    if let Some(ref url) = cfg.relay.url {
        tracing::info!(relay_url = %url, "Relay URL configured");
    } else {
        tracing::info!("Relay disabled (no URL configured)");
    }

    presence::spawn_presence_poller(registry.clone());
    tracing::info!("Presence poller started (12s interval)");

    let (pair_event_tx, pair_event_rx) = tokio::sync::mpsc::unbounded_channel();

    let (relay_state_rx, relay_handle) = relay::spawn_relay_client(relay::RelayContext {
        device_id: device_id.clone(),
        public_key: device_keys.public_key_hex.clone(),
        fingerprint: device_keys.fingerprint.clone(),
        config: cfg.relay.clone(),
        pair_event_tx: Some(pair_event_tx),
    });

    let tray_rx = tray::spawn(cfg.log_dir());

    let signing_key = identity::load_signing_key(&*registry);

    let pairing_manager = pairing::PairingManager::new(
        device_id.clone(),
        device_keys.public_key_hex.clone(),
        device_keys.fingerprint.clone(),
        cfg.relay.url.clone(),
        signing_key,
    );

    spawn_pair_event_handler(pair_event_rx, pairing_manager.clone(), registry.clone(), relay_handle.clone());

    let state = Arc::new(AppState::new(
        registry,
        device_id,
        device_keys.public_key_hex,
        device_keys.fingerprint,
        relay_state_rx,
        relay_handle,
        pairing_manager,
    ));
    let app = server::router(state);

    let bind_ip: std::net::IpAddr = cfg.server.bind.parse().unwrap_or_else(|_| {
        tracing::warn!(bind = %cfg.server.bind, "Invalid bind address, falling back to 127.0.0.1");
        std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST)
    });
    let addr = SocketAddr::from((bind_ip, cfg.server.port));

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!(error = %e, addr = %addr, "Failed to bind HTTP server");
            let _ = db.close();
            std::process::exit(1);
        }
    };

    tracing::info!(addr = %addr, "HTTP and WebSocket server started");
    tracing::info!("StorageOS Agent ready");

    let server = axum::serve(listener, app).with_graceful_shutdown(shutdown_signal(tray_rx));

    if let Err(e) = server.await {
        tracing::error!(error = %e, "Server error");
    }

    tracing::info!("Shutting down");

    match db.close() {
        Ok(()) => tracing::info!("Database closed"),
        Err(e) => tracing::warn!(error = %e, "Database close error"),
    }

    tracing::info!("StorageOS Agent stopped");
}

fn spawn_pair_event_handler(
    mut rx: tokio::sync::mpsc::UnboundedReceiver<relay::PairRelayEvent>,
    pairing_manager: Arc<pairing::PairingManager>,
    registry: Arc<DeviceRegistry>,
    relay_handle: relay_handle::RelayHandle,
) {
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let payload_type = event.payload.get("type")
                .and_then(|t| t.as_str())
                .unwrap_or("");

            match payload_type {
                "pair_initiate" => {
                    let req = pairing::PairInitiateRequest {
                        pair_code: event.payload.get("pair_code")
                            .and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        device_id: event.payload.get("device_id")
                            .and_then(|v| v.as_str()).unwrap_or(&event.source_device_id).to_string(),
                        display_name: event.payload.get("display_name")
                            .and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
                        device_kind: event.payload.get("device_kind")
                            .and_then(|v| v.as_str()).unwrap_or("phone").to_string(),
                        platform: event.payload.get("platform")
                            .and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        version: event.payload.get("version")
                            .and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        public_key: event.payload.get("public_key")
                            .and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        fingerprint: event.payload.get("fingerprint")
                            .and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        capabilities: vec![],
                    };

                    tracing::info!(
                        source = %event.source_device_id,
                        display_name = %req.display_name,
                        "Relay pair_initiate → PairingManager"
                    );

                    match pairing_manager.initiate_pair(&req).await {
                        Ok(_) => tracing::info!("Pair session created from relay"),
                        Err(e) => tracing::warn!(error = %e, "Failed to create pair session from relay"),
                    }
                }
                "pair_complete" => {
                    let device_id = event.payload.get("device_id")
                        .and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let system_name = event.payload.get("system_name")
                        .and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let device_type = event.payload.get("device_type")
                        .and_then(|v| v.as_str()).unwrap_or("desktop").to_string();
                    let platform = event.payload.get("platform")
                        .and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let version = event.payload.get("version")
                        .and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let public_key = event.payload.get("public_key")
                        .and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let fingerprint = event.payload.get("fingerprint")
                        .and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let address = event.payload.get("address")
                        .and_then(|v| v.as_str()).unwrap_or("").to_string();

                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;

                    let device = device_registry::DeviceRecord {
                        device_id: device_id.clone(),
                        system_name: system_name.clone(),
                        friendly_name: system_name,
                        device_type,
                        platform,
                        version,
                        address,
                        last_seen: now,
                        paired_at: now,
                        status: "online".to_string(),
                        capabilities: "{}".to_string(),
                        permissions: "{}".to_string(),
                        public_key,
                        endpoints: Vec::new(),
                        preferred_transport: "relay".to_string(),
                        connection_state: "connected".to_string(),
                        fingerprint,
                        last_verified: now,
                        trust_status: "trusted".to_string(),
                    };

                    match registry.register_device(&device) {
                        Ok(_) => tracing::info!(device_id = %device_id, "Remote device registered via relay pair_complete"),
                        Err(e) => tracing::warn!(error = %e, "Failed to register device from pair_complete"),
                    }
                }
                _ => {
                    tracing::debug!(payload_type = %payload_type, "Unhandled pair relay event");
                }
            }
        }
    });
}

async fn shutdown_signal(tray_rx: std::sync::mpsc::Receiver<tray::TrayCommand>) {
    let ctrl_c = tokio::signal::ctrl_c();

    let tray_exit = tokio::task::spawn_blocking(move || {
        for cmd in tray_rx {
            match cmd {
                tray::TrayCommand::Exit | tray::TrayCommand::RestartAgent => return,
                tray::TrayCommand::ViewLogs => {}
            }
        }
    });

    tokio::select! {
        _ = ctrl_c => {},
        _ = tray_exit => {},
    }

    tracing::info!("Shutdown signal received");
}
