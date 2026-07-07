use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use storageos_core::models::device::DeviceId;
use storageos_core::protocol::envelope::{Message, MessageId, MessageKind};
use storageos_core::protocol::payloads::Payload;
use storageos_core::protocol::CURRENT_VERSION;
use tokio::sync::{mpsc, oneshot, Mutex};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

pub type PendingMap = Arc<Mutex<HashMap<String, oneshot::Sender<serde_json::Value>>>>;

#[derive(Clone)]
pub struct RelayHandle {
    outbound_tx: mpsc::UnboundedSender<String>,
    pending: PendingMap,
    device_id: String,
}

impl RelayHandle {
    pub fn new(outbound_tx: mpsc::UnboundedSender<String>, device_id: String) -> Self {
        Self {
            outbound_tx,
            pending: Arc::new(Mutex::new(HashMap::new())),
            device_id,
        }
    }

    pub fn pending_map(&self) -> PendingMap {
        self.pending.clone()
    }

    pub fn send_raw(&self, json: String) -> Result<(), String> {
        self.outbound_tx
            .send(json)
            .map_err(|_| "Relay connection closed".to_string())
    }

    pub async fn request(
        &self,
        destination: &str,
        payload: Payload,
    ) -> Result<Message, String> {
        let raw = self.request_raw(destination, payload).await?;

        serde_json::from_value::<Message>(raw.clone()).map_err(|e| {
            format!("Failed to parse relay response as Message: {e}")
        })
    }

    pub async fn request_raw(
        &self,
        destination: &str,
        payload: Payload,
    ) -> Result<serde_json::Value, String> {
        let request_id = MessageId::new(uuid::Uuid::new_v4().to_string());

        let msg = Message {
            version: CURRENT_VERSION,
            id: request_id.clone(),
            request_id: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64,
            source: DeviceId(self.device_id.clone()),
            destination: DeviceId(destination.to_string()),
            kind: MessageKind::Request,
            payload,
        };

        let (response_tx, response_rx) = oneshot::channel();

        {
            let mut pending = self.pending.lock().await;
            pending.insert(request_id.0.clone(), response_tx);
        }

        let json = serde_json::to_string(&msg)
            .map_err(|e| format!("Serialize error: {e}"))?;

        if let Err(e) = self.outbound_tx.send(json) {
            self.pending.lock().await.remove(&request_id.0);
            return Err(format!("Send error: {e}"));
        }

        match tokio::time::timeout(REQUEST_TIMEOUT, response_rx).await {
            Ok(Ok(response)) => {
                if let Some(payload) = response.get("payload") {
                    if let Some(ptype) = payload.get("type").and_then(|t| t.as_str()) {
                        if ptype == "error" || ptype == "error_response" {
                            let msg = payload.get("message")
                                .or_else(|| payload.get("error"))
                                .and_then(|m| m.as_str())
                                .unwrap_or("Unknown error");
                            return Err(msg.to_string());
                        }
                    }
                }
                Ok(response)
            }
            Ok(Err(_)) => {
                self.pending.lock().await.remove(&request_id.0);
                Err("Response channel closed".to_string())
            }
            Err(_) => {
                self.pending.lock().await.remove(&request_id.0);
                Err("Request timed out".to_string())
            }
        }
    }
}
