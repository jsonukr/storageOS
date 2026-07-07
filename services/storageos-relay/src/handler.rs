use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use storageos_core::protocol::{self, CURRENT_VERSION};
use storageos_core::protocol::payloads::Payload;
use tokio::sync::mpsc;

use crate::registry::{ConnectedDevice, ConnectionRegistry, PairCodeEntry};

pub async fn handle_connection(
    socket: WebSocket,
    registry: Arc<ConnectionRegistry>,
    heartbeat_timeout_secs: u64,
) {
    let (mut ws_sink, mut ws_stream) = socket.split();

    let hello_timeout = Duration::from_secs(10);
    let hello_msg = match tokio::time::timeout(hello_timeout, ws_stream.next()).await {
        Ok(Some(Ok(Message::Text(text)))) => text,
        Ok(Some(Ok(_))) => {
            tracing::warn!("Expected text HELLO, got non-text message");
            return;
        }
        Ok(Some(Err(e))) => {
            tracing::warn!(error = %e, "Error receiving HELLO");
            return;
        }
        Ok(None) => {
            tracing::debug!("Connection closed before HELLO");
            return;
        }
        Err(_) => {
            tracing::warn!("HELLO timeout (10s)");
            return;
        }
    };

    let message: protocol::Message = match serde_json::from_str(&hello_msg) {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!(error = %e, "Malformed HELLO message");
            return;
        }
    };

    if message.kind != protocol::MessageKind::Hello {
        tracing::warn!(kind = ?message.kind, "First message must be HELLO");
        return;
    }

    if !CURRENT_VERSION.is_compatible(&message.version) {
        tracing::warn!(
            client_version = %message.version,
            server_version = %CURRENT_VERSION,
            "Protocol version mismatch"
        );
        return;
    }

    let (device_id, device_name, public_key, fingerprint, capabilities) = match &message.payload {
        Payload::Hello(h) => {
            if h.device_id.0.is_empty() {
                tracing::warn!("HELLO with empty device_id");
                return;
            }
            if h.public_key.is_empty() {
                tracing::warn!(device_id = %h.device_id.0, "HELLO with empty public_key");
                return;
            }
            if h.fingerprint.is_empty() {
                tracing::warn!(device_id = %h.device_id.0, "HELLO with empty fingerprint");
                return;
            }
            (
                h.device_id.0.clone(),
                h.device_name.clone(),
                h.public_key.clone(),
                h.fingerprint.clone(),
                h.capabilities.clone(),
            )
        }
        _ => {
            tracing::warn!("HELLO message with non-Hello payload");
            return;
        }
    };

    let (outbound_tx, mut outbound_rx) = mpsc::unbounded_channel::<String>();

    let device = ConnectedDevice {
        device_id: device_id.clone(),
        device_name: device_name.clone(),
        public_key,
        fingerprint: fingerprint.clone(),
        capabilities,
        transport: "relay".to_string(),
        connected_at: now_epoch(),
        last_seen: now_epoch(),
        sender: outbound_tx,
    };

    if let Err(e) = registry.register(device).await {
        tracing::warn!(
            device_id = %device_id,
            error = %e,
            "Registration failed"
        );
        return;
    }

    tracing::info!(
        device_id = %device_id,
        device_name = %device_name,
        fingerprint = %fingerprint,
        "Client connected"
    );

    let disconnect_reason = run_session(
        &device_id,
        &mut ws_sink,
        &mut ws_stream,
        &mut outbound_rx,
        &registry,
        heartbeat_timeout_secs,
    )
    .await;

    registry.unregister(&device_id, &disconnect_reason).await;
}

async fn run_session(
    device_id: &str,
    ws_sink: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    ws_stream: &mut futures_util::stream::SplitStream<WebSocket>,
    outbound_rx: &mut mpsc::UnboundedReceiver<String>,
    registry: &Arc<ConnectionRegistry>,
    heartbeat_timeout_secs: u64,
) -> String {
    let timeout = Duration::from_secs(heartbeat_timeout_secs);
    let mut last_activity = tokio::time::Instant::now();

    loop {
        let remaining = timeout.saturating_sub(last_activity.elapsed());
        if remaining.is_zero() {
            tracing::info!(
                device_id = %device_id,
                timeout_secs = heartbeat_timeout_secs,
                "Heartbeat timeout"
            );
            return "heartbeat_timeout".to_string();
        }

        tokio::select! {
            msg = ws_stream.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        last_activity = tokio::time::Instant::now();
                        registry.update_last_seen(device_id).await;
                        handle_text_message(device_id, &text, registry, ws_sink).await;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        last_activity = tokio::time::Instant::now();
                        registry.update_last_seen(device_id).await;
                        if ws_sink.send(Message::Pong(data)).await.is_err() {
                            return "send_error".to_string();
                        }
                        tracing::debug!(device_id = %device_id, "Pong sent");
                    }
                    Some(Ok(Message::Pong(_))) => {
                        last_activity = tokio::time::Instant::now();
                        registry.update_last_seen(device_id).await;
                    }
                    Some(Ok(Message::Close(frame))) => {
                        tracing::info!(
                            device_id = %device_id,
                            reason = ?frame,
                            "Client sent close"
                        );
                        return "client_close".to_string();
                    }
                    Some(Ok(Message::Binary(_))) => {
                        last_activity = tokio::time::Instant::now();
                        registry.update_last_seen(device_id).await;
                    }
                    Some(Err(e)) => {
                        tracing::warn!(device_id = %device_id, error = %e, "Receive error");
                        return format!("receive_error: {e}");
                    }
                    None => {
                        return "stream_ended".to_string();
                    }
                }
            }
            outbound = outbound_rx.recv() => {
                match outbound {
                    Some(text) if text.is_empty() => {
                        return "replaced_by_new_connection".to_string();
                    }
                    Some(text) => {
                        if ws_sink.send(Message::Text(text)).await.is_err() {
                            return "forward_send_error".to_string();
                        }
                    }
                    None => {
                        return "outbound_channel_closed".to_string();
                    }
                }
            }
            _ = tokio::time::sleep(remaining) => {
                tracing::info!(
                    device_id = %device_id,
                    timeout_secs = heartbeat_timeout_secs,
                    "Heartbeat timeout"
                );
                return "heartbeat_timeout".to_string();
            }
        }
    }
}

async fn handle_text_message(
    source_id: &str,
    text: &str,
    registry: &Arc<ConnectionRegistry>,
    ws_sink: &mut futures_util::stream::SplitSink<WebSocket, Message>,
) {
    #[derive(serde::Deserialize)]
    struct Envelope {
        destination: storageos_core::models::device::DeviceId,
        #[serde(default)]
        payload: Option<serde_json::Value>,
    }

    let envelope: Envelope = match serde_json::from_str(text) {
        Ok(e) => e,
        Err(e) => {
            tracing::debug!(
                source = %source_id,
                error = %e,
                "Could not parse message envelope"
            );
            return;
        }
    };

    let dest_id = &envelope.destination.0;

    if dest_id == "relay" || dest_id.is_empty() {
        if let Some(ref payload) = envelope.payload {
            if let Some(payload_type) = payload.get("type").and_then(|t| t.as_str()) {
                match payload_type {
                    "pair_code_register" => {
                        handle_pair_code_register(source_id, payload, registry).await;
                        return;
                    }
                    "pair_code_resolve" => {
                        handle_pair_code_resolve(source_id, payload, registry, ws_sink).await;
                        return;
                    }
                    _ => {}
                }
            }
        }
        tracing::debug!(source = %source_id, "Message addressed to relay (ignored)");
        return;
    }

    if registry.route_message(dest_id, text).await {
        tracing::debug!(
            source = %source_id,
            destination = %dest_id,
            len = text.len(),
            "Message routed"
        );
    } else {
        tracing::debug!(
            source = %source_id,
            destination = %dest_id,
            "Destination not connected"
        );
    }
}

async fn handle_pair_code_register(
    source_id: &str,
    payload: &serde_json::Value,
    registry: &Arc<ConnectionRegistry>,
) {
    #[derive(serde::Deserialize)]
    struct RegisterPayload {
        pair_code: String,
        device_id: storageos_core::models::device::DeviceId,
        display_name: String,
        #[serde(default)]
        fingerprint: String,
        #[serde(default = "default_ttl")]
        ttl_secs: u64,
    }
    fn default_ttl() -> u64 { 300 }

    let reg: RegisterPayload = match serde_json::from_value(payload.clone()) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(source = %source_id, error = %e, "Invalid pair code register payload");
            return;
        }
    };

    registry.register_pair_code(PairCodeEntry {
        pair_code: reg.pair_code,
        device_id: reg.device_id.0,
        display_name: reg.display_name,
        fingerprint: reg.fingerprint,
        registered_at: now_epoch(),
        ttl_secs: reg.ttl_secs,
    }).await;
}

async fn handle_pair_code_resolve(
    source_id: &str,
    payload: &serde_json::Value,
    registry: &Arc<ConnectionRegistry>,
    ws_sink: &mut futures_util::stream::SplitSink<WebSocket, Message>,
) {
    #[derive(serde::Deserialize)]
    struct ResolvePayload {
        pair_code: String,
    }

    let resolve: ResolvePayload = match serde_json::from_value(payload.clone()) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(source = %source_id, error = %e, "Invalid pair code resolve payload");
            return;
        }
    };

    let result = registry.resolve_pair_code(&resolve.pair_code).await;

    let response = match result {
        Some(entry) => serde_json::json!({
            "destination": source_id,
            "source": "relay",
            "kind": "response",
            "payload": {
                "type": "pair_code_result",
                "found": true,
                "device_id": entry.device_id,
                "display_name": entry.display_name,
                "fingerprint": entry.fingerprint,
            }
        }),
        None => serde_json::json!({
            "destination": source_id,
            "source": "relay",
            "kind": "response",
            "payload": {
                "type": "pair_code_result",
                "found": false,
            }
        }),
    };

    let json = serde_json::to_string(&response).unwrap_or_default();
    if let Err(e) = ws_sink.send(Message::Text(json)).await {
        tracing::warn!(error = %e, "Failed to send pair code result");
    }
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
