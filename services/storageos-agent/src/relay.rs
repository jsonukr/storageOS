use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use storageos_core::config::constants::RELAY_RECONNECT_DELAYS;
use storageos_core::networking::RelayState;
use storageos_core::protocol::{
    Message, MessageId, MessageKind, CURRENT_VERSION,
};
use storageos_core::protocol::payloads::{HelloPayload, Payload};
use storageos_core::models::device::{DeviceId, DeviceKind};
use storageos_core::platform::Platform;
use tokio::sync::{mpsc, watch};
use tokio_tungstenite::tungstenite;

use crate::config::RelayAgentConfig;
use crate::relay_handle::RelayHandle;

pub struct RelayContext {
    pub device_id: String,
    pub public_key: String,
    pub fingerprint: String,
    pub config: RelayAgentConfig,
}

pub fn spawn_relay_client(
    ctx: RelayContext,
) -> (watch::Receiver<RelayState>, RelayHandle) {
    let (outbound_tx, outbound_rx) = mpsc::unbounded_channel::<String>();
    let relay_handle = RelayHandle::new(outbound_tx, ctx.device_id.clone());

    let url = match &ctx.config.url {
        Some(u) if !u.is_empty() => u.clone(),
        _ => {
            tracing::info!("Relay disabled (no URL configured)");
            let (tx, rx) = watch::channel(RelayState::Disabled);
            drop(tx);
            return (rx, relay_handle);
        }
    };

    let (state_tx, state_rx) = watch::channel(RelayState::Disconnected);

    let pending = relay_handle.pending_map();
    tokio::spawn(relay_loop(url, ctx, state_tx, outbound_rx, pending));

    (state_rx, relay_handle)
}

async fn relay_loop(
    url: String,
    ctx: RelayContext,
    state_tx: watch::Sender<RelayState>,
    mut outbound_rx: mpsc::UnboundedReceiver<String>,
    pending: crate::relay_handle::PendingMap,
) {
    let mut backoff_index: usize = 0;

    loop {
        let _ = state_tx.send(RelayState::Connecting);
        tracing::info!(url = %url, "Relay connecting");

        match try_connect(&url, &ctx).await {
            Ok(ws) => {
                backoff_index = 0;
                let _ = state_tx.send(RelayState::Connected);
                tracing::info!(url = %url, "Relay connected");

                run_session(ws, &ctx, &state_tx, &mut outbound_rx, &pending).await;

                let _ = state_tx.send(RelayState::Disconnected);
                tracing::info!(url = %url, "Relay disconnected");
            }
            Err(e) => {
                let _ = state_tx.send(RelayState::Failed);
                tracing::warn!(url = %url, error = %e, "Relay connection failed");
            }
        }

        let delay_secs = RELAY_RECONNECT_DELAYS
            .get(backoff_index)
            .copied()
            .unwrap_or(*RELAY_RECONNECT_DELAYS.last().unwrap_or(&60));

        tracing::info!(
            delay_secs = delay_secs,
            attempt = backoff_index + 1,
            "Relay reconnecting"
        );

        tokio::time::sleep(Duration::from_secs(delay_secs)).await;

        if backoff_index < RELAY_RECONNECT_DELAYS.len() - 1 {
            backoff_index += 1;
        }
    }
}

async fn try_connect(
    url: &str,
    ctx: &RelayContext,
) -> Result<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    String,
> {
    let timeout = Duration::from_secs(ctx.config.connection_timeout_secs);

    let result = tokio::time::timeout(timeout, tokio_tungstenite::connect_async(url)).await;

    match result {
        Ok(Ok((ws, _response))) => Ok(ws),
        Ok(Err(e)) => Err(format!("WebSocket error: {e}")),
        Err(_) => Err(format!("Connection timeout ({}s)", ctx.config.connection_timeout_secs)),
    }
}

async fn run_session(
    ws: tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    ctx: &RelayContext,
    state_tx: &watch::Sender<RelayState>,
    outbound_rx: &mut mpsc::UnboundedReceiver<String>,
    pending: &crate::relay_handle::PendingMap,
) {
    let (mut sink, mut stream) = ws.split();

    if let Err(e) = send_hello(&mut sink, ctx).await {
        tracing::warn!(error = %e, "Failed to send HELLO to relay");
        return;
    }
    tracing::debug!("HELLO sent to relay");

    let heartbeat_interval = Duration::from_secs(ctx.config.heartbeat_interval_secs);
    let mut heartbeat_timer = tokio::time::interval(heartbeat_interval);
    heartbeat_timer.tick().await;
    let mut ping_seq: u64 = 0;

    let device_id = ctx.device_id.clone();

    loop {
        tokio::select! {
            _ = heartbeat_timer.tick() => {
                ping_seq += 1;
                let ping_data = ping_seq.to_be_bytes().to_vec();
                if let Err(e) = sink.send(tungstenite::Message::Ping(ping_data)).await {
                    tracing::warn!(error = %e, "Relay heartbeat failed");
                    break;
                }
                tracing::debug!(seq = ping_seq, "Relay heartbeat sent");
            }
            outbound = outbound_rx.recv() => {
                match outbound {
                    Some(json) => {
                        if let Err(e) = sink.send(tungstenite::Message::Text(json)).await {
                            tracing::warn!(error = %e, "Failed to send outbound relay message");
                            break;
                        }
                    }
                    None => {
                        tracing::info!("Outbound channel closed");
                        break;
                    }
                }
            }
            msg = stream.next() => {
                match msg {
                    Some(Ok(tungstenite::Message::Pong(_))) => {
                        tracing::debug!("Relay heartbeat acknowledged");
                    }
                    Some(Ok(tungstenite::Message::Ping(data))) => {
                        if let Err(e) = sink.send(tungstenite::Message::Pong(data)).await {
                            tracing::warn!(error = %e, "Failed to send pong to relay");
                            break;
                        }
                    }
                    Some(Ok(tungstenite::Message::Text(text))) => {
                        handle_incoming_text(&text, &device_id, pending, &mut sink).await;
                    }
                    Some(Ok(tungstenite::Message::Binary(data))) => {
                        tracing::debug!(len = data.len(), "Relay binary message received");
                    }
                    Some(Ok(tungstenite::Message::Close(frame))) => {
                        tracing::info!(
                            reason = ?frame,
                            "Relay server closed connection"
                        );
                        break;
                    }
                    Some(Err(e)) => {
                        let _ = state_tx.send(RelayState::Failed);
                        tracing::warn!(error = %e, "Relay receive error");
                        break;
                    }
                    None => {
                        tracing::info!("Relay stream ended");
                        break;
                    }
                    _ => {}
                }
            }
        }
    }
}

async fn handle_incoming_text(
    text: &str,
    device_id: &str,
    pending: &crate::relay_handle::PendingMap,
    sink: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        tungstenite::Message,
    >,
) {
    let msg: Message = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!(error = %e, "Failed to parse relay message");
            return;
        }
    };

    tracing::debug!(
        source = %msg.source.0,
        kind = ?msg.kind,
        "Relay message parsed"
    );

    if msg.request_id.is_some() && matches!(msg.kind, MessageKind::Response | MessageKind::Error) {
        if let Some(ref req_id) = msg.request_id {
            let mut pending_guard = pending.lock().await;
            if let Some(tx) = pending_guard.remove(&req_id.0) {
                let _ = tx.send(msg);
                return;
            }
        }
    }

    if matches!(msg.kind, MessageKind::Request) {
        let response = crate::dispatcher::dispatch(&msg).await;
        match serde_json::to_string(&response) {
            Ok(json) => {
                if let Err(e) = sink.send(tungstenite::Message::Text(json)).await {
                    tracing::warn!(error = %e, "Failed to send dispatch response");
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "Failed to serialize dispatch response");
            }
        }
    }
}

async fn send_hello(
    sink: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        tungstenite::Message,
    >,
    ctx: &RelayContext,
) -> Result<(), String> {
    let hello = Message {
        version: CURRENT_VERSION,
        id: MessageId::new(uuid::Uuid::new_v4().to_string()),
        request_id: None,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
        source: DeviceId(ctx.device_id.clone()),
        destination: DeviceId("relay".to_string()),
        kind: MessageKind::Hello,
        payload: Payload::Hello(HelloPayload {
            device_id: DeviceId(ctx.device_id.clone()),
            device_name: hostname::get()
                .ok()
                .and_then(|n| n.into_string().ok())
                .unwrap_or_else(|| "StorageOS".to_string()),
            device_kind: DeviceKind::Desktop,
            platform: Platform::current().display_name().to_string(),
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
            protocol_version: CURRENT_VERSION,
            capabilities: vec![
                "browse".to_string(),
                "transfer".to_string(),
                "presence".to_string(),
            ],
            public_key: ctx.public_key.clone(),
            fingerprint: ctx.fingerprint.clone(),
        }),
    };

    let json = serde_json::to_string(&hello).map_err(|e| format!("Serialize error: {e}"))?;
    sink.send(tungstenite::Message::Text(json))
        .await
        .map_err(|e| format!("Send error: {e}"))
}
