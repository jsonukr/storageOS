# StorageOS Networking Architecture

**Document ID:** ARCH-NET-001
**Version:** 1.0
**Date:** 2026-07-06
**Status:** Draft

---

## 1. Transport Abstraction

StorageOS communicates between devices over pluggable transports. Each transport implements the `Transport` trait and is identified by `TransportKind`:

| Transport | Priority | Status | Description |
|-----------|----------|--------|-------------|
| LAN | 10 | Implemented | Direct HTTP on local network |
| USB | 20 | Placeholder | Future USB tethering |
| VPN | 30 | Placeholder | Future VPN tunnel |
| Bluetooth | 40 | Placeholder | Future Bluetooth PAN |
| Relay | 50 | Client only | WebSocket relay via intermediary server |

Lower priority = preferred. The `ConnectionManager` selects the best reachable endpoint for each device by filtering reachable endpoints and picking the lowest priority.

---

## 2. Multi-Endpoint Device Model

Each device can have multiple endpoints (one per transport). Endpoints are stored in the `device_endpoints` SQLite table with a composite primary key `(device_id, transport)`.

```
Device
├── Endpoint (LAN, 192.168.1.10:19742, priority=10, reachable=true)
├── Endpoint (Relay, relay.storageos.io, priority=50, reachable=false)
└── Endpoint (USB, ..., priority=20, reachable=false)
```

The `ConnectionManager` resolves the best endpoint for a device when any component needs to communicate with it.

---

## 3. LAN Transport

The primary transport for MVP. Direct HTTP between agents on the same local network.

- Agent listens on port 19742 (configurable via `--port` or `config.toml`)
- Bind address configurable (default `127.0.0.1`, `--bind 0.0.0.0` for LAN)
- Discovery via QR code pairing (no mDNS yet)
- Presence polling every 12 seconds

---

## 4. Relay Transport

The relay transport maintains a persistent outbound WebSocket connection from the agent to a relay server. This enables device-to-device communication when direct LAN is not available (different networks, NAT, firewall).

### 4.1 Architecture

```
Device A                  Relay Server              Device B
[Agent] ──WebSocket──▶  [Relay]  ◀──WebSocket── [Agent]
                          │
                     Routes messages
                     between devices
```

The agent is the relay client. The relay server (`services/storageos-relay/`, UC-006) routes messages between connected agents.

### 4.2 Connection Lifecycle

```
1. Agent starts → reads relay config
2. If no URL configured → RelayState::Disabled (no connection attempt)
3. If URL configured → RelayState::Connecting
4. WebSocket handshake with timeout (default 10s)
5. On success → send HELLO → RelayState::Connected
6. Heartbeat every 30s (WS Ping)
7. On disconnect → RelayState::Disconnected → reconnect with backoff
8. On error → RelayState::Failed → reconnect with backoff
```

### 4.3 Reconnect Strategy

Exponential backoff with fixed steps:

| Attempt | Delay |
|---------|-------|
| 1 | 1s |
| 2 | 2s |
| 3 | 5s |
| 4 | 10s |
| 5 | 30s |
| 6+ | 60s (max) |

Backoff resets to 1s after a successful connection.

### 4.4 HELLO Message

On each successful WebSocket connection, the agent sends a HELLO message using the StorageOS Protocol envelope:

```json
{
  "version": {"major": 1, "minor": 0},
  "id": "<uuid>",
  "timestamp": 1720281600,
  "source": "<device-id>",
  "destination": "relay",
  "kind": "hello",
  "payload": {
    "type": "hello",
    "device_id": "<device-id>",
    "device_name": "My-PC",
    "device_kind": "Desktop",
    "platform": "Windows",
    "agent_version": "0.1.0",
    "protocol_version": {"major": 1, "minor": 0},
    "capabilities": ["browse", "transfer", "presence"],
    "public_key": "<ed25519-hex>",
    "fingerprint": "A7F2-19CD-83AE"
  }
}
```

Uses the Secure Device Identity (UC-004) for authentication — no passwords, no accounts.

### 4.5 Heartbeat

- WebSocket-level Ping every 30 seconds (configurable)
- Server responds with Pong
- Failed send = disconnect detected → reconnect

### 4.6 Configuration

TOML config file:
```toml
[relay]
url = "ws://relay.example.com/ws"
heartbeat_interval_secs = 30
connection_timeout_secs = 10
```

CLI override:
```
storageos-agent --relay-url ws://relay.example.com/ws
```

Default: no URL = relay disabled.

### 4.7 State Reporting

The agent's `/health` endpoint includes `relay_status`:

```json
{
  "status": "ok",
  "uptime_secs": 3600,
  "version": "0.1.0",
  "platform": "Windows",
  "device_id": "...",
  "relay_status": "disabled"
}
```

Possible values: `disabled`, `disconnected`, `connecting`, `connected`, `failed`.

The desktop StatusBar shows relay status alongside LAN status when relay is not disabled.

---

## 5. ConnectionManager & Transport Selection (Desktop)

The `ConnectionManager` is a TypeScript singleton that maps device IDs to their endpoints, selects the best transport automatically, and handles failover.

### 5.1 Endpoint Health Tracking

Each endpoint tracks health metrics:

| Field | Description |
|-------|-------------|
| latencyMs | Measured round-trip time |
| failureCount | Consecutive failures (decays on success) |
| lastFailure | Epoch timestamp of last failure |
| successCount | Total successful requests |
| lastSuccess | Epoch timestamp of last success |

### 5.2 Transport Scoring

The `TransportSelector` scores each endpoint:

```
score = 0
if reachable:       +100
priority bonus:     +(50 - priority) * 2     // LAN=80, USB=60, VPN=40, BT=20, Relay=0
latency penalty:    -(latencyMs * 0.1)
failure penalty:    -(min(failureCount * 15, 60))
success rate:       +(successCount / total) * 30
```

The highest-scoring reachable endpoint is selected. If none are reachable, the highest-scoring unreachable endpoint is chosen (for retry).

### 5.3 Automatic Failover

When `recordFailure()` is called:
1. The endpoint's failure count increments
2. After 3 consecutive failures, the endpoint is marked unreachable
3. The active transport re-evaluates via the scoring algorithm
4. If a reachable alternative exists, traffic automatically switches to it

When `recordSuccess()` is called:
1. The endpoint is marked reachable
2. Latency is updated
3. Failure count decays by 1 (gradual recovery, not instant reset)
4. Active transport re-evaluates — a recovered LAN endpoint beats a working Relay

### 5.4 Connection Quality

Derived from the active endpoint's latency:

| Quality | Latency |
|---------|---------|
| Excellent | ≤ 50ms |
| Good | ≤ 150ms |
| Fair | ≤ 500ms |
| Poor | > 500ms |
| Offline | Not reachable |

### 5.5 Key Methods

| Method | Description |
|--------|-------------|
| `resolve(deviceId)` | Best endpoint via scoring algorithm |
| `buildUrl(deviceId, path)` | HTTP URL from best endpoint |
| `recordSuccess(deviceId, transport, latencyMs)` | Track successful request |
| `recordFailure(deviceId, transport)` | Track failure, trigger failover |
| `getConnectionQuality(deviceId)` | Current quality level |
| `getAvailableTransports(deviceId)` | Reachable endpoints sorted by score |
| `getActiveTransport(deviceId)` | Currently selected transport |
| `switchTransport(deviceId, transport)` | Manual override |
| `getEndpointHealth(deviceId, transport)` | Health metrics for a transport |
| `invalidate(deviceId)` | Mark all endpoints unreachable |

### 5.6 Request Integration (`remoteFetch`)

All remote device HTTP requests flow through `remoteFetch()`, a wrapper that:

1. Resolves the best endpoint via `ConnectionManager.getAddress()`
2. Measures request latency via `performance.now()`
3. Calls `recordSuccess()` on HTTP 2xx with measured latency
4. Calls `recordFailure()` on network error or HTTP 5xx
5. On failure, re-evaluates transport and retries once via the new best endpoint (if different)

Integrated services:

| Service | Methods |
|---------|---------|
| ExplorerService | `listRemoteRoots`, `listRemoteDirectory`, `remoteCreateFolder`, `remoteRename`, `remoteDelete`, `remoteUpload`, `remoteCopyOnDevice` |
| FolderTransferService | `runRemoteToLocal`, `runLocalToRemote`, `runRemoteSameDevice` |
| Image Preview | `onLoad` → `recordSuccess`, `onError` → `recordFailure` |

Transfer methods that go through the Tauri IPC bridge (`remoteDownload`, `remoteUploadFile`) use `recordTransferResult()` to report outcome after the Tauri command completes.

Debug logging (dev mode only) outputs transport chosen, score, latency, failure count, transport switches, and retries to the browser console with `[transport]` prefix.

### 5.7 UI Integration

- **StatusBar**: Shows "Connected via LAN" / "Connected via Relay" with quality indicator dot
- **Devices page**: Per-device transport details — active transport, available transports, latency, quality

---

## 6. Relay Server (`services/storageos-relay/`)

Independent Rust binary. Routes StorageOS protocol messages between agents. Does not store files, inspect payloads, or understand filesystem operations.

### 6.1 Startup

```
storageos-relay --port 19800 --bind 0.0.0.0 --heartbeat-timeout 90 --max-connections 1000
```

Defaults are suitable for local development. All settings configurable via CLI.

### 6.2 Connection Flow

```
1. Agent connects to ws://<relay-host>:<port>/ws
2. Agent sends HELLO (StorageOS Protocol envelope)
3. Relay validates:
   - First message must be HELLO kind
   - Protocol version must be compatible (major match)
   - device_id, public_key, fingerprint must be non-empty
4. Relay registers device in in-memory registry
5. Session enters routing loop
6. On disconnect: unregister, log reason
```

### 6.3 Message Routing

```
Device A                    Relay                     Device B
   │                          │                          │
   │── Message(dest=B) ──────▶│                          │
   │                          │── Forward raw JSON ─────▶│
   │                          │                          │
   │◀── Message(dest=A) ──────│◀── Message(dest=A) ──────│
```

The relay parses only the `destination` field from the message envelope. The payload is forwarded as raw JSON — never inspected, modified, or stored.

Messages addressed to "relay" are silently consumed. Unknown destinations are dropped with a debug log.

### 6.4 Connection Registry

In-memory `RwLock<HashMap<DeviceId, ConnectedDevice>>`. No persistence — device state exists only while connected.

Each `ConnectedDevice` holds:
- Identity: device_id, device_name, public_key, fingerprint
- Metadata: capabilities, transport, connected_at, last_seen
- Channel: `mpsc::UnboundedSender<String>` for forwarding messages

Max connections enforced (default 1000). Re-connection from same device_id replaces the existing entry.

### 6.5 Presence

The relay tracks:
| Field | Description |
|-------|-------------|
| status | Always "online" while connected |
| connected_at | Epoch timestamp of HELLO registration |
| last_seen | Updated on every message, ping, or pong |

`GET /devices` returns presence for all connected devices.

Offline = device not in registry (disconnected or never connected).

### 6.6 Heartbeat & Timeout

- Relay accepts WebSocket Ping frames and responds with Pong
- `last_seen` updated on any activity (text, ping, pong, binary)
- If no activity for `heartbeat_timeout_secs` (default 90s), the session-level select loop disconnects the client
- Background reaper task runs every `timeout/2` seconds to catch leaked connections

### 6.7 HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Status, uptime, version, connected device count |
| `/devices` | GET | List of connected devices with presence info |
| `/ws` | GET | WebSocket upgrade for agent connections |

### 6.8 Scalability Design

- Stateless routing: no database, no disk I/O during message forwarding
- In-memory registry: O(1) lookup by device_id
- Per-connection async task: each WebSocket gets its own tokio task
- Outbound channel: non-blocking `mpsc::UnboundedSender` for message forwarding
- Future multi-relay: no shared state between relay instances; client reconnect + device_id routing makes horizontal scaling natural

### 6.9 Future: TLS

When TLS is added:
1. Relay accepts `wss://` connections (rustls or native-tls)
2. Client certificates validated against public keys from HELLO
3. All forwarded messages encrypted in transit
4. No changes to routing logic — TLS is transport-level

---

## 7. Cross-Network File Transport (PM5)

Filesystem operations work identically over LAN or Relay. The relay only routes protocol messages — it never proxies HTTP. The Explorer remains completely transport-agnostic.

### 7.1 Architecture

```
LAN Path (existing):
  Desktop ──HTTP──▶ Remote Agent ──▶ storageos_core

Relay Path (PM5):
  Desktop ──HTTP──▶ Local Agent (/relay/*) ──Protocol──▶ Relay WS ──▶ Remote Agent ──▶ storageos_core
                    └── Converts HTTP to protocol message       └── Forwards raw JSON
                    └── Waits for correlated response            └── Remote dispatches to storageos_core
                    └── Converts response back to HTTP           └── Sends protocol response back
```

This is NOT HTTP-over-WebSocket tunneling. The local agent understands each filesystem operation and constructs typed protocol messages. The relay only sees JSON envelopes with destination fields.

### 7.2 Protocol Payloads

16 new payload types extend the existing `Payload` enum in `storageos-core`:

| Payload | Direction | Purpose |
|---------|-----------|---------|
| `CreateFolderRequest` | Request | Create folder (parent + name) |
| `RenameEntryRequest` | Request | Rename item (path + new_name) |
| `DeleteEntryRequest` | Request | Delete item (path) |
| `OperationResponse` | Response | Result of create/rename/delete (success + path) |
| `SearchEntryRequest` | Request | Search directory (path + query + recursive) |
| `SearchEntryResponse` | Response | Search results (entries + total_count) |
| `ThumbnailRequest` | Request | Image thumbnail (path + max_size) |
| `ThumbnailResponse` | Response | Base64 JPEG thumbnail |
| `DownloadRequest` | Request | Start download (transfer_id + path) |
| `DownloadReady` | Response | File metadata before streaming |
| `DownloadData` | Transfer | Base64 file chunk (offset + is_last) |
| `DownloadComplete` | Transfer | Download finished |
| `UploadStart` | Request | Start upload (transfer_id + path + file_name + total_bytes) |
| `UploadReady` | Response | Remote ready to receive chunks |
| `UploadData` | Transfer | Base64 file chunk (offset + is_last) |
| `UploadComplete` | Request | Upload finished, finalize |
| `TransferError` | Error | Transfer failed (transfer_id + error) |

Streaming uses 256KB base64-encoded chunks. Each chunk is a standalone protocol message forwarded independently by the relay.

### 7.3 Agent RPC Dispatcher

`services/storageos-agent/src/dispatcher.rs` maps incoming protocol requests to storageos_core:

| Request Payload | Handler | storageos_core Function |
|-----------------|---------|------------------------|
| `RootsRequest` | `handle_roots` | `filesystem::list_roots()` |
| `DirectoryRequest` | `handle_directory` | `filesystem::list_directory()` |
| `CreateFolderRequest` | `handle_create_folder` | `filesystem::create_folder()` |
| `RenameRequest` | `handle_rename` | `filesystem::rename_item()` |
| `DeleteRequest` | `handle_delete` | `filesystem::delete_item()` |
| `SearchRequest` | `handle_search` | `search::search_directory()` |
| `ThumbnailRequest` | `handle_thumbnail` | `file_service::generate_thumbnail()` |
| `DownloadRequest` | `handle_download_start` | `file_service::prepare_download()` + `std::fs::read()` |

Response Messages automatically set: `source ↔ destination` swapped, `request_id` set to incoming `id`, `kind` set to `Response` (or `Error`).

### 7.4 Relay Handle

`services/storageos-agent/src/relay_handle.rs` provides a clonable handle for any code to send and receive messages through the relay:

- `request(destination, payload)` → `Message`: Sends a protocol message and waits for the correlated response (matched by `request_id`). Timeout: 30 seconds.
- `send_raw(json)`: Fire-and-forget. Used for streaming upload chunks.
- Pending request tracking: `HashMap<request_id, oneshot::Sender<Message>>`

### 7.5 Relay Proxy Endpoints

`services/storageos-agent/src/relay_proxy.rs` exposes 9 HTTP endpoints that mirror the existing filesystem API:

| Relay Endpoint | Method | Maps to Protocol |
|---------------|--------|------------------|
| `/relay/roots?device=` | GET | `RootsRequest` |
| `/relay/directory?device=&path=` | GET | `DirectoryRequest` |
| `/relay/mkdir?device=` | POST | `CreateFolderRequest` |
| `/relay/rename?device=` | POST | `RenameEntryRequest` |
| `/relay/entry?device=&path=` | DELETE | `DeleteEntryRequest` |
| `/relay/search?device=&path=&query=` | GET | `SearchEntryRequest` |
| `/relay/thumbnail?device=&path=` | GET | `ThumbnailRequest` |
| `/relay/download?device=&path=` | GET | `DownloadRequest` |
| `/relay/upload?device=&path=` | POST | `UploadStart` + `UploadData` |

Each endpoint returns the same JSON format as the corresponding direct HTTP endpoint, so the desktop doesn't need to know which transport is being used.

### 7.6 Desktop Integration

`remoteFetch()` in `apps/desktop/src/services/network/remoteFetch.ts` is the single integration point:

```
if transport == "relay":
  rewrite URL from http://{remote}:{port}/{path}
                to http://127.0.0.1:19742/relay/{path}?device={deviceId}
else:
  use direct HTTP (existing behavior)
```

`buildRemoteUrl()` follows the same logic for URL-only consumers (image preview, Tauri download bridge).

ExplorerService is completely unchanged. All 10 remote methods work identically over LAN or Relay.
