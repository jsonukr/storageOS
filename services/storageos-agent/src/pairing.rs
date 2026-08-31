use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use ed25519_dalek::SigningKey;
use serde::{Deserialize, Serialize};
use storageos_core::protocol::pairing::{self, QrLanHint, QrPayloadV2};
use tokio::sync::Mutex;

const SESSION_TTL: Duration = Duration::from_secs(300);
const APPROVAL_TIMEOUT: Duration = Duration::from_secs(60);
const CLEANUP_INTERVAL: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize)]
pub struct PeerIdentity {
    pub device_id: String,
    pub display_name: String,
    pub device_kind: String,
    pub platform: String,
    pub version: String,
    pub public_key: String,
    pub fingerprint: String,
    pub capabilities: Vec<String>,
    pub address: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionState {
    AwaitingPeer,
    PeerConnected,
    Approved,
    Rejected,
    Expired,
}

#[derive(Debug, Clone, Serialize)]
pub struct PairSession {
    pub session_id: String,
    pub pair_code: String,
    pub state: SessionState,
    #[serde(skip)]
    pub created_at: Instant,
    pub created_ts: i64,
    pub expires_ts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer: Option<PeerIdentity>,
    #[serde(skip)]
    pub peer_connected_at: Option<Instant>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionStatus {
    pub session_id: String,
    pub pair_code: String,
    pub pair_code_formatted: String,
    pub state: SessionState,
    pub expires_in_secs: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer: Option<PeerIdentity>,
}

#[derive(Debug, Deserialize)]
pub struct PairInitiateRequest {
    pub pair_code: String,
    pub device_id: String,
    pub display_name: String,
    #[serde(default = "default_device_kind")]
    pub device_kind: String,
    #[serde(default)]
    pub platform: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub public_key: String,
    #[serde(default)]
    pub fingerprint: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub address: String,
}

fn default_device_kind() -> String {
    "phone".to_string()
}

#[derive(Debug, Deserialize)]
pub struct ApproveRequest {
    pub session_id: String,
    #[serde(default)]
    pub friendly_name: String,
}

#[derive(Debug, Deserialize)]
pub struct RejectRequest {
    pub session_id: String,
}

pub struct PairingManager {
    sessions: Mutex<HashMap<String, PairSession>>,
    device_id: String,
    public_key: String,
    fingerprint: String,
    relay_url: Option<String>,
    signing_key: Option<SigningKey>,
}

impl PairingManager {
    pub fn new(
        device_id: String,
        public_key: String,
        fingerprint: String,
        relay_url: Option<String>,
        signing_key: Option<SigningKey>,
    ) -> Arc<Self> {
        let mgr = Arc::new(Self {
            sessions: Mutex::new(HashMap::new()),
            device_id,
            public_key,
            fingerprint,
            relay_url,
            signing_key,
        });

        let mgr_clone = mgr.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(CLEANUP_INTERVAL).await;
                mgr_clone.cleanup_expired().await;
            }
        });

        mgr
    }

    pub async fn create_session(&self) -> PairSession {
        let mut sessions = self.sessions.lock().await;

        sessions.retain(|_, s| s.created_at.elapsed() < SESSION_TTL);

        let session_id = uuid::Uuid::new_v4().to_string();
        let mut random_bytes = [0u8; 12];
        rand_core::OsRng.fill_bytes(&mut random_bytes);
        let pair_code_raw = pairing::generate_pair_code(&random_bytes);
        let pair_code = pairing::normalize_pair_code(&pair_code_raw);

        let now_ts = now_epoch();
        let session = PairSession {
            session_id: session_id.clone(),
            pair_code: pair_code.clone(),
            state: SessionState::AwaitingPeer,
            created_at: Instant::now(),
            created_ts: now_ts,
            expires_ts: now_ts + SESSION_TTL.as_secs() as i64,
            peer: None,
            peer_connected_at: None,
        };

        sessions.insert(session_id, session.clone());
        session
    }

    pub async fn get_active_session(&self) -> Option<SessionStatus> {
        let sessions = self.sessions.lock().await;
        sessions.values()
            .filter(|s| s.created_at.elapsed() < SESSION_TTL)
            .filter(|s| matches!(s.state, SessionState::AwaitingPeer | SessionState::PeerConnected))
            .max_by_key(|s| s.created_ts)
            .map(|s| self.to_status(s))
    }

    pub async fn get_session(&self, session_id: &str) -> Option<SessionStatus> {
        let sessions = self.sessions.lock().await;
        sessions.get(session_id).map(|s| self.to_status(s))
    }

    pub async fn cancel_session(&self, session_id: &str) -> bool {
        let mut sessions = self.sessions.lock().await;
        sessions.remove(session_id).is_some()
    }

    pub async fn initiate_pair(&self, req: &PairInitiateRequest) -> Result<SessionStatus, String> {
        let mut sessions = self.sessions.lock().await;
        let normalized_code = pairing::normalize_pair_code(&req.pair_code);

        let session = sessions.values_mut()
            .find(|s| {
                s.pair_code == normalized_code
                    && s.created_at.elapsed() < SESSION_TTL
                    && matches!(s.state, SessionState::AwaitingPeer)
            })
            .ok_or_else(|| "Invalid or expired pairing code".to_string())?;

        session.state = SessionState::PeerConnected;
        session.peer = Some(PeerIdentity {
            device_id: req.device_id.clone(),
            display_name: req.display_name.clone(),
            device_kind: req.device_kind.clone(),
            platform: req.platform.clone(),
            version: req.version.clone(),
            public_key: req.public_key.clone(),
            fingerprint: req.fingerprint.clone(),
            capabilities: req.capabilities.clone(),
            address: req.address.clone(),
        });
        session.peer_connected_at = Some(Instant::now());

        Ok(self.to_status(session))
    }

    pub async fn approve(&self, session_id: &str) -> Result<PeerIdentity, String> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions.get_mut(session_id)
            .ok_or_else(|| "Session not found".to_string())?;

        if !matches!(session.state, SessionState::PeerConnected) {
            return Err("Session is not awaiting approval".to_string());
        }

        session.state = SessionState::Approved;
        session.peer.clone().ok_or_else(|| "No peer identity".to_string())
    }

    pub async fn reject(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions.get_mut(session_id)
            .ok_or_else(|| "Session not found".to_string())?;

        session.state = SessionState::Rejected;
        Ok(())
    }

    pub async fn get_pending_requests(&self) -> Vec<SessionStatus> {
        let sessions = self.sessions.lock().await;
        sessions.values()
            .filter(|s| matches!(s.state, SessionState::PeerConnected))
            .filter(|s| {
                s.peer_connected_at
                    .map(|t| t.elapsed() < APPROVAL_TIMEOUT)
                    .unwrap_or(false)
            })
            .map(|s| self.to_status(s))
            .collect()
    }

    pub fn generate_qr_payload(&self, pair_code: &str, lan_hint: Option<String>) -> QrPayloadV2 {
        let ts = now_epoch();
        let mut payload = QrPayloadV2 {
            v: 2,
            id: self.device_id.clone(),
            pk: self.public_key.clone(),
            fp: self.fingerprint.clone(),
            name: device_name(),
            code: pairing::format_pair_code(pair_code),
            caps: vec!["browse".to_string(), "transfer".to_string()],
            relay: self.relay_url.clone(),
            ts,
            sig: None,
            hint: lan_hint.map(|lan| QrLanHint { lan }),
        };

        if let Some(ref signing_key) = self.signing_key {
            use ed25519_dalek::Signer;
            let sign_data = payload.sign_data();
            let signature = signing_key.sign(sign_data.as_bytes());
            payload.sig = Some(base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                signature.to_bytes(),
            ));
        }

        payload
    }

    pub fn relay_url(&self) -> Option<String> {
        self.relay_url.clone()
    }

    fn to_status(&self, session: &PairSession) -> SessionStatus {
        let remaining = SESSION_TTL
            .checked_sub(session.created_at.elapsed())
            .unwrap_or_default();

        SessionStatus {
            session_id: session.session_id.clone(),
            pair_code: session.pair_code.clone(),
            pair_code_formatted: pairing::format_pair_code(&session.pair_code),
            state: session.state.clone(),
            expires_in_secs: remaining.as_secs(),
            peer: session.peer.clone(),
        }
    }

    async fn cleanup_expired(&self) {
        let mut sessions = self.sessions.lock().await;
        let before = sessions.len();
        sessions.retain(|_, s| {
            if s.created_at.elapsed() >= SESSION_TTL {
                return false;
            }
            if let Some(connected_at) = s.peer_connected_at {
                if matches!(s.state, SessionState::PeerConnected) && connected_at.elapsed() >= APPROVAL_TIMEOUT {
                    return false;
                }
            }
            true
        });
        let removed = before - sessions.len();
        if removed > 0 {
            tracing::debug!(removed, "Expired pair sessions cleaned up");
        }
    }
}

fn device_name() -> String {
    hostname::get()
        .ok()
        .and_then(|n| n.into_string().ok())
        .unwrap_or_else(|| "StorageOS".to_string())
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

use rand_core::RngCore;
