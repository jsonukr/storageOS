#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod database;
mod dto;
mod file_service;
mod logging;
mod security;
mod server;
mod tray;

use config::{parse_args, AgentConfig};
use database::Database;
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

    tracing::info!("Local Storage Provider registered");

    let tray_rx = tray::spawn(cfg.log_dir());

    let state = Arc::new(AppState::new());
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
