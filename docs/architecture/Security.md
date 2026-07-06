# StorageOS Security Architecture

**Document ID:** ARCH-SEC-001
**Version:** 1.0
**Date:** 2026-07-04
**Status:** Draft

---

## 1. Device Identity

Every StorageOS device possesses a permanent cryptographic identity generated on first launch:

- **Device UUID**: UUID v4, stored in SQLite `agent_identity` table
- **Ed25519 Keypair**: Signing key (private) and verifying key (public)
- **Fingerprint**: Human-readable identifier derived from the public key via SHA-256

The private key never leaves the device. The public key and fingerprint are shared during pairing and stored by trusted peers.

### Key Generation

```
First Launch:
1. Generate UUID v4 → device_id
2. Generate Ed25519 keypair via OS CSPRNG
3. SHA-256(public_key_bytes) → take first 6 bytes → format as XXXX-XXXX-XXXX
4. Store private_key, public_key, fingerprint in agent_identity table
```

### Key Storage (MVP)

Keys are stored in the SQLite `agent_identity` table as hex-encoded strings. Future versions should migrate to OS-native key stores:

| Platform | Key Store |
|----------|-----------|
| Windows | DPAPI / Windows Credential Manager |
| macOS | Keychain |
| Linux | libsecret / GNOME Keyring |
| Android | Android Keystore |

---

## 2. Trust Model

Trust is established through pairing, not network proximity. Two devices on the same LAN are NOT trusted by default.

### Trust States

| State | Meaning |
|-------|---------|
| `pending` | Pairing initiated, not yet confirmed |
| `trusted` | Pairing complete, device is trusted |
| `revoked` | Trust explicitly removed by user |

### Trust Record (per device)

Each trusted device stores the following about its peers:

- Device ID
- Friendly Name
- Public Key (hex-encoded Ed25519)
- Fingerprint (XXXX-XXXX-XXXX)
- Paired Timestamp
- Last Verified Timestamp
- Trust Status

### Trust Establishment

Trust is established exclusively through the pairing protocol. There is no implicit trust based on:
- Network location (same LAN)
- IP address
- Hostname
- Previously seen addresses

---

## 3. Pairing Protocol

### QR Pairing Flow

```
Device A (initiator)              Device B (joiner)
─────────────────────             ──────────────────

1. Generate pairing_token (UUID)
2. Display QR code containing:
   - device_id
   - host:port
   - name
   - pairing_token
   - version
   - public_key (Ed25519)
   - fingerprint
                                  3. Scan QR code
                                  4. POST /devices/pair with:
                                     - own device_id
                                     - own public_key
                                     - pairing_token (from QR)

5. Validate pairing_token
6. Store Device B's identity:
   - device_id
   - public_key
   - trust_status = "trusted"
7. Return own identity:
   - device_id
   - public_key
   - fingerprint
                                  8. Store Device A's identity:
                                     - device_id
                                     - public_key
                                     - trust_status = "trusted"
```

### What is exchanged

| Field | Shared | Purpose |
|-------|--------|---------|
| device_id | Yes | Unique device identifier |
| public_key | Yes | Ed25519 verifying key for future auth |
| fingerprint | Yes | Human-readable verification |
| pairing_token | Yes (QR only) | One-time pairing authorization |
| private_key | **Never** | Stays on originating device |

---

## 4. Connection Verification

When a device connects, its claimed identity can be verified against the stored trust record:

1. Device presents its device_id and public_key
2. Agent looks up stored public_key for that device_id
3. Compare: stored key == presented key
4. If mismatch → reject connection (potential impersonation)
5. If match → update last_verified timestamp

### Identity Verification Results

| Result | Meaning | Action |
|--------|---------|--------|
| Match | Key matches stored record | Allow, update last_verified |
| Mismatch | Key differs from stored | Reject, log warning |
| NoKey | No stored key or presented key empty | Allow (legacy compat), log notice |

---

## 5. Certificate Model

A certificate data model is defined for future TLS mutual authentication. No TLS is implemented in MVP.

```
DeviceCertificate {
    device_id:        DeviceId
    public_key:       String (hex)
    fingerprint:      String (XXXX-XXXX-XXXX)
    created_at:       i64 (epoch)
    expires_at:       Option<i64>
    issuer_device_id: Option<DeviceId>
    signature:        Option<String>
    revoked:          bool
}
```

This model supports:
- Self-signed certificates (issuer = self)
- Chain of trust (issuer = another device)
- Expiration and renewal
- Revocation

---

## 6. Future: TLS

When TLS is implemented:

1. Each device generates a self-signed X.509 certificate from its Ed25519 keypair
2. The certificate is exchanged during pairing (extends current flow)
3. All device-to-device connections use mutual TLS (both sides present certificates)
4. Certificate validation checks against stored trust records, not a CA
5. Certificate rotation: new cert signed by old key, distributed to peers

No changes to the Device Registry schema are needed — the `public_key` and `fingerprint` fields already store the identity that TLS certificates will bind to.

---

## 7. Relay Security

The relay server (`services/storageos-relay/`, UC-006) is now implemented. Current security posture:

### Current (No TLS)
1. Device authenticates to relay via HELLO message containing its Ed25519 public key and fingerprint
2. Relay validates HELLO structure but does not cryptographically verify signatures (pre-TLS)
3. Relay forwards messages as opaque JSON — it reads only the `destination` field for routing
4. No message payloads are stored or logged

### Future: TLS + E2E Encryption
1. Device authenticates to relay using its Ed25519 keypair via TLS client certificates
2. Relay verifies device identity cryptographically
3. End-to-end encryption between devices using their Ed25519 keys (via X25519 key agreement)
4. Relay sees only opaque encrypted blobs and routing metadata

### Relay-Specific Risks
- **No TLS yet**: Messages in transit are plaintext. Acceptable for LAN relay; must be addressed before internet-facing deployment.
- **No signature verification**: A rogue client can claim any device_id. Mitigated by LAN-only scope for now.
- **In-memory only**: No persistence = no forensic trail, but also no data-at-rest exposure.

The identity model from UC-004 is sufficient for relay — no schema changes were needed.

---

## 8. Threat Model

### In Scope (MVP)

| Threat | Mitigation |
|--------|------------|
| Device impersonation on LAN | Public key verification at connection |
| Unauthorized pairing | One-time pairing token with short lifetime |
| Identity theft after device compromise | Key never leaves device; revocation available |
| Stale trust after device wipe | Fingerprint changes on re-keying; mismatch detected |

### Out of Scope (MVP)

| Threat | Deferred To |
|--------|-------------|
| Man-in-the-middle (no TLS) | Phase 2: TLS |
| Traffic sniffing on LAN (no encryption) | Phase 2: TLS |
| Replay attacks | Phase 2: Signed messages |
| Relay server compromise | Phase 3: E2E encryption |
| Key compromise recovery | Phase 3: Key rotation + revocation propagation |
| Physical device theft | OS-level device encryption (external) |

### Accepted Risks (MVP)

1. **No transport encryption**: LAN traffic is unencrypted. Acceptable for home/office networks; unacceptable for untrusted networks.
2. **SQLite key storage**: Private keys stored in plaintext SQLite. Acceptable for MVP; must migrate to OS keystore before public release.
3. **No message signing**: Messages are not signed. A compromised network device could inject messages. Mitigated by same-LAN assumption.

---

## 9. Design Principles

1. **Identity is permanent**: A device's keypair is generated once and never changes unless explicitly re-keyed.
2. **Trust is explicit**: Only pairing establishes trust. Network proximity is not trust.
3. **Keys are local**: Private keys never leave the device, not even to other trusted devices.
4. **Transport-independent**: The identity and trust model works identically over LAN, Relay, USB, Bluetooth, or VPN.
5. **Forward-compatible**: The current schema supports TLS, relay, key rotation, and revocation without structural changes.
