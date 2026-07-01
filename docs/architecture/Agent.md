# StorageOS Agent Architecture

**Document ID:** ARCH-AGENT-001
**Version:** 2.0
**Status:** Draft
**Date:** 2026-07-01
**Author:** Claude Code (Architecture Sprint A-001R)
**Revision:** Senior architecture review of v1.0
**Approved by:** Pending (Tech Lead + Product Owner)

---

## 1. Purpose

StorageOS is a distributed personal storage platform.

The Agent is the product. Everything else is a client.

Desktop, mobile, tablet, web, CLI, and future form factors (TV, NAS, embedded) are thin presentation layers. They render UI. They do not own business logic. They do not manage state. They do not talk to storage providers directly.

The Agent runs on every device in the user's ecosystem. It owns:

- All storage operations
- All provider connections and credentials
- All transfer execution
- All synchronization
- All search
- Device identity and trust
- The clipboard
- Settings
- Notifications

When every UI window is closed, the Agent is still running. When the user is asleep, the Agent is still syncing. When the phone is in a pocket and the laptop lid is shut, the Agents on both devices are still maintaining the user's storage world.

The Agent is not a helper process for a desktop file manager. It is the runtime of a distributed storage operating system.

---

## 2. Design Principles

1. **Account-rooted** — Every Agent belongs to an Account. Devices are owned by accounts, not by applications.
2. **Client-independent** — The Agent runs without any UI. Clients connect and disconnect freely. Zero clients connected is a normal operating state.
3. **Multi-device native** — The architecture assumes multiple Agents on multiple operating systems from day one. Single-device is a special case of multi-device, not the other way around.
4. **Platform-native execution** — The Agent uses OS-native lifecycle management. Background user process on Windows (MVP), systemd on Linux, launchd on macOS.
5. **Single instance per device** — Exactly one Agent runs per device. Multiple clients on the same device share one Agent.
6. **Offline-first** — The Agent operates without internet. Cloud operations queue and resume when connectivity returns. Local operations never depend on remote services.
7. **Secure by default** — All communication is authenticated. Trust is established through cryptographic pairing, not passwords. Permissions are per-device.
8. **Observable** — Structured logging, health endpoints, and presence are built in, not bolted on.
9. **Connector-driven** — The Agent contains no provider-specific logic. All storage access flows through the connector interface.
10. **SDK-abstracted** — Clients never know the underlying transport. The StorageOS SDK handles authentication, transport selection, retry, reconnection, and serialization.

---

## 3. Account Architecture

### 3.1 Why Accounts Exist

The v1.0 architecture had a Device Identity but no concept of ownership. A device floating in space with a UUID is useless in a multi-device world. Who owns this device? Which other devices should it trust? Where do its settings roam?

The answer is the Account.

An Account is the root identity in StorageOS. It represents a person (or, in the future, an organization or family). Devices belong to Accounts. Providers are connected to Accounts. Settings sync across an Account's devices. Trust is established between an Account's devices, not between arbitrary machines.

### 3.2 Account Model

```
Account {
    account_id:    Uuid,        // generated on first device setup
    display_name:  String,      // "Dhananjay", user-editable
    avatar:        Option<Bytes>,
    created_at:    DateTime,
    devices:       Vec<DeviceId>,
    providers:     Vec<ProviderId>,
}
```

### 3.3 Account Creation

There is no central server in MVP. The Account is created locally on the first device:

1. User installs StorageOS on their first device
2. The Agent generates an Account ID (UUID v4) and an Ed25519 key pair
3. The private key is stored in the OS key store (DPAPI / Keychain / secret-tool)
4. The public key becomes the Account's root identity
5. The Account is persisted to SQLite

The Account is portable. When the user pairs a second device, the Account identity propagates via the pairing protocol.

### 3.4 Account Scope

| Entity | Belongs To |
|--------|-----------|
| Devices | Account |
| Storage Providers | Account (credentials shared across devices where possible) |
| Settings | Account (roaming) or Device (local) |
| Transfer History | Device (not roamed; too large) |
| Clipboard | Account (synced across devices) |
| Sync Jobs | Account (visible from any device) |

### 3.5 Future: Multiple Account Types

The Account model is designed to evolve:

| Phase | Account Type | Example |
|-------|-------------|---------|
| MVP | Personal | Single user, multiple devices |
| Future | Family | Shared storage, per-member permissions |
| Future | Organization | IT-managed, RBAC, audit logging, SSO |

The transition from Personal to Organization does not require architectural changes. An Organization Account is a Personal Account with additional metadata (members, roles, policies). The permission system (Section 11) is designed to support this evolution.

---

## 4. Device Registry

### 4.1 Why the v1.0 Device Model Was Insufficient

The v1.0 device identity had 5 fields: device_id, device_name, platform, arch, agent_version. That is a process health check, not a device model. It cannot answer:

- What can this device do? (Capabilities)
- Is it trusted? (Trust level)
- Is it online right now? (Presence)
- When did I last hear from it? (Last seen)
- Can I send files to it? (Storage providers attached)
- Is it on battery? (Power state)
- Is it on WiFi or cellular? (Network type, relevant for large transfers)

A distributed platform needs a rich device model.

### 4.2 Device Model

```
Device {
    device_id:         Uuid,
    friendly_name:     String,          // "Dhananjay's Laptop", user-editable
    owner_account:     AccountId,

    // Hardware & Platform
    device_type:       DeviceType,      // desktop | laptop | phone | tablet | server | nas
    os:                String,          // "Windows 11", "Android 15", "macOS 15"
    os_version:        String,          // "10.0.26200"
    arch:              String,          // "x86_64", "aarch64"
    agent_version:     String,          // "1.2.0"

    // Capabilities
    capabilities:      DeviceCapabilities,

    // Storage
    providers:         Vec<ProviderId>, // storage providers accessible from this device
    local_storage:     Vec<DriveInfo>,  // local drives with capacity

    // Status & Presence
    status:            DeviceStatus,
    presence:          PresenceState,
    last_seen:         DateTime,

    // Power & Network
    battery_level:     Option<u8>,      // 0-100, None for desktops
    battery_charging:  Option<bool>,
    network_type:      NetworkType,     // wifi | ethernet | cellular | offline

    // Security
    public_key:        Ed25519PublicKey,
    certificate:       Option<X509Cert>,
    trust_level:       TrustLevel,      // pending | trusted | revoked

    // Timestamps
    registered_at:     DateTime,
    last_sync:         Option<DateTime>,
}
```

### 4.3 Device Capabilities

```
DeviceCapabilities {
    can_receive_transfers:  bool,   // can this device accept incoming files?
    can_send_transfers:     bool,   // can this device send files?
    can_browse_remote:      bool,   // can other devices browse this device's storage?
    can_sync:               bool,   // does this device support sync jobs?
    can_search:             bool,   // does this device support indexed search?
    has_notifications:      bool,   // can this device display notifications?
    max_transfer_size:      Option<u64>,  // transfer size limit (mobile may cap)
}
```

Capabilities are self-reported by the Agent on each device. A phone Agent may report `can_browse_remote: false` to conserve battery.

### 4.4 Device Types

| Type | Examples | Typical Capabilities |
|------|---------|---------------------|
| `desktop` | Windows PC, Linux workstation | Full capabilities, always-on power |
| `laptop` | MacBook, Windows laptop | Full capabilities, battery-aware |
| `phone` | Android, iPhone | Limited browse, battery-sensitive transfers |
| `tablet` | iPad, Android tablet | Similar to phone with larger display |
| `server` | Home server, VPS | No UI, no notifications, always-on |
| `nas` | Synology, QNAP | Storage-focused, no UI, always-on |

### 4.5 Device Registry Ownership

The Device Registry lives in SQLite on every Agent. When devices pair, they exchange their device records. Each Agent maintains a copy of all devices in the Account.

Changes to device metadata (rename, capability update, trust revocation) propagate to all paired devices via the synchronization protocol. There is no single authoritative registry — it is eventually consistent across all Agents in the Account.

---

## 5. Pairing Architecture

### 5.1 Why Not Username/Password

The v1.0 document assumed pairing via "signing into a StorageOS account on a central server." This is the wrong model for three reasons:

1. It requires a central server running before multi-device works. MVP should work without cloud infrastructure.
2. It creates a password as the root of trust. Passwords are phishable, reusable, and weak.
3. It couples device trust to a server's availability. If the server is down, you cannot pair.

StorageOS uses cryptographic pairing. Trust is established directly between devices, not mediated by a server.

### 5.2 Pairing Protocol Overview

```
Device A (existing, trusted)          Device B (new, untrusted)
────────────────────────────          ──────────────────────────

1. User initiates "Add Device"
   on Device A

2. Agent A generates:
   - 6-digit pair code (short-lived, 5 min)
   - ECDH ephemeral key pair
   - Displays pair code on screen

                                      3. User enters pair code on Device B
                                         (or scans QR containing the code)

                                      4. Agent B generates ECDH ephemeral key pair
                                         Agent B connects to Agent A (via discovery)
                                         Agent B sends: pair_code + ECDH_public_B

5. Agent A verifies pair code
   Agent A computes shared secret:
   ECDH(ephemeral_A, ECDH_public_B)
   Agent A sends: ECDH_public_A
   (encrypted with shared secret)

                                      6. Agent B computes same shared secret:
                                         ECDH(ephemeral_B, ECDH_public_A)

── Both devices now share a secret ──

7. Agent A sends (encrypted):         8. Agent B sends (encrypted):
   - Account identity                    - Device record (Device B)
   - Device record (Device A)            - Device B's Ed25519 public key
   - All other device records
   - Account public key

9. Agent A signs Device B's
   public key with Account
   private key → Device B
   certificate

                                      10. Agent B stores:
                                          - Account identity
                                          - Device A record
                                          - Its own certificate
                                          - Trust: established

11. Agent A stores:
    - Device B record
    - Trust: established

12. Agent A broadcasts Device B's
    existence to all other paired
    devices
```

### 5.3 QR Code Pairing

For phone/tablet pairing, the pair code is embedded in a QR code displayed on the existing device. The mobile app scans it. The QR contains:

```
storageos://pair?code=847291&host=192.168.1.42&port=19742
```

This includes the discovery address, eliminating the need for the phone to discover the desktop Agent separately.

### 5.4 Trust Levels

| Level | Meaning | Transitions |
|-------|---------|-------------|
| `pending` | Pairing initiated but not completed | → `trusted` (pairing succeeds) or removed (timeout) |
| `trusted` | Full access per device permissions | → `revoked` (user action) |
| `revoked` | All access denied, certificate invalidated | → removed (user deletes device) |

### 5.5 Removing a Device

1. User selects "Remove Device" on any trusted device
2. The Agent marks the target device as `revoked`
3. The revocation propagates to all other Agents in the Account
4. If the revoked Agent connects to any other Agent, the connection is refused
5. The revoked Agent's certificate is added to a local revocation list on every device

### 5.6 Lost Device

If a device is lost or stolen:

1. User opens StorageOS on any remaining device
2. Selects "Remove Device" for the lost device
3. The revocation propagates to all online devices
4. If the lost device later comes online and tries to connect, it is rejected
5. OAuth tokens for providers connected on the lost device should be revoked separately (the Agent cannot remotely wipe credentials from a device it cannot reach)

### 5.7 Re-Pairing

A removed device can be re-paired by going through the full pairing protocol again. It receives a new certificate and a new trust relationship. Its old device ID is retired.

---

## 6. Discovery

### 6.1 The Problem

When Device B wants to talk to Device A, it needs to find it. In v1.0, the only answer was "a central API." That requires cloud infrastructure.

StorageOS uses a layered discovery strategy. Each layer is tried in order. The first one that succeeds is used.

### 6.2 Discovery Layers

```
Layer 1: Local Cache
    ↓ (miss)
Layer 2: mDNS / Local Network
    ↓ (miss)
Layer 3: Relay / Cloud Discovery
    ↓ (miss)
Layer 4: Manual Configuration
```

### 6.3 Layer 1: Local Cache

Every Agent caches the last-known address (IP + port) of every paired device. On startup, the Agent tries to reach each cached address. If the device responds and the certificate validates, discovery is complete.

This works in the common case where devices stay on the same network with stable IPs.

### 6.4 Layer 2: mDNS (Local Network)

Each Agent registers itself via mDNS (Multicast DNS / DNS-SD):

```
Service: _storageos._tcp.local.
Port: 19742
TXT record: device_id=<uuid>, account_id=<first-8-chars>
```

When an Agent needs to discover a peer, it queries for `_storageos._tcp.local.` and filters by `account_id`. This works on any local network (WiFi, Ethernet) without configuration.

mDNS works across VLANs only if the router supports mDNS reflection (many consumer routers do). If not, devices on different subnets fall through to Layer 3.

Technology: `mdns-sd` crate (Rust, cross-platform).

### 6.5 Layer 3: Relay / Cloud Discovery (Future)

For devices on different networks (home laptop ↔ office desktop):

**Option A: StorageOS Relay** (self-hosted or managed)
- Each Agent registers its device ID and reachable address with a lightweight relay server
- The relay only brokers discovery — it does not see file contents
- After discovery, devices establish a direct connection if possible (STUN/TURN)
- If direct connection fails, traffic relays through the server (encrypted end-to-end)

**Option B: Tailscale/ZeroTier Integration** (advanced users)
- If the user runs Tailscale or ZeroTier, all devices appear on a virtual LAN
- mDNS works normally over the virtual network
- No relay server needed
- The Agent detects Tailscale/ZeroTier automatically and uses Layer 2

**MVP: Layer 3 is deferred.** MVP devices must be on the same local network. Layer 1 + Layer 2 are sufficient.

### 6.6 Layer 4: Manual Configuration

The user can manually enter an IP address and port for a remote Agent. This is the escape hatch for advanced users who run VPNs, port-forward, or have static IPs.

### 6.7 Discovery Cache Update

When an Agent successfully connects to a peer, it updates the cached address. When an Agent detects that its own address has changed (new IP from DHCP), it broadcasts an mDNS announcement so peers update their caches.

---

## 7. Communication Architecture

### 7.1 Critique of v1.0

The v1.0 document specified HTTP + WebSocket for everything. This was desktop-centric thinking:

- **HTTP is overhead for local IPC.** Named Pipes (Windows) and Unix Domain Sockets (Linux/macOS) are significantly faster for same-machine communication. No TCP stack, no port allocation, no loopback latency.
- **HTTP is request/response.** Many operations (event streams, progress, presence) are naturally bidirectional. WebSocket works but it's a workaround for HTTP's limitation.
- **HTTP/REST lacks strong typing.** Every client must hand-build request/response serialization. Errors in serialization surface at runtime, not compile time.

### 7.2 Transport Strategy

| Communication Path | Transport | Rationale |
|-------------------|-----------|-----------|
| **Desktop ↔ Local Agent** | Named Pipe (Windows) / Unix Domain Socket (Linux, macOS) | Fastest local IPC. No port. No network stack. Native to each OS. |
| **Mobile ↔ Local Agent** (same network) | TCP + TLS (mTLS with device certificates) | Mobile apps cannot use Named Pipes. TCP over WiFi with mutual TLS for authentication. |
| **Remote Device ↔ Agent** (different network) | QUIC or TCP + TLS via relay | QUIC handles NAT traversal better, multiplexes streams, supports connection migration (phone switching from WiFi to cellular). |
| **CLI ↔ Local Agent** | Named Pipe / UDS (same as desktop) | CLI runs on the same machine as the Agent. |
| **Future: Agent ↔ Agent** (direct) | QUIC with mTLS | Agent-to-agent transfers on LAN or VPN. QUIC's multiplexing handles parallel file streams. |

### 7.3 Protocol Layer

Regardless of transport, all communication uses a single protocol layer:

```
┌────────────────────────────────┐
│         StorageOS SDK          │  ← Client-side abstraction
├────────────────────────────────┤
│       Protocol (MessagePack)   │  ← Binary serialization, schema-defined messages
├────────────────────────────────┤
│    Framing (length-prefixed)   │  ← Message boundaries on stream transports
├────────────────────────────────┤
│  Transport (Pipe/UDS/TCP/QUIC) │  ← Pluggable, SDK selects automatically
└────────────────────────────────┘
```

**Why MessagePack over JSON?** MessagePack is binary, ~30% smaller than JSON, faster to serialize/deserialize, and schema-compatible. The SDK handles serialization — clients work with typed objects, never raw bytes. JSON remains available as a debug/fallback format.

**Why not gRPC?** gRPC requires HTTP/2, which is unnecessary overhead for Named Pipe / UDS transports. gRPC's code generation is valuable, but the same benefit is achieved by defining messages in a shared schema (Rust types compiled to each platform's SDK). gRPC remains an option for the future relay/cloud layer if needed.

### 7.4 Message Types

All communication is message-based, not REST-based:

| Category | Examples |
|----------|---------|
| Request/Response | `ListDirectory`, `CreateFolder`, `GetDeviceHealth` |
| Commands | `StartTransfer`, `PauseTransfer`, `RevokeDevice` |
| Events | `TransferProgress`, `FileChanged`, `PresenceUpdate` |
| Streams | `SubscribeEvents`, `TransferData` |

This is more expressive than REST. A `StartTransfer` command that returns a stream of `TransferProgress` events is natural. In REST, you need a POST to start and a WebSocket to stream — two different protocols for one operation.

### 7.5 Backward Compatibility

The Agent also exposes an HTTP/JSON API on a localhost port for:

- Browser-based web UI (cannot use Named Pipes)
- Third-party integrations that expect HTTP
- Development and debugging (curl-friendly)

This is a compatibility layer, not the primary interface. The SDK prefers the native transport.

---

## 8. StorageOS SDK

### 8.1 Purpose

The StorageOS SDK is the ONLY way clients communicate with the Agent. No client should ever construct a raw HTTP request, open a Named Pipe directly, or parse a MessagePack frame.

The SDK abstracts:

| Concern | What the SDK Handles |
|---------|---------------------|
| **Authentication** | Reads the local API key, attaches credentials to every request, handles key rotation |
| **Transport selection** | Detects OS, checks for Named Pipe / UDS availability, falls back to TCP, negotiates TLS for remote |
| **Connection lifecycle** | Connects, reconnects on failure, exponential backoff, connection pooling |
| **Serialization** | Typed request/response objects. Client works with `ListDirectoryRequest` / `ListDirectoryResponse`, never raw bytes. |
| **Event subscription** | Subscribe to event patterns (`transfer.*`, `sync.*`), receive typed event objects, automatic resubscription on reconnect |
| **Caching** | Optional client-side cache for directory listings, device registry, settings. Invalidated by events. |
| **Retry** | Idempotent operations retried automatically on transient failures. Non-idempotent operations surface the error. |
| **Discovery** | For remote Agents: runs the discovery layers (cache → mDNS → relay → manual) |

### 8.2 SDK Implementations

| Platform | Language | Distribution |
|----------|---------|-------------|
| Desktop (Tauri) | TypeScript (compiled from Rust via wasm-bindgen or native Node addon) | npm package bundled with the desktop app |
| Mobile (Android) | Kotlin (wraps Rust core via JNI / UniFFI) | Android library |
| Mobile (iOS) | Swift (wraps Rust core via UniFFI) | Swift package |
| CLI | Rust (uses storageos-sdk crate directly) | Part of the CLI binary |
| Web | TypeScript (HTTP transport only) | npm package |

### 8.3 SDK Core in Rust

The SDK's core logic (transport negotiation, serialization, retry, caching) is written in Rust once and exposed to other platforms via FFI:

```
storageos-sdk (Rust crate)
├── transport/
│   ├── named_pipe.rs      (Windows)
│   ├── unix_socket.rs     (Linux/macOS)
│   ├── tcp_tls.rs         (remote, mobile)
│   └── http_fallback.rs   (web, debug)
├── protocol/
│   ├── messages.rs        (all message types)
│   ├── serialization.rs   (MessagePack + JSON fallback)
│   └── framing.rs         (length-prefixed message frames)
├── client.rs              (high-level client API)
├── discovery.rs           (multi-layer discovery)
├── cache.rs               (optional client-side cache)
└── auth.rs                (credential management)
```

### 8.4 Client Code Example (Conceptual)

```
// The client never knows whether this is a Named Pipe, TCP, or HTTP call
let client = StorageOSClient::connect_local()?;

let entries = client.list_directory("C:\\Users\\Dhananjay\\Documents").await?;

let transfer = client.start_transfer(source, destination).await?;
transfer.on_progress(|p| update_progress_bar(p));
transfer.await_completion().await?;

let mut events = client.subscribe(["transfer.*", "provider.*"]).await?;
while let Some(event) = events.next().await {
    match event {
        Event::TransferCompleted(t) => show_notification(t),
        Event::ProviderDisconnected(p) => show_warning(p),
        _ => {}
    }
}
```

---

## 9. Permissions

### 9.1 Why Permissions Exist

In v1.0, any client with the API key had full access to everything. This is acceptable when there is exactly one user on one device. It breaks when:

- A phone Agent can browse the desktop's filesystem (should it be able to delete files?)
- A family member's device is paired to the same account (should they have full admin access?)
- An enterprise device is managed by IT (should the user be able to change Agent settings?)

Permissions answer: "What is this device (or user) allowed to do?"

### 9.2 Permission Model

Permissions are assigned per-device by the Account owner. They are checked by the Agent on every operation.

```
DevicePermissions {
    read:              bool,    // browse and read file contents
    write:             bool,    // create, rename, modify files
    delete:            bool,    // delete files and folders
    transfer_send:     bool,    // initiate outbound transfers
    transfer_receive:  bool,    // accept inbound transfers
    clipboard_read:    bool,    // read from shared clipboard
    clipboard_write:   bool,    // write to shared clipboard
    search:            bool,    // execute search queries
    notifications:     bool,    // receive notifications from this Agent
    settings_read:     bool,    // read Agent settings
    settings_write:    bool,    // modify Agent settings
    device_manage:     bool,    // add/remove/revoke devices
    provider_manage:   bool,    // add/remove storage providers
}
```

### 9.3 Default Permissions

| Device Type | Default Permissions |
|------------|-------------------|
| First device (Account creator) | All permissions (owner) |
| Paired desktop/laptop | All permissions |
| Paired phone/tablet | All except `settings_write`, `device_manage` |
| Future: Family member device | `read`, `transfer_send`, `transfer_receive`, `clipboard_read`, `search`, `notifications` |
| Future: Enterprise managed | Controlled by organization policy |

Defaults are a starting point. The Account owner can adjust permissions per-device at any time.

### 9.4 Permission Enforcement

Permissions are checked at the Agent API boundary. The SDK sends the requesting device's certificate with every message. The Agent:

1. Validates the certificate (is this device trusted?)
2. Looks up the device's permissions
3. Checks whether the requested operation is permitted
4. If denied, returns a `PERMISSION_DENIED` error with the specific permission that was missing

### 9.5 Evolution to RBAC

The per-device permission model is a flat set of booleans. It evolves to enterprise RBAC by:

1. Introducing **Roles** (Owner, Admin, Member, Viewer, Custom)
2. Roles are collections of permissions
3. Devices (and future: users) are assigned roles
4. Organization Accounts define custom roles
5. No architectural changes — the permission check at the API boundary remains the same. The lookup changes from "device → permissions" to "device → role → permissions."

---

## 10. Presence

### 10.1 Purpose

Presence answers: "What is this device doing right now?"

In a multi-device platform, presence is essential. When the user opens StorageOS on their phone and sees their laptop listed, they need to know: Is it online? Is it syncing? Can I send a file to it?

### 10.2 Presence States

| State | Meaning | Icon Suggestion |
|-------|---------|----------------|
| `online` | Agent is running, idle, ready for operations | Green circle |
| `offline` | Agent is not reachable | Gray circle |
| `sleeping` | Device is in sleep/hibernate. Agent is suspended. | Moon icon |
| `busy` | Agent is handling a heavy operation (large transfer, full re-index) | Orange circle |
| `syncing` | One or more sync jobs are actively running | Rotating arrows |
| `transferring` | One or more transfers are in progress | Arrow icon |
| `idle` | Agent is running but the device has been inactive for >15 min | Dim green circle |

### 10.3 Presence Protocol

Each Agent broadcasts its presence to all paired devices:

1. On state change (e.g., transfer starts → `transferring`), the Agent emits a `PresenceUpdate` message to all connected peers
2. If no state change occurs for 60 seconds, the Agent sends a heartbeat (`online` with timestamp)
3. If a peer misses 3 consecutive heartbeats (180 seconds), it marks the device as `offline`
4. On system sleep/wake events, the Agent sends `sleeping` / `online`

### 10.4 Presence in Clients

Clients subscribe to `presence.*` events via the SDK. The device list in the UI updates in real-time:

```
┌─────────────────────────┐
│ My Devices              │
│                         │
│ ● Desktop PC    online  │
│ ● MacBook      syncing  │
│ ○ Phone        offline  │
│ ◐ NAS          idle     │
└─────────────────────────┘
```

### 10.5 Presence on Local Network

On a local network, presence uses mDNS service announcements. When an Agent starts, it registers its mDNS service. When it shuts down, it deregisters. Other Agents discover and lose peers naturally.

On remote networks (future), presence flows through the relay server or VPN.

---

## 11. Clipboard Architecture

### 11.1 Why Clipboard Is a Platform Feature

The v1.0 architecture had no clipboard concept — it was a TypeScript in-memory array in the desktop app's Zustand store. That works for single-device copy/paste but is architecturally wrong:

- The clipboard belongs to the Agent, not the UI
- The clipboard should persist across UI restarts
- The clipboard should synchronize across devices

When the user copies a file on their laptop and walks to their desktop, the file should be ready to paste.

### 11.2 Clipboard Model

```
ClipboardEntry {
    entry_id:      Uuid,
    source_device: DeviceId,
    operation:     Copy | Cut,
    items:         Vec<ClipboardItem>,
    created_at:    DateTime,
    expires_at:    DateTime,        // auto-expire after 24 hours
}

ClipboardItem {
    provider_id:   ProviderId,
    path:          String,
    name:          String,
    is_directory:  bool,
    size:          u64,
}
```

### 11.3 Clipboard Operations

| Operation | Behavior |
|-----------|---------|
| **Copy** | Items recorded in clipboard. Clipboard survives UI close. |
| **Cut** | Items recorded with `Cut` operation. Source not deleted until paste completes. |
| **Paste** | Creates transfer jobs in the Transfer Engine. For cross-device paste, the Transfer Engine streams from the source device's Agent. |
| **Clear** | Clears the clipboard. |
| **History** | Last N clipboard entries are retained (configurable, default 25). |

### 11.4 Cross-Device Clipboard

When the user copies on Device A:

1. Device A's Agent records the clipboard entry locally
2. Device A's Agent broadcasts a `ClipboardUpdated` event to all paired, trusted devices with `clipboard_write` permission
3. Other Agents store the clipboard entry
4. When the user pastes on Device B, Device B's Agent initiates a transfer from Device A (the source) to Device B's current location

The actual file data is not copied during the clipboard operation. Only the metadata (paths, sizes) is synchronized. Data transfers happen at paste time.

### 11.5 Clipboard Permissions

Clipboard sync respects the `clipboard_read` and `clipboard_write` device permissions. A phone with `clipboard_read: true, clipboard_write: false` can paste items copied on the desktop but cannot propagate its own clipboard to other devices.

### 11.6 Clipboard Expiration

Clipboard entries expire after 24 hours by default (configurable). This prevents stale entries from accumulating, especially for `Cut` operations where the source file may have been modified or deleted since the cut.

### 11.7 Future: System Clipboard Integration

On Windows, integration with the Win+V clipboard history is a future enhancement. The Agent would register as a clipboard format provider, allowing StorageOS clipboard entries to appear in the native Windows clipboard history alongside text and images.

---

## 12. Notification Architecture

### 12.1 Design Change from v1.0

The v1.0 document treated notifications as a subsection of the Event Bus. This undersells their importance. Notifications are a first-class system:

- The Agent generates notifications, not clients
- Notifications persist (they survive UI close and device sleep)
- Notifications have delivery targets (specific device, all devices, or account-wide)
- Notifications have priorities and categories
- Users configure notification preferences per-category and per-device

### 12.2 Notification Model

```
Notification {
    id:            Uuid,
    category:      NotificationCategory,
    priority:      Low | Normal | High | Critical,
    title:         String,
    body:          String,
    source_device: DeviceId,
    target:        AllDevices | SpecificDevice(DeviceId),
    created_at:    DateTime,
    read:          bool,
    action:        Option<NotificationAction>,  // deep link or actionable button
}
```

### 12.3 Notification Categories

| Category | Examples | Default Priority |
|----------|---------|-----------------|
| `transfer` | Transfer complete, transfer failed | Normal |
| `sync` | Sync conflict, sync completed, sync failed | Normal (conflict: High) |
| `storage` | Low disk space, provider quota warning | High |
| `provider` | Provider connected, auth expired, disconnected | Normal (auth expired: High) |
| `device` | New device paired, device offline, device revoked | Normal (revoked: Critical) |
| `security` | Unusual activity, trust change | Critical |
| `system` | Agent update available, migration needed | Low |

### 12.4 Notification Delivery

1. The Agent generates a notification and persists it to SQLite
2. The Event Bus emits a `NotificationCreated` event
3. Connected local clients receive the event via their SDK subscription and display an in-app notification
4. If the notification priority is High or Critical AND the user has enabled OS-native notifications for that category, the Agent sends an OS notification:
   - Windows: Toast via `windows` crate
   - macOS: `NSUserNotification` via `objc2` crate
   - Linux: D-Bus `org.freedesktop.Notifications`
   - Android: FCM push (future, via relay)
   - iOS: APNs push (future, via relay)
5. Cross-device notifications: if the target is `AllDevices`, the notification propagates to all paired Agents

### 12.5 Notification Preferences

Users configure per-category:

- Enabled/disabled
- OS-native notifications on/off
- Quiet hours (e.g., no notifications between 22:00–07:00)
- Per-device overrides (e.g., no transfer notifications on phone)

---

## 13. Agent Execution Modes

### 13.1 Critique of v1.0

The v1.0 document defaulted to Windows Service. This was wrong for MVP:

**Problems with Windows Service for MVP:**
- Runs under a different user account (LocalService or SYSTEM) — cannot access user's files without ACL changes
- Cannot display native Toast notifications (services run in Session 0, notifications require the user's session)
- Cannot launch OAuth flows (no access to the user's browser)
- Requires administrator privileges to install and manage
- Debugging is harder (no console output, no stdout)
- Survives user logout — sounds good, but MVP has no multi-user support, so whose files is it managing?

**Problems with Tray Process for MVP:**
- Visible tray icon is expected but adds UI complexity to the Agent
- Users may close it thinking it's unnecessary

### 13.2 Recommended MVP Strategy: Background User Process

The Agent runs as a regular user process, started at login, with no visible window.

```
storageos-agent.exe --background
```

| Property | Behavior |
|----------|---------|
| Started by | Windows Task Scheduler (at logon) or Startup folder |
| Runs as | Current user (full file access, no ACL issues) |
| Session | User's session (can display Toast notifications, launch OAuth) |
| Visibility | No window, no tray icon. Managed through the desktop app's Settings page. |
| Survives app close | Yes. The Agent is a separate process. |
| Survives user logout | No. Restarts at next login. |
| Survives reboot | Yes, via auto-start at logon. |

### 13.3 Why Not a Tray Icon for MVP?

A tray icon requires a message pump, icon assets, a context menu, and interaction handlers. This is UI code in a process that should have no UI. It adds complexity for little value when the desktop app already provides full Agent management.

The desktop app's Settings page shows Agent status, allows pause/resume, and controls auto-start. This is sufficient for MVP.

### 13.4 Evolution Path

| Phase | Mode | Trigger |
|-------|------|---------|
| MVP | Background user process | Simplest, works today |
| Phase 2 | Optional tray companion (separate binary: `storageos-tray.exe`) | When users request visible status without opening the full app |
| Phase 3+ | Windows Service (user account) | When headless operation and logout-survival are required (server, NAS, enterprise) |
| Linux/macOS | systemd user service / launchd | Standard for those platforms from day one |

### 13.5 Process Discovery

Clients find the running Agent via a well-known file:

```
%LocalAppData%\StorageOS\agent.lock

Contents:
{
    "pid": 12345,
    "port": 19742,
    "pipe": "\\\\.\\pipe\\storageos-agent",
    "started_at": "2026-07-01T10:00:00Z",
    "version": "1.0.0"
}
```

On Linux/macOS: `~/.local/share/storageos/agent.lock` with a Unix Domain Socket path instead of a named pipe.

---

## 14. Storage Providers (Connector Layer)

This section is largely carried forward from v1.0 with corrections.

### 14.1 Connector Interface

Every storage provider implements a common Rust trait. The interface is unchanged from v1.0:

```
StorageConnector
├── id() → ConnectorId
├── name() → &str
├── capabilities() → ConnectorCapabilities
├── status() → ConnectorStatus
│
├── authenticate(credentials) → Result<()>
├── refresh_auth() → Result<()>
├── disconnect() → Result<()>
│
├── list(path, options) → Result<Vec<StorageItem>>
├── get_item(id) → Result<StorageItem>
├── read(id) → Result<AsyncRead>
├── write(path, AsyncRead) → Result<StorageItem>
├── delete(id) → Result<()>
├── rename(id, new_name) → Result<StorageItem>
├── copy(id, destination) → Result<StorageItem>
├── move(id, destination) → Result<StorageItem>
├── create_folder(path, name) → Result<StorageItem>
│
├── search(query, options) → Result<Vec<StorageItem>>
├── watch(path) → Result<Receiver<FsEvent>>
│
├── get_metadata(id) → Result<ItemMetadata>
├── get_thumbnail(id, size) → Result<Vec<u8>>
```

### 14.2 Capability Negotiation

Unchanged from v1.0. Each connector declares its capabilities. Clients check before offering actions.

### 14.3 Built-in Connectors

| Connector | Phase | Auth | Watch |
|-----------|-------|------|-------|
| Local Filesystem | MVP | None | OS-native (ReadDirectoryChangesW / inotify / FSEvents) |
| USB / Removable | MVP | None | Hot-plug detection |
| Google Drive | Phase 3 | OAuth 2.0 | Changes API polling |
| OneDrive | Phase 3 | OAuth 2.0 (MSAL) | Delta API polling |
| SharePoint | Phase 3 | OAuth 2.0 (MSAL) | Delta API polling |
| Dropbox | Phase 3 | OAuth 2.0 | Longpoll + cursor |
| SMB | Future | NTLM / Kerberos | Filesystem watch on mount |
| SFTP | Future | SSH key / password | Polling |

**Note:** Cloud providers moved from "Phase 2" to "Phase 3" to reflect the revised roadmap where pairing and remote browse come before cloud integration.

### 14.4 Provider Credentials Across Devices

When a provider is connected on one device, the credentials (OAuth tokens) are stored on that device. Other devices in the Account do NOT automatically receive those credentials.

Why: OAuth tokens are issued per-device (the redirect URI includes the local Agent's address). Sharing tokens across devices would violate the OAuth security model for most providers.

Instead, each device connects to cloud providers independently. The Account knows which providers are connected on which devices. The user connects Google Drive on their laptop and separately on their phone. Both connections are visible in the Account's provider list.

---

## 15. Transfer Engine

Carried forward from v1.0 with one key addition: cross-device transfers.

### 15.1 Architecture

Unchanged from v1.0. Transfer Planner → Queue → Workers → Progress Emitter.

### 15.2 Cross-Provider Transfers

Unchanged from v1.0. Source connector `read()` → destination connector `write()`, streamed through memory.

### 15.3 Cross-Device Transfers

New in v2.0. When the user pastes on Device B something copied on Device A:

1. Device B's Agent creates a transfer job: source = `device_a:/path/to/file`, destination = local path
2. Device B's Agent connects to Device A's Agent (via the SDK's discovery + transport layer)
3. Device A's Agent verifies Device B's certificate and permissions (`transfer_send` on A, `transfer_receive` on B)
4. Device A's Agent opens a `read()` stream on the source file
5. The data streams from A → B through the communication layer
6. Device B's Agent writes to the destination
7. Both Agents emit progress events to their local clients

If Device A goes offline during the transfer, Device B's Agent pauses the transfer and resumes when A comes back online.

### 15.4 Persistence & Conflict Resolution

Unchanged from v1.0. All transfers persisted to SQLite. Conflicts surfaced to clients. Background transfers use the default conflict policy.

---

## 16. Search

### 16.1 Critique of v1.0

The v1.0 document specified tantivy (a full-text search engine) with background indexing, scheduled sweeps, and semantic search readiness. This is Phase 4+ complexity masquerading as MVP infrastructure.

The current app does filename substring matching via `std::fs::read_dir`. This works. It's fast for local directories. It does not need a search engine.

### 16.2 MVP Strategy: SQLite FTS5

For MVP, search is:

1. **Live directory search** — the current implementation. Walk the directory, match filenames. No index needed.
2. **SQLite FTS5** — when the user needs cross-directory or cross-provider search, use SQLite's built-in full-text search on a metadata table.

SQLite FTS5 is already available (it's compiled into rusqlite by default). It supports:
- Tokenized text search
- Prefix queries ("invoice*")
- Boolean operators ("invoice AND 2026")
- Ranked results (BM25)
- Incremental updates (INSERT/DELETE, no rebuild needed)

This is sufficient for searching across tens of thousands of files with sub-100ms response times.

### 16.3 Index Table

```
-- Metadata stored as part of normal Agent operation
-- FTS5 virtual table for search
CREATE VIRTUAL TABLE file_index USING fts5(
    name,
    path,
    extension,
    provider_id UNINDEXED,
    device_id UNINDEXED,
    is_directory UNINDEXED,
    size UNINDEXED,
    modified UNINDEXED
);
```

The index is populated:
- When a directory is listed (entries go into the index)
- When a filesystem watcher fires (changed entries updated)
- When a provider sync completes (cloud entries indexed)

No background crawler. No scheduled sweeps. The index grows naturally as the user navigates.

### 16.4 Future: Tantivy Upgrade

When the index reaches millions of items or content indexing is needed (Phase 5: AI), tantivy replaces the FTS5 table. The search API (`GET /search` or `SearchRequest` message) does not change. The upgrade is internal to the Agent.

The architecture accommodates this by keeping search behind an abstraction (`SearchService` trait). MVP implementation: `SqliteSearch`. Future implementation: `TantivySearch`. Clients never know.

---

## 17. Plugin Architecture

### 17.1 Honest Assessment

The v1.0 plugin architecture (dynamic library loading, C FFI, sandboxed execution, plugin manifests, resource limits) is well-designed but has no place in MVP or the next several phases.

**Why plugins are deferred:**
- No users are requesting custom connectors before the built-in ones work
- FFI plugin sandboxing is a security surface that must be audited
- ABI stability is a commitment that constrains iteration
- The connector interface itself is still evolving
- Plugin discovery, distribution, and updates are product features that need design

### 17.2 When Plugins Ship

Plugins belong in Phase 6 (Platform). By then:
- The connector interface is stable (proven across Local, Google Drive, OneDrive, Dropbox, SMB, SFTP)
- The Agent API is versioned and tested
- There is a user base requesting integrations the team cannot build
- The security model has been hardened across multiple releases

### 17.3 What Ships Instead

Until Phase 6, all connectors are compiled into the Agent binary. Adding a new connector means releasing a new Agent version. This is simpler, safer, and sufficient.

The connector interface (StorageConnector trait) still exists. It still enables clean separation. It just does not cross a dynamic library boundary yet.

---

## 18. Technology

### 18.1 Core Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Language | Rust | Already in the stack. Single binary. Cross-platform. Memory safe. |
| Local IPC | Named Pipes (Win) / Unix Domain Socket (*nix) | Fastest local transport. No TCP overhead. |
| Network Transport | TCP + TLS / QUIC (future) | Standard, NAT-friendly, mobile-compatible |
| Protocol | MessagePack (primary) + JSON (fallback) | Binary efficiency with human-readable fallback |
| HTTP API | Axum | Compatibility layer for web clients and debugging |
| Database | SQLite via rusqlite | Embedded, zero-config. Stores everything. |
| Search | SQLite FTS5 (MVP) → tantivy (future) | Built-in, sufficient for MVP scale |
| Filesystem Watch | notify crate | Cross-platform. OS-native backends. |
| Logging | tracing + tracing-subscriber | Structured, span-based, configurable |
| mDNS | mdns-sd crate | Local network discovery |
| Crypto | ring / ed25519-dalek | Key generation, ECDH, signatures, TLS |

### 18.2 Why Rust (Reinforced)

The v1.0 rationale is correct but incomplete. Beyond the Tauri synergy:

- **Cross-platform without compromise.** One codebase compiles to Windows, Linux, macOS, Android (via NDK), iOS (via cross-compilation). No runtime required on any platform.
- **SDK via FFI.** UniFFI generates Kotlin, Swift, and Python bindings from Rust. The SDK core is written once and used everywhere.
- **Safety at the boundary.** The Agent handles untrusted data from network peers, cloud APIs, and filesystem events. Rust's memory safety eliminates entire classes of vulnerabilities.

---

## 19. Lifecycle

### 19.1 Installation

| Platform | Agent Location | Data Location | Auto-Start |
|----------|---------------|---------------|-----------|
| Windows | `%LocalAppData%\StorageOS\bin\storageos-agent.exe` | `%LocalAppData%\StorageOS\data\` | Task Scheduler (at logon) |
| Linux | `~/.local/bin/storageos-agent` | `~/.local/share/storageos/` | systemd user service |
| macOS | `~/Library/Application Support/StorageOS/bin/storageos-agent` | `~/Library/Application Support/StorageOS/data/` | launchd LaunchAgent |
| Android | Bundled inside the APK (native library) | App-private storage | Android foreground service |
| iOS | Bundled inside the app | App-private storage | Background App Refresh (limited) |

### 19.2 Startup Sequence

```
1. Parse configuration (CLI args → env vars → config file → defaults)
2. Acquire lock file (ensure single instance)
3. Initialize structured logging
4. Open SQLite database, run pending migrations
5. Start the Event Bus
6. Initialize core services:
   a. Account Manager (loads or creates Account identity)
   b. Device Registry (loads device records, publishes own presence)
   c. Settings Service
   d. Connector Registry (loads configured providers)
   e. Transfer Engine (resumes incomplete transfers)
   f. Search Service (opens FTS5 index)
   g. Clipboard Service (loads current clipboard)
   h. Notification Service
   i. Filesystem Watcher (starts watching configured paths)
7. Start the Task Scheduler
8. Start discovery (mDNS registration, peer connection)
9. Bind local IPC (Named Pipe / UDS)
10. Bind HTTP API (127.0.0.1:{port})
11. Emit AgentReady event
12. Write lock file (PID, port, pipe path)
```

### 19.3 Shutdown Sequence

```
1. Emit AgentShuttingDown event
2. Deregister mDNS service
3. Stop accepting new connections
4. Disconnect from peers (send goodbye)
5. Cancel the Task Scheduler
6. Stop filesystem watchers
7. Drain transfers (persist state for resume)
8. Flush clipboard, sync state, notification state to SQLite
9. Close all connector connections
10. Close SQLite (WAL checkpoint)
11. Remove lock file
12. Exit
```

### 19.4 Recovery

| Failure | Recovery |
|---------|---------|
| Agent crash | Auto-restarted by Task Scheduler / systemd / launchd (delay: 5s) |
| Corrupt SQLite | integrity_check on startup. Corrupt → rebuild from empty, re-index on next directory access. Warn user. |
| Port conflict | Try configured port, then port+1 through port+10. Write actual port to lock file. |
| Stale lock file | Check if PID is alive. If stale, overwrite. |
| Transfer interrupted | Resume from last persisted offset. |
| OAuth expired | Auto-refresh. If refresh fails → mark provider "Auth Required", emit notification. |
| Peer unreachable | Mark peer `offline`. Retry discovery periodically (exponential backoff, max 5 min). |

---

## 20. Logging & Monitoring

Largely unchanged from v1.0.

### 20.1 Structured Logging

`tracing` crate with span-based context. JSON to file, human-readable to stderr.

Log location: `{data_dir}/logs/agent-{date}.log`
Rotation: daily, 7-day retention (configurable).
Levels: ERROR, WARN, INFO, DEBUG, TRACE. Default: INFO.

### 20.2 Health Endpoint

```
GET /health → { status, version, uptime, checks: { database, search, transfer_engine, discovery } }
```

### 20.3 Metrics

Deferred. Prometheus endpoint is Phase 5+ (enterprise monitoring).

---

## 21. Security

### 21.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| Unauthorized local access | Named Pipe ACL restricts to current user. HTTP API requires Bearer token from lock file (user-only readable). |
| Rogue peer device | mTLS with device certificates. Certificate must be signed by the Account's root key. Revocation list checked on connect. |
| OAuth token theft | Tokens encrypted at rest via OS key store (DPAPI / Keychain / secret-tool). |
| Man-in-the-middle (LAN) | All peer communication uses TLS with pinned certificates. No plaintext. |
| Network exposure | Named Pipe / UDS has no network surface. HTTP binds 127.0.0.1 only. Peer connections use mTLS. |
| Lost device | Remote revocation via any trusted device. Revocation propagates to all peers. |
| Replay attack | Message nonces + timestamps. Stale messages rejected. |

### 21.2 Cryptographic Choices

| Purpose | Algorithm | Rationale |
|---------|-----------|-----------|
| Account root key | Ed25519 | Fast, compact, widely supported. Signs device certificates. |
| Device key pair | Ed25519 | Per-device identity. |
| Pairing key exchange | X25519 (ECDH) | Ephemeral key agreement for pairing session. |
| TLS | TLS 1.3 | Peer-to-peer and HTTP API encryption. |
| Token encryption at rest | AES-256-GCM with key from OS key store | Protecting OAuth tokens and sensitive settings. |

---

## 22. Process Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Device (any OS)                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 StorageOS Agent                        │  │
│  │                                                       │  │
│  │  ┌─────────────┐  ┌─────────┐  ┌──────────────────┐ │  │
│  │  │ Transport   │  │ Event   │  │ Task Scheduler   │ │  │
│  │  │ Layer       │  │ Bus     │  │                  │ │  │
│  │  │             │  │         │  │ Sync schedules   │ │  │
│  │  │ Named Pipe  │  │ Pub/Sub │  │ Token refresh    │ │  │
│  │  │ UDS         │  │ In-proc │  │ Heartbeats       │ │  │
│  │  │ HTTP/WS     │  │         │  │ Cleanup          │ │  │
│  │  │ TCP+TLS     │  │         │  │                  │ │  │
│  │  └──────┬──────┘  └────┬────┘  └────────┬─────────┘ │  │
│  │         │              │                 │           │  │
│  │  ┌──────┴──────────────┴─────────────────┴────────┐  │  │
│  │  │                Core Services                    │  │  │
│  │  │                                                 │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │  │
│  │  │  │ Account  │ │ Device   │ │ Permissions    │  │  │  │
│  │  │  │ Manager  │ │ Registry │ │                │  │  │  │
│  │  │  └──────────┘ └──────────┘ └────────────────┘  │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │  │
│  │  │  │ Transfer │ │ Search   │ │ Sync Engine    │  │  │  │
│  │  │  │ Engine   │ │ Service  │ │                │  │  │  │
│  │  │  └──────────┘ └──────────┘ └────────────────┘  │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │  │
│  │  │  │ Clipbrd  │ │ Notif.   │ │ Presence       │  │  │  │
│  │  │  │ Service  │ │ Service  │ │ Service        │  │  │  │
│  │  │  └──────────┘ └──────────┘ └────────────────┘  │  │  │
│  │  │  ┌──────────┐ ┌──────────┐                     │  │  │
│  │  │  │ FS Watch │ │ Settings │                     │  │  │
│  │  │  └──────────┘ └──────────┘                     │  │  │
│  │  └───────────────────┬─────────────────────────────┘  │  │
│  │                      │                                │  │
│  │  ┌───────────────────┴──────────────────────────────┐ │  │
│  │  │              Connector Layer                      │ │  │
│  │  │  ┌───────┐ ┌────────┐ ┌────────┐ ┌───────────┐  │ │  │
│  │  │  │ Local │ │ Google │ │ OneDrv │ │ Dropbox   │  │ │  │
│  │  │  │ FS    │ │ Drive  │ │        │ │           │  │ │  │
│  │  │  └───────┘ └────────┘ └────────┘ └───────────┘  │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  SQLite (account, devices, settings, transfers, │  │  │
│  │  │          index, clipboard, notifications, sync) │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Clients (via StorageOS SDK):                               │
│  ┌──────┐ ┌──────┐ ┌─────┐ ┌──────┐ ┌─────┐              │
│  │ Desk │ │ Web  │ │ CLI │ │ Mob  │ │ Peer│              │
│  │ top  │ │ UI   │ │     │ │ ile  │ │Agent│              │
│  └──────┘ └──────┘ └─────┘ └──────┘ └─────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 23. Directory Structure

```
StorageOS/
├── crates/
│   ├── storageos-core/         ← Core services (connectors, transfer, search, sync, clipboard)
│   ├── storageos-agent/        ← Agent binary (transport layer, lifecycle, scheduler)
│   ├── storageos-sdk/          ← Client SDK core in Rust (transport, protocol, auth, cache)
│   ├── storageos-protocol/     ← Shared message types and serialization
│   └── storageos-cli/          ← CLI client
├── apps/
│   ├── desktop/
│   │   └── src-tauri/          ← Tauri shell (thin wrapper, uses storageos-sdk)
│   └── mobile/                 ← Future: Android/iOS (uses storageos-sdk via UniFFI)
├── connectors/
│   ├── local/                  ← Local FS connector
│   ├── google-drive/           ← Google Drive connector
│   ├── onedrive/               ← OneDrive connector
│   └── dropbox/                ← Dropbox connector
├── sdk/
│   ├── typescript/             ← TypeScript SDK (wraps Rust core or HTTP fallback)
│   ├── kotlin/                 ← Kotlin SDK (generated via UniFFI)
│   └── swift/                  ← Swift SDK (generated via UniFFI)
```

---

## 24. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Startup time | < 500 ms to API-ready |
| Idle memory | < 50 MB |
| Idle CPU | < 1% |
| API response (list directory, 1000 items) | < 100 ms |
| Search response (FTS5, 100K indexed) | < 200 ms |
| Transfer throughput (local) | Limited by disk I/O, not Agent overhead |
| Transfer throughput (network) | Limited by network, not Agent overhead |
| Binary size | < 15 MB (Agent) + < 5 MB (SDK) |
| Database size (10K files) | < 5 MB |
| Database size (1M files) | < 200 MB |
| Log retention | 7 days (configurable) |
| Concurrent local clients | 10+ |
| Concurrent peer connections | 10+ devices |
| Pairing time | < 10 seconds (local network) |
| Presence detection (peer offline) | < 180 seconds |
| Clipboard sync (local network) | < 1 second |

---

## 25. Migration Path from Current Architecture

### Phase 1: Extract Core (No User-Facing Change)

1. Extract Rust services from `apps/desktop/src-tauri/src/services/` into `crates/storageos-core/`
2. The Tauri app depends on `storageos-core` — same code, different location
3. No behavior change. This is a refactor.

### Phase 2: Agent Binary

1. Create `crates/storageos-agent/` — wraps `storageos-core` with transport layer and lifecycle
2. Agent runs as a background user process
3. The Tauri app launches the Agent on startup if not running, then connects to it via Named Pipe
4. Agent serves the same data the Tauri IPC commands used to serve

### Phase 3: SDK Abstraction

1. Create `crates/storageos-sdk/` — client library with transport negotiation
2. Replace Tauri IPC calls in TypeScript with SDK calls
3. The desktop app is now a pure client. It does not contain business logic.

### Phase 4: Multi-Device

1. Implement Account + Device Registry + Pairing + Discovery + Presence
2. A second device can pair and browse the first device's storage
3. Cross-device clipboard and transfers

Each phase is independently shippable. Each phase has a clear value proposition. No big-bang migration.

---

## 26. Evolution Roadmap

| Phase | Name | What Ships | Agent Capabilities |
|-------|------|-----------|-------------------|
| **1** | **Desktop** | Windows desktop app, local Agent | Local filesystem, USB, transfers, search (FTS5), clipboard (local) |
| **2** | **Multi-Device** | Android app, pairing | Device registry, pairing (QR + code), discovery (mDNS), cross-device browse, cross-device clipboard, presence |
| **3** | **Cloud** | Google Drive, OneDrive, Dropbox | Cloud connectors, OAuth flows, cross-provider transfers |
| **4** | **Sync** | Sync engine | One-way/two-way/mirror sync, conflict resolution, scheduled sync |
| **5** | **AI** | Smart search, auto-organize | Tantivy full-text search, embeddings, semantic search, duplicate detection |
| **6** | **Platform** | Plugin SDK, marketplace | Dynamic connector plugins, action plugins, automation rules, public SDK |
| **7** | **Enterprise** | Organization accounts, RBAC | SSO, MFA, audit logging, policy management, admin portal |

---

## 27. Open Questions

These decisions are deferred and require Tech Lead input:

1. **Agent port**: Fixed (e.g., 19742) or dynamic? Fixed simplifies QR pairing. Dynamic avoids conflicts. Recommendation: fixed with fallback.
2. **MessagePack vs. Protocol Buffers**: MessagePack is schemaless and simpler. Protobuf has better code generation. Recommendation: MessagePack for MVP (less tooling), re-evaluate at Phase 2.
3. **QUIC timeline**: When does QUIC replace TCP+TLS for peer connections? Recommendation: Phase 2 (mobile), using the `quinn` crate.
4. **Relay server**: Self-hosted, managed, or both? Recommendation: defer to Phase 3+. LAN-only for Phases 1-2.
5. **Mobile Agent limitations**: iOS severely limits background execution. How does the StorageOS Agent run on iOS? Recommendation: iOS uses Network Extension or runs a limited Agent during foreground only, with background App Refresh for sync.
6. **Account portability**: How does a user migrate their Account to a new device after all existing devices are lost? Recommendation: encrypted Account backup to cloud provider (Google Drive / iCloud). Deferred to Phase 3.

---

## 28. Glossary

> Canonical domain terminology is defined in `docs/architecture/DomainModel.md`.

| Term | Definition |
|------|-----------|
| **Account** | The root identity in StorageOS. Owns devices, providers, and settings. |
| **Agent** | The StorageOS background process. Runs on every device. Owns all business logic. |
| **Client** | Any application that connects to the Agent via the SDK (desktop, mobile, CLI, web). |
| **Connector** | A module implementing the StorageConnector trait for a specific storage provider. |
| **Device** | A physical or virtual machine running a StorageOS Agent, registered to an Account. |
| **Discovery** | The process of finding other Agents on the network (mDNS, relay, manual). |
| **Entry** | The universal storage item (file or folder). Provider-agnostic. Replaces "DirectoryEntry." |
| **EntryRef** | A cross-device, cross-provider pointer to an Entry (device + provider + root + path). |
| **Pairing** | The cryptographic process of establishing trust between two devices under one Account. |
| **Presence** | The real-time status of a device (online, offline, syncing, etc.). |
| **Provider** | A storage service (local disk, Google Drive, OneDrive, NAS, etc.) accessed through a connector. |
| **Root** | A navigable top-level container within a Provider (drive, bucket, library, mount, volume). Replaces "Drive." |
| **SDK** | The StorageOS client library that abstracts transport, auth, and protocol. |
| **Session** | An authenticated client connection to a local Agent. Ephemeral. |
| **Transfer** | A file operation (copy/move) managed by the Transfer Engine, possibly cross-device or cross-provider. |

---

## 29. Architectural Changes from Revision 1

This section documents every major change from v1.0 to v2.0 and the rationale.

### 29.1 Added: Account Architecture (Section 3)

**v1.0:** No concept of account ownership. Devices had a UUID and a hostname. Nothing tied devices together.

**v2.0:** Account is the root of the identity model. Devices belong to Accounts. Providers connect to Accounts. Settings roam across Accounts.

**Rationale:** A distributed platform requires a concept of "who." Without Accounts, there is no multi-device, no pairing, no shared clipboard, no roaming settings. The v1.0 device model was a health-check struct, not an identity.

### 29.2 Expanded: Device Registry (Section 4)

**v1.0:** 5 fields (device_id, device_name, platform, arch, agent_version).

**v2.0:** 20+ fields including device_type, capabilities, storage providers, presence, battery, network_type, public_key, certificate, trust_level, last_seen, last_sync.

**Rationale:** A device in a distributed platform is not a hostname string. It is an entity with capabilities, trust, presence, and state. The v1.0 model could not answer "Is this device online?" or "Can I send a file to it?"

### 29.3 Added: Pairing Architecture (Section 5)

**v1.0:** "Future: sign into StorageOS account on a central server."

**v2.0:** Full cryptographic pairing protocol using pair codes, QR codes, ECDH key exchange, Ed25519 signatures, and device certificates. Works without any central server.

**Rationale:** The v1.0 approach required a running server, used passwords (phishable), and was handwaved as "future." A distributed platform must be able to establish trust between devices without cloud infrastructure. The pairing protocol is the foundation of multi-device.

### 29.4 Added: Discovery (Section 6)

**v1.0:** "Devices discover each other via the central API."

**v2.0:** Layered strategy: local cache → mDNS → relay (future) → manual. Works on local networks without any server.

**Rationale:** Discovery that requires a cloud server is not offline-first. mDNS is zero-configuration and works on every home and office network. It is the right default.

### 29.5 Redesigned: Communication Architecture (Section 7)

**v1.0:** HTTP + WebSocket everywhere.

**v2.0:** Named Pipes / Unix Domain Sockets for local IPC. TCP+TLS for network peers. QUIC for future mobile. MessagePack binary protocol. HTTP retained as compatibility layer.

**Rationale:** HTTP is wrong for local IPC (unnecessary TCP overhead, port conflicts, slower than pipes). REST is wrong for bidirectional streaming. A message-based protocol over native IPC is faster, simpler, and more expressive. HTTP stays for web clients and debugging.

### 29.6 Added: StorageOS SDK (Section 8)

**v1.0:** Clients make raw HTTP calls.

**v2.0:** All clients go through a typed SDK that handles authentication, transport selection, retry, reconnection, caching, and serialization. The SDK core is written in Rust and exposed to other platforms via FFI.

**Rationale:** Without the SDK, every client must implement transport negotiation, error handling, reconnection, and serialization. The SDK is the contract between the Agent and the outside world. It ensures all clients behave consistently and enables transport changes without client rewrites.

### 29.7 Added: Permissions (Section 9)

**v1.0:** Single API key grants full access.

**v2.0:** Per-device permissions (13 capabilities). Designed to evolve into RBAC.

**Rationale:** "Any client can do anything" fails the moment there are multiple devices with different trust levels. A phone should not have the same permissions as the account-creator desktop. The permission model is flat and simple for MVP but structurally ready for enterprise roles.

### 29.8 Added: Presence (Section 10)

**v1.0:** No presence concept.

**v2.0:** 7 presence states, heartbeat protocol, real-time updates to all peers and clients.

**Rationale:** In a multi-device platform, "Is this device online?" is a fundamental question. Presence answers it.

### 29.9 Added: Clipboard Architecture (Section 11)

**v1.0:** No clipboard. It was a TypeScript array in the desktop UI store.

**v2.0:** Agent-owned clipboard with persistence, history, cross-device sync, expiration, and permissions.

**Rationale:** The clipboard is a platform feature, not a UI feature. It must persist across UI restarts and synchronize across devices.

### 29.10 Expanded: Notification Architecture (Section 12)

**v1.0:** Notifications were a subsection of the Event Bus.

**v2.0:** First-class notification system with persistence, categories, priorities, delivery targets, cross-device propagation, and per-category user preferences.

**Rationale:** Notifications are the Agent's voice. In a headless distributed system, the user may not have any UI open. Notifications are how the Agent communicates important events.

### 29.11 Changed: Execution Mode (Section 13)

**v1.0:** Windows Service (default), Tray Mode (optional).

**v2.0:** Background user process (MVP default). Tray companion deferred. Windows Service deferred to Phase 3+.

**Rationale:** Windows Services cannot access user files without ACL changes, cannot show Toast notifications, cannot launch OAuth flows, and require admin install. A background user process does all of these natively. It is the right choice for a personal storage platform.

### 29.12 Changed: Search Strategy (Section 16)

**v1.0:** Tantivy full-text engine with background indexing and scheduled sweeps.

**v2.0:** SQLite FTS5 for MVP. Tantivy deferred to Phase 5.

**Rationale:** The current app searches by filename in a single directory. SQLite FTS5 extends this to cross-directory search without adding a second database engine. Tantivy is powerful but unnecessary until content indexing or million-file scale is needed.

### 29.13 Deferred: Plugin Architecture (Section 17)

**v1.0:** Full plugin system with dynamic libraries, C FFI, sandboxing, manifests.

**v2.0:** Deferred to Phase 6. All connectors compiled into the Agent binary.

**Rationale:** No users need plugins before the built-in connectors are mature. FFI sandboxing is a large security surface. ABI stability constrains iteration. Build it when there is demand.

### 29.14 Added: Evolution Roadmap (Section 26)

**v1.0:** Migration path from Tauri → Agent.

**v2.0:** 7-phase roadmap from Desktop (Phase 1) through Enterprise (Phase 7), with clear capabilities at each phase.

**Rationale:** A 5-year architecture needs a roadmap that shows which features matter at each stage. The roadmap prevents MVP over-engineering by making it explicit what is deferred and why.

---

## Related Documents

- `docs/architecture/DomainModel.md` — Canonical domain model (Entry, Root, EntryRef, events, identifiers)
- `.ai/ARCHITECTURE.md` — System boundaries and tech stack
- `.ai/DECISIONS.md` — Architectural decision records
- `docs/prd/PRD-001-Product-Overview.md` — Product scope
- `docs/prd/PRD-004-Device-Management.md` — Device requirements
- `docs/prd/PRD-005-Storage-Provider-Management.md` — Provider requirements
- `docs/prd/PRD-007-File-Operations-Transfer-Engine.md` — Transfer requirements
- `docs/prd/PRD-008-Search-Indexing.md` — Search requirements
- `docs/prd/PRD-009-Synchronization-Engine.md` — Sync requirements
- `docs/prd/PRD-010-Notifications-Activity-Timeline.md` — Notification requirements
- `docs/prd/PRD-014-Settings-Preferences.md` — Settings requirements
- `docs/vision/Chapter-03-Product-Vision.md` — Product vision
- `docs/vision/Chapter-12-Product-Roadmap.md` — Phase roadmap
