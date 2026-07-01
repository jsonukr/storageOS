# StorageOS Domain Model

**Document ID:** ARCH-DOMAIN-001
**Version:** 1.0
**Status:** Draft
**Date:** 2026-07-01
**Author:** Claude Code (Architecture Sprint A-002.5)
**Approved by:** Pending (Tech Lead + Product Owner)

---

## 1. Purpose

This document defines the canonical domain language for StorageOS.

Every crate, every SDK, every client, every connector, and every event uses these names. The names must be provider-agnostic, platform-agnostic, and stable for the next five years.

This is not an API specification. This is not a database schema. This is the shared vocabulary that every StorageOS component speaks.

---

## Part 1: Core Domain Objects

### 1.1 Object Catalog

| Object | What It Represents |
|--------|--------------------|
| **Account** | A person (or future: organization, family). The root of all ownership. |
| **Device** | A physical or virtual machine running a StorageOS Agent. Owned by an Account. |
| **Provider** | A connection to a storage backend (local disk, Google Drive, S3, SMB share). Registered on a Device, visible to the Account. |
| **Root** | A navigable top-level container within a Provider. A drive letter on Windows. A mount point on Linux. A shared library on SharePoint. A bucket on S3. |
| **Entry** | Any item inside a Root. Files and folders are both Entries. The universal unit of storage. |
| **Transfer** | A copy or move operation between two Entries (possibly on different Providers, different Devices). |
| **Clipboard** | An Agent-owned list of Entry references awaiting paste. |
| **Notification** | An Agent-generated message delivered to one or more Devices. |
| **Session** | A client's active connection to a local Agent. |
| **Permission** | A capability granted to a Device by the Account owner. |

### 1.2 Detailed Definitions

**Account**

The root identity. Created on the first device during setup. Propagated to other devices via pairing. Everything ultimately belongs to an Account: Devices, Providers, Settings, Clipboard, Notifications.

An Account is NOT a user login. There is no username. There is no password. The Account is an Ed25519 key pair. Trust is established cryptographically, not via credentials.

**Device**

A machine running a StorageOS Agent. Has hardware metadata (type, OS, architecture), capabilities (what it can do), presence (what it is doing now), and trust (is it allowed to participate).

A Device is NOT an application instance. If the desktop app and the CLI both run on the same laptop, there is one Device (one Agent) and two Sessions.

**Provider**

An active connection to a storage backend. A Provider has a type (local filesystem, Google Drive, OneDrive, S3, SMB, etc.), a status (connected, disconnected, auth required), and capabilities (which operations it supports).

A Provider is NOT a drive. A Provider is the connection to the service. A single Google Drive account is one Provider. The local filesystem on Windows is one Provider. An SMB share is one Provider.

**Root**

A navigable top-level entry point within a Provider. For the local filesystem Provider on Windows, each drive letter (`C:\`, `D:\`) is a Root. For Google Drive, "My Drive" is a Root and each Shared Drive is a Root. For S3, each bucket is a Root. For SharePoint, each document library is a Root.

Root replaces the Windows-centric "Drive" concept. A drive is just one kind of Root.

**Entry**

The universal storage item. Files and folders are both Entries. An Entry has a name, a path (within its Root), a kind (file or folder), size, timestamps, and provider-specific metadata.

Entry replaces `DirectoryEntry`. The name "DirectoryEntry" presumes a filesystem with directories. On S3 there are no directories — there are prefixes. On SharePoint there are libraries and folders. "Entry" is the neutral term that works everywhere.

**Transfer**

An operation that moves data from a source Entry to a destination path. Transfers may be intra-provider (same Google Drive), cross-provider (Google Drive → local), or cross-device (laptop → phone). Transfers have lifecycle states (queued, running, paused, completed, cancelled, failed), progress tracking, and pause/resume/cancel support.

**Clipboard**

The set of Entry references the user has copied or cut. Owned by the Agent, persisted to SQLite, synchronized across devices. Clipboard entries reference their source Provider and Device — the actual data is not copied until paste.

**Notification**

An Agent-generated message. Has a category, priority, title, body, source Device, and delivery target. Persisted. Read/unread state tracked.

**Session**

An authenticated connection from a client (desktop app, CLI, mobile app, web) to a local Agent. Sessions are ephemeral — they start when the client connects and end when it disconnects. Multiple Sessions can exist simultaneously on one Device.

**Permission**

A capability assigned to a Device by the Account owner. Controls what the Device's Agent is allowed to do: read, write, delete, transfer, clipboard access, settings modification, device management, provider management.

### 1.3 Ownership

```
Account (root of everything)
├── owns → Device[]
├── owns → Provider[] (via Devices)
├── owns → Clipboard (synced across Devices)
├── owns → Notification[] (delivered to Devices)
└── owns → Settings (roaming subset)

Device
├── owned by → Account
├── hosts → Provider[]
├── hosts → Session[] (ephemeral)
├── has → Permission (granted by Account owner)
└── has → Presence (current state)

Provider
├── registered on → Device
├── visible to → Account (all Devices can see it)
├── contains → Root[]
└── has → ConnectorCapabilities

Root
├── belongs to → Provider
└── contains → Entry[] (tree structure)

Entry
├── lives in → Root
├── references → Provider (for operations)
└── has → EntryMetadata (provider-specific extras)

Transfer
├── source → EntryRef (Provider + path)
├── destination → EntryRef (Provider + path)
├── initiated by → Device
└── has → TransferProgress

Clipboard
├── owned by → Account
├── last written by → Device
├── contains → ClipboardEntry[]
└── each ClipboardEntry references → EntryRef[]
```

---

## Part 2: Hierarchy

### 2.1 The Complete Hierarchy

```
Account
  │
  ├── Device
  │     │
  │     ├── Provider
  │     │     │
  │     │     ├── Root
  │     │     │     │
  │     │     │     └── Entry
  │     │     │           ├── Entry (folder children)
  │     │     │           └── Entry (file — leaf node)
  │     │     │
  │     │     └── Root (another root in same provider)
  │     │
  │     └── Provider (another provider on same device)
  │
  ├── Device (another device in the account)
  │
  ├── Clipboard (account-wide)
  │
  └── Notification[] (account-wide)
```

### 2.2 Why This Hierarchy

**Account at the top.** Everything begins with "who." Without an Account, there are no Devices. Without Devices, there are no Providers. The Account is the trust anchor.

**Device below Account.** A Device is a physical machine. Providers are attached to Devices because a Provider connection requires credentials stored on a specific machine. The local filesystem Provider on my laptop is not accessible from my phone — it exists on the Device where it runs.

**Provider below Device.** A Provider is a connection to a storage backend. It is registered on a Device. When the user connects Google Drive on their laptop, that is a Provider on that Device. If they also connect Google Drive on their phone, that is a separate Provider instance (separate OAuth token) on a different Device.

**Root below Provider.** A Provider exposes one or more Roots. The local filesystem on Windows exposes `C:\`, `D:\`, etc. Google Drive exposes "My Drive" plus any Shared Drives. S3 exposes buckets. SharePoint exposes document libraries.

**Entry below Root.** Entries are the contents — files and folders. They form a tree within each Root. Entries never cross Root boundaries (a file is always in exactly one Root).

### 2.3 Cross-Cutting Concerns

Some objects are not part of the hierarchy. They reference the hierarchy but are not contained by it:

| Object | Relationship |
|--------|-------------|
| Transfer | References a source Entry and a destination path. May span Providers and Devices. |
| Clipboard | References Entry paths. May reference Entries from multiple Providers. |
| Notification | References a source Device. Delivered to one or all Devices. |
| Session | A client connection to a Device's Agent. Not part of the storage hierarchy. |
| Permission | Granted per-Device. Controls what the Device can do. |

---

## Part 3: Composition Over Inheritance

### 3.1 The Question

Should File, Folder, Drive, Bucket, Library, and Share all inherit from a base type?

### 3.2 The Answer: Composition

StorageOS uses composition with an `EntryKind` discriminator, not inheritance.

```
Entry {
    id:         EntryId,
    name:       String,
    path:       String,         // relative to its Root
    kind:       EntryKind,      // file | folder
    size:       u64,            // 0 for folders (or provider-reported total)
    created_at: Option<Timestamp>,
    modified_at: Option<Timestamp>,
    metadata:   EntryMetadata,  // provider-specific extras
}

enum EntryKind {
    File,
    Folder,
}
```

And Root uses a `RootKind` discriminator:

```
Root {
    id:         RootId,
    name:       String,         // "C:", "My Drive", "shared-bucket"
    kind:       RootKind,
    provider:   ProviderId,
    capacity:   Option<StorageCapacity>,
    metadata:   RootMetadata,   // provider-specific extras
}

enum RootKind {
    Drive,          // Windows drive letter, Linux mount point
    Bucket,         // S3, GCS, Azure Blob
    Library,        // SharePoint document library
    SharedDrive,    // Google Shared Drive, OneDrive shared
    Volume,         // NAS volume, Docker volume
    Mount,          // SMB/NFS mount, FUSE mount
    Container,      // generic — future providers
}
```

### 3.3 Why Not Inheritance

**Inheritance couples structure to implementation.** If `File extends Entry` and `Folder extends Entry`, every consumer must handle both subtypes. Serialization becomes polymorphic. Pattern matching grows. Every new subtype (symlink? shortcut? alias?) requires changes to every consumer.

**Providers disagree on what a "folder" is.** On a local filesystem, a folder is a real object with its own inode. On S3, a folder is a prefix — it does not exist as an object. On Google Drive, a folder is a file with a special MIME type. Inheritance forces these differences into a shared type hierarchy. Composition lets each provider fill in what it has and leave the rest empty.

**RootKind captures the meaningful difference.** The difference between a Windows drive and an S3 bucket is not structural — both contain Entries. The difference is _contextual_: how they are displayed, how they are mounted, what operations they support. `RootKind` captures this without subclassing.

### 3.4 EntryMetadata: Provider-Specific Extensions

Different providers have different metadata. Google Drive has `mimeType` and `shared`. OneDrive has `sharingLink`. Local filesystem has `hidden` and `readonly`. S3 has `storageClass`.

Rather than polluting the Entry struct with nullable fields for every provider, metadata is a separate struct:

```
EntryMetadata {
    hidden:         Option<bool>,       // local filesystem
    readonly:       Option<bool>,       // local filesystem
    system:         Option<bool>,       // Windows-specific
    archive:        Option<bool>,       // Windows-specific
    mime_type:      Option<String>,     // cloud providers
    thumbnail_url:  Option<String>,     // cloud providers
    shared:         Option<bool>,       // cloud providers
    version_id:     Option<String>,     // versioned providers (S3, GCS)
    storage_class:  Option<String>,     // S3, GCS
    custom:         HashMap<String, String>, // escape hatch for unmodeled fields
}
```

This is a flat struct, not a provider-specific enum. Why: because the UI needs to display metadata from any provider uniformly. A `PropertiesPanel` should show "Hidden: yes" for a local file and "Storage class: GLACIER" for an S3 object without branching on provider type. A flat optional struct with a `custom` map gives maximum flexibility with zero dispatching.

### 3.5 RootMetadata: Root-Level Extras

```
RootMetadata {
    file_system:    Option<String>,     // "NTFS", "ext4", "FAT32" — local drives
    is_removable:   Option<bool>,       // USB drives
    is_ready:       Option<bool>,       // drive may not be mounted
    mount_point:    Option<String>,     // Linux/macOS mount path
    region:         Option<String>,     // S3 bucket region
    url:            Option<String>,     // SharePoint site URL, SMB share path
    custom:         HashMap<String, String>,
}
```

---

## Part 4: Naming Review

### 4.1 Renames

| Current Name | New Name | Rationale |
|-------------|----------|-----------|
| `DirectoryEntry` | **`Entry`** | "Directory" is filesystem-specific. S3 has no directories. SharePoint has libraries. "Entry" is the neutral term for any storage item. |
| `LocalDrive` / `DriveInfo` | **`Root`** | A "drive" is Windows-centric. Linux has mount points. Cloud has buckets/libraries. "Root" is the universal navigable top-level container. |
| `DriveType` | **`RootKind`** | Matches the rename from Drive to Root. "Kind" is preferred over "Type" in Rust to avoid the `type` keyword. |
| `FileAttributes` | **`EntryMetadata`** | Attributes are one piece of metadata. Other providers have different metadata (MIME type, storage class, sharing state). The unified name covers all providers. |
| `ClipboardItem` | **`EntryRef`** (inside `ClipboardEntry`) | A clipboard item IS an Entry reference. Calling it `EntryRef` makes the relationship explicit and allows reuse in other contexts (transfer sources, bookmarks). |
| `ClipboardOperation` | **`ClipboardAction`** | "Operation" is overloaded (file operations, transfer operations). "Action" is more natural: "the clipboard action is Copy." |
| `TransferProgress` | **`TransferSnapshot`** | "Progress" implies forward movement. A paused transfer has a snapshot too. "Snapshot" captures the state at a point in time regardless of direction. |
| `SearchProgressPayload` | **`SearchSnapshot`** | Same rationale as TransferSnapshot. Consistent naming. |

### 4.2 Names Kept

| Current Name | Verdict | Rationale |
|-------------|---------|-----------|
| `Account` | **Keep** | Clean, universal, future-proof. |
| `Device` | **Keep** | Clear and platform-agnostic. |
| `Provider` | **Keep** | Better than "Connector" for the user-facing concept. (Connector is the implementation trait; Provider is the domain concept.) |
| `Transfer` | **Keep** | Universally understood. |
| `TransferStatus` | **Keep** | The enum values (queued, running, paused, completed, cancelled, failed) are correct. |
| `TransferType` | **Keep** | Copy and Move are the right operations. |
| `OperationResult` | **Keep** | Generic enough for create/rename/delete. |
| `Notification` | **Keep** | Standard term. |
| `CoreError` / `ErrorKind` | **Keep** | Correctly named. |
| `ConnectorCapabilities` | **Keep** | "Connector" is appropriate for the implementation trait. |
| `ConnectorStatus` | **Keep** | Same. |

### 4.3 New Names Introduced

| Name | Purpose |
|------|---------|
| `Root` | Top-level navigable container within a Provider |
| `RootKind` | Discriminator: Drive, Bucket, Library, SharedDrive, Volume, Mount, Container |
| `Entry` | Universal storage item (file or folder) |
| `EntryKind` | Discriminator: File, Folder |
| `EntryRef` | A reference to an Entry by Provider + Root + path. Used in Clipboard, Transfer source/destination, bookmarks. |
| `EntryMetadata` | Provider-specific metadata on an Entry |
| `RootMetadata` | Provider-specific metadata on a Root |
| `StorageCapacity` | Total/free/used bytes for a Root |
| `ClipboardEntry` | A single clipboard action (copy or cut of one or more EntryRefs) |
| `ClipboardAction` | Copy or Cut |
| `TransferSnapshot` | Point-in-time state of a Transfer |
| `SearchSnapshot` | Point-in-time state of a Search operation |
| `Session` | Client connection to local Agent |
| `Presence` | Device's current operational state |
| `TrustLevel` | Device trust: pending, trusted, revoked |
| `NetworkKind` | wifi, ethernet, cellular, offline |
| `DeviceKind` | desktop, laptop, phone, tablet, server, nas |

---

## Part 5: Cross-Provider Compatibility

### 5.1 Compatibility Matrix

Each domain object must work across all providers. The table below verifies this.

| Object | Windows FS | Linux FS | macOS FS | Android | Google Drive | OneDrive | Dropbox | SharePoint | S3 | SMB | FTP | NAS |
|--------|-----------|---------|---------|---------|-------------|---------|---------|-----------|---|-----|-----|-----|
| **Account** | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| **Device** | desktop/laptop | desktop/server | desktop/laptop | phone/tablet | n/a | n/a | n/a | n/a | n/a | n/a | n/a | nas/server |
| **Provider** | LocalFS | LocalFS | LocalFS | LocalFS | GoogleDrive | OneDrive | Dropbox | SharePoint | S3 | SMB | FTP | NAS-specific |
| **Root** | C:\, D:\ | /, /home | / , /Volumes/x | /storage/emulated/0 | My Drive, Shared Drives | OneDrive root, Shared | Root folder | Document libraries | Buckets | Share root | FTP root | Volumes |
| **RootKind** | Drive | Mount | Mount | Mount | SharedDrive | SharedDrive | Container | Library | Bucket | Mount | Mount | Volume |
| **Entry** | file/folder | file/folder | file/folder | file/folder | file/folder | file/folder | file/folder | file/folder | object (≈file) | file/folder | file/folder | file/folder |
| **EntryMetadata.hidden** | yes | yes (dot-prefix) | yes (dot-prefix) | yes | no | no | no | no | no | yes | no | yes |
| **EntryMetadata.readonly** | yes | yes (permissions) | yes (permissions) | yes | no (sharing) | no (sharing) | no | no (sharing) | no | yes | no | yes |
| **EntryMetadata.mime_type** | no* | no* | no* (UTI) | no* | yes | yes | yes | yes | yes | no | no | no |
| **Transfer** | works | works | works | works | works | works | works | works | works (multipart) | works | works | works |
| **Clipboard** | works | works | works | works | works | works | works | works | works | works | works | works |

\* Local filesystems can derive MIME type from extension but do not store it natively.

### 5.2 S3 Special Case: Folders

S3 does not have real folders. A "folder" is a common prefix in the object key (e.g., `photos/2026/` is a prefix, not a directory object).

StorageOS handles this transparently:
- The S3 connector lists common prefixes as Entries with `kind: Folder`
- The UI displays them identically to real folders
- The user never knows the difference
- Creating a "folder" on S3 creates a zero-byte object with a trailing slash key (`photos/2026/`)

This is why Entry uses `EntryKind::Folder` instead of subclassing a `Directory` type — there is no real directory to subclass on S3.

### 5.3 SharePoint Special Case: Libraries

SharePoint organizes content into document libraries, not drives or buckets. Each library is a Root with `kind: Library`. Within a library, items are Entries like anywhere else.

### 5.4 Linux Special Case: No Drive Letters

Linux has mount points, not drive letters. Each mount point (`/`, `/home`, `/mnt/usb`) is a Root with `kind: Mount`. The `Root.name` is the mount path. There is no "letter" field — that is Windows-specific metadata captured in `RootMetadata` for local providers.

### 5.5 Android Special Case: Scoped Storage

Android's scoped storage model restricts access to specific directories. The Android Provider exposes each accessible scope (Documents, Downloads, Pictures, etc.) as a Root. The Provider connector handles the Android content resolver API internally.

---

## Part 6: Events

### 6.1 Event Naming Convention

All events follow the pattern: `{Domain}.{Action}`

- Domain: the aggregate root the event belongs to
- Action: past tense verb describing what happened

This creates a natural namespace for event subscriptions: `transfer.*`, `provider.*`, `device.*`.

### 6.2 Canonical Events

#### Storage Events

| Event | Emitted When | Payload |
|-------|-------------|---------|
| `entry.created` | A file or folder is created | `{ entry: Entry, root: RootId, provider: ProviderId }` |
| `entry.modified` | A file's content or metadata changes | `{ entry: Entry, root: RootId, provider: ProviderId }` |
| `entry.deleted` | A file or folder is deleted | `{ path: String, root: RootId, provider: ProviderId }` |
| `entry.renamed` | A file or folder is renamed | `{ old_path: String, new_entry: Entry }` |
| `entry.moved` | An entry is moved to a new location | `{ old_path: String, new_entry: Entry }` |

#### Transfer Events

| Event | Emitted When | Payload |
|-------|-------------|---------|
| `transfer.queued` | A new transfer is added to the queue | `{ transfer_id: TransferId }` |
| `transfer.started` | A transfer begins execution | `{ transfer_id: TransferId }` |
| `transfer.progress` | Periodic progress update (every ~100ms) | `{ snapshot: TransferSnapshot }` |
| `transfer.paused` | A transfer is paused | `{ transfer_id: TransferId }` |
| `transfer.resumed` | A paused transfer resumes | `{ transfer_id: TransferId }` |
| `transfer.completed` | A transfer finishes successfully | `{ transfer_id: TransferId, elapsed_ms: u64 }` |
| `transfer.failed` | A transfer fails | `{ transfer_id: TransferId, error: String }` |
| `transfer.cancelled` | A transfer is cancelled by the user | `{ transfer_id: TransferId }` |

#### Provider Events

| Event | Emitted When | Payload |
|-------|-------------|---------|
| `provider.connected` | A provider establishes connection | `{ provider_id: ProviderId, name: String }` |
| `provider.disconnected` | A provider loses connection | `{ provider_id: ProviderId, reason: String }` |
| `provider.auth_required` | Provider credentials expired | `{ provider_id: ProviderId }` |
| `provider.root_added` | A new Root appears (USB inserted, shared drive added) | `{ root: Root }` |
| `provider.root_removed` | A Root disappears (USB ejected, share unmounted) | `{ root_id: RootId }` |

#### Device Events

| Event | Emitted When | Payload |
|-------|-------------|---------|
| `device.online` | A paired device becomes reachable | `{ device_id: DeviceId }` |
| `device.offline` | A paired device becomes unreachable | `{ device_id: DeviceId }` |
| `device.presence_changed` | A device's presence state changes | `{ device_id: DeviceId, presence: Presence }` |
| `device.paired` | A new device is paired | `{ device: Device }` |
| `device.removed` | A device is revoked/removed | `{ device_id: DeviceId }` |

#### Clipboard Events

| Event | Emitted When | Payload |
|-------|-------------|---------|
| `clipboard.updated` | Clipboard content changes (copy, cut, clear) | `{ action: ClipboardAction, count: u32 }` |
| `clipboard.synced` | Clipboard synced from another device | `{ source_device: DeviceId }` |
| `clipboard.expired` | A clipboard entry expired | `{ entry_id: ClipboardEntryId }` |

#### Search Events

| Event | Emitted When | Payload |
|-------|-------------|---------|
| `search.started` | A search begins | `{ query: String, root: Option<RootId> }` |
| `search.progress` | Periodic progress update | `{ snapshot: SearchSnapshot }` |
| `search.completed` | Search finishes | `{ query: String, result_count: u32, elapsed_ms: u64 }` |

#### Notification Events

| Event | Emitted When | Payload |
|-------|-------------|---------|
| `notification.created` | A new notification is generated | `{ notification: Notification }` |
| `notification.read` | A notification is marked as read | `{ notification_id: NotificationId }` |
| `notification.dismissed` | A notification is dismissed | `{ notification_id: NotificationId }` |

---

## Part 7: Identifiers

### 7.1 Identifier Design

All identifiers are opaque, globally unique, and strongly typed.

```
AccountId(Uuid)
DeviceId(Uuid)
ProviderId(Uuid)
RootId(String)          // provider-dependent format (see below)
EntryId(String)         // provider-dependent format (see below)
TransferId(Uuid)
ClipboardEntryId(Uuid)
NotificationId(Uuid)
SessionId(Uuid)
```

### 7.2 Why Most IDs Are UUIDs

UUIDs (v4, random) are:
- Globally unique without coordination (no central ID server)
- Generated offline
- Safe to merge across devices (no collision)
- Opaque (no encoded semantics to break)

This fits StorageOS's distributed, offline-first nature.

### 7.3 Why RootId and EntryId Are Strings

Providers have native IDs that are NOT UUIDs:

| Provider | Root ID Format | Entry ID Format |
|----------|---------------|----------------|
| Local FS (Windows) | `"C:"`, `"D:"` | `"C:\\Users\\Dhananjay\\file.txt"` (full path) |
| Local FS (Linux) | `"/"`, `"/mnt/usb"` | `"/home/user/file.txt"` (full path) |
| Google Drive | `"root"`, `"shared-drive-id"` | Google file ID (`"1BxiMVs..."`) |
| OneDrive | `"root"` | OneDrive item ID |
| S3 | `"my-bucket"` | Object key (`"photos/2026/sunset.jpg"`) |
| SharePoint | Site + Library ID | SharePoint item ID |
| SMB | `"\\\\server\\share"` | UNC path |

Forcing these into UUIDs would require a mapping layer that adds latency and complexity. Instead, `RootId` and `EntryId` are `String` wrappers that hold the provider-native identifier. The Provider connector knows how to interpret them.

### 7.4 Composite References

Some operations need to reference an Entry across Provider and Device boundaries. For this, use `EntryRef`:

```
EntryRef {
    device_id:   Option<DeviceId>,  // None = local device
    provider_id: ProviderId,
    root_id:     RootId,
    path:        String,            // relative to root
}
```

`EntryRef` is the universal pointer. Clipboard entries, transfer sources/destinations, and bookmarks all use `EntryRef`.

### 7.5 Identifier Ownership

| ID | Generated By | Scope |
|----|-------------|-------|
| `AccountId` | First device's Agent (on setup) | Global across all devices |
| `DeviceId` | Each device's Agent (on first run) | Global across the Account |
| `ProviderId` | Agent (when a provider is registered) | Unique per Device |
| `RootId` | Provider connector (from native ID) | Unique within its Provider |
| `EntryId` | Provider connector (from native ID) | Unique within its Root |
| `TransferId` | Agent (on transfer creation) | Unique per Device, globally unique via UUID |
| `ClipboardEntryId` | Agent (on clipboard write) | Global across the Account |
| `NotificationId` | Agent (on notification creation) | Global across the Account |
| `SessionId` | Agent (on client connect) | Unique per Device |

---

## Part 8: Relationships

### 8.1 Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                              Account                                 │
│                         (root of everything)                         │
└────┬──────────────┬──────────────┬──────────────┬───────────────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Device   │  │Clipboard │  │Notif.[]  │  │ Settings     │
│ (1..N)   │  │ (shared) │  │ (shared) │  │ (roaming)    │
└────┬─────┘  └──────────┘  └──────────┘  └──────────────┘
     │
     ├── Permission
     ├── Presence
     │
     ▼
┌──────────┐
│ Provider │
│ (0..N)   │
└────┬─────┘
     │
     ├── ConnectorCapabilities
     ├── ConnectorStatus
     │
     ▼
┌──────────┐
│   Root   │
│ (1..N)   │
└────┬─────┘
     │
     ├── RootKind
     ├── StorageCapacity
     ├── RootMetadata
     │
     ▼
┌──────────┐
│  Entry   │◄──── EntryRef (used by Clipboard, Transfer)
│ (0..N)   │
└────┬─────┘
     │
     ├── EntryKind (File | Folder)
     ├── EntryMetadata
     │
     ▼ (if Folder)
┌──────────┐
│  Entry   │  (children — recursive tree)
│ (0..N)   │
└──────────┘
```

### 8.2 Cross-Entity References

```
Transfer ─── source ───► EntryRef
         └── dest ─────► EntryRef

ClipboardEntry ── items ──► EntryRef[]

Notification ── source ──► DeviceId
             └── target ──► DeviceId | AllDevices
```

### 8.3 Cardinality Summary

| Relationship | Cardinality |
|-------------|-------------|
| Account → Device | 1 to many |
| Account → Clipboard | 1 to 1 (shared) |
| Device → Provider | 0 to many |
| Device → Session | 0 to many |
| Device → Permission | 1 to 1 |
| Provider → Root | 1 to many |
| Root → Entry | 0 to many |
| Entry → Entry (children) | 0 to many (recursive) |
| Transfer → EntryRef (source) | 1 to 1 |
| Transfer → EntryRef (dest) | 1 to 1 |
| ClipboardEntry → EntryRef | 1 to many |

---

## Part 9: Future Proofing

### 9.1 Validation Against Future Features

| Future Feature | Model Support | Notes |
|---------------|--------------|-------|
| **Cloud Sync** | Transfer + Entry + Provider. Sync is a scheduled bi-directional Transfer between two Roots. No new domain objects needed — sync jobs are Transfer configurations with a schedule and conflict policy. | Validated |
| **Offline Cache** | Entry + Root. Cached entries are local Entries that mirror remote Entries. The cache is a Provider (`CacheProvider`) with Roots that shadow remote Roots. | Validated |
| **Version History** | `EntryMetadata.version_id`. Providers that support versioning (S3, Google Drive) populate this field. A `listVersions(entry_ref)` operation returns a `Vec<Entry>` where each Entry is a version. | Validated |
| **File Sharing** | `EntryMetadata.shared` + future `ShareLink` object. Sharing creates a reference that external users can access. The Entry itself does not change — a new `ShareLink` references the EntryRef. | Validated |
| **Collaboration** | Account evolves to Organization Account. Members are sub-accounts. Permissions evolve from per-device to per-member (RBAC). No Entry/Root/Provider changes. | Validated |
| **AI (Search, Classify)** | SearchService operates on Entries. AI adds `EntryMetadata.tags`, `EntryMetadata.embeddings_ref` (pointer to vector store). No structural change to Entry. | Validated |
| **Virtual Providers** | A Provider that aggregates other Providers. "All Photos" is a virtual Root that queries all Providers for image entries. The model supports this: a VirtualProvider implements StorageConnector and delegates to real Providers. | Validated |
| **Encryption** | An `EncryptionProvider` wraps another Provider, encrypting entries on write and decrypting on read. To the model, it is just another Provider containing Roots with Entries. | Validated |
| **Backup** | Backup is a scheduled one-way Transfer from one Root to another (e.g., local → S3). Backup policies are Transfer configurations with retention rules. | Validated |
| **Snapshots** | A Snapshot is a frozen point-in-time view of a Root. It is a read-only Root created by the Provider (if supported, e.g., ZFS, S3 versioning). `RootKind::Snapshot` may be added in the future. The model accommodates this by adding a RootKind variant. | Validated |

### 9.2 Model Changes Required for Future Features

| Feature | Model Change | Breaking? |
|---------|-------------|-----------|
| Cloud Sync | New `SyncJob` object (references two Roots) | No — additive |
| Offline Cache | New `CacheProvider` implementation | No — additive |
| Version History | `listVersions` API, uses existing Entry | No — additive |
| File Sharing | New `ShareLink` object | No — additive |
| Collaboration | Account gains `members`, Permission gains `roles` | No — additive |
| AI | EntryMetadata gains `tags`, `embeddings_ref` | No — additive |
| Virtual Providers | New Provider implementation | No — additive |
| Encryption | New Provider wrapper | No — additive |
| Backup | Transfer + schedule configuration | No — additive |
| Snapshots | `RootKind::Snapshot` variant | Non-breaking enum addition |

All future features are additive. None require restructuring the core domain model. This is the primary validation criterion.

---

## Part 10: Migration Strategy

### 10.1 Existing Model → Domain Model Mapping

| Existing (Rust — storageos-core) | Existing (TypeScript) | New Domain Name | Change Type |
|----------------------------------|----------------------|-----------------|-------------|
| `DirectoryEntry` | `DirectoryEntry` | **`Entry`** | Rename + restructure |
| `LocalDrive` | `LocalDriveInfo` | **`Root`** | Rename + restructure |
| `DriveType` | `DriveType` | **`RootKind`** | Rename + expand variants |
| `FileAttributes` | `FileAttributes` | **`EntryMetadata`** | Rename + expand fields |
| `OperationResult` | `OperationResult` | **`OperationResult`** | Keep |
| `TransferStatus` | `TransferStatus` (in types.ts) | **`TransferStatus`** | Keep |
| `TransferType` | `TransferType` (in types.ts) | **`TransferType`** | Keep |
| `TransferProgress` | `TransferProgressPayload` | **`TransferSnapshot`** | Rename |
| `ClipboardItem` | `ClipboardItem` | **`EntryRef`** | Rename |
| `ClipboardOperation` | `ClipboardOperation` | **`ClipboardAction`** | Rename |
| `CoreError` / `ErrorKind` | `BridgeErrorPayload` / `BridgeErrorCode` | **`CoreError`** / **`ErrorKind`** | Keep (Rust). Bridge adapts. |
| `CoreEvent` | (Tauri events) | **`CoreEvent`** (updated variants) | Update variant names |
| `ConnectorCapabilities` | — | **`ConnectorCapabilities`** | Keep |
| `ConnectorStatus` | — | **`ConnectorStatus`** | Keep |
| — | `SearchProgressPayload` | **`SearchSnapshot`** | New Rust type, rename TS |
| — | — | **`Account`** | New |
| — | — | **`Device`** | New |
| — | — | **`Provider`** (domain object) | New |
| — | — | **`Root`** | New |
| — | — | **`EntryRef`** | New |
| — | — | **`ClipboardEntry`** | New |
| — | — | **`Session`** | New |
| — | — | **`Permission`** | New |
| — | — | **`Presence`** | New |
| — | — | **`Notification`** | New |

### 10.2 Migration Sequencing

The renames happen as part of the storageos-core migration (A-002 Phase 2–7). The sequencing:

1. **Phase 2 (Move Models)** — When `DirectoryEntry` moves from desktop services into storageos-core, it is renamed to `Entry`. The desktop Tauri command layer maps `Entry` → the existing `DirectoryEntry` JSON shape for backward compatibility with the TypeScript frontend.

2. **Phase 3 (Move Utilities)** — No renames.

3. **Phase 4 (Move Errors)** — `CoreError` already has the correct name.

4. **Phase 5 (Move Filesystem)** — `FileSystemService` uses `Entry`, `Root`, `EntryMetadata`. Desktop command layer maps to existing TypeScript types.

5. **Phase 6 (Move Transfers)** — `TransferProgress` renamed to `TransferSnapshot`. Desktop command layer maps.

6. **Phase 7 (Move Search)** — `SearchProgressPayload` renamed to `SearchSnapshot`.

7. **Phase 8 (Desktop Integration)** — TypeScript types are updated to match domain names. This is the only phase that changes the frontend.

The key principle: **renames happen in storageos-core first, and the desktop Tauri command layer provides a compatibility mapping until the frontend catches up in Phase 8.** No big-bang rename across the stack.

---

## Part 11: Architecture Validation

### 11.1 Validation Checklist

| Criterion | Status | Evidence |
|-----------|--------|---------|
| **Provider agnostic** | Pass | Entry, Root, EntryMetadata work for all 12+ provider types (Part 5 matrix). No provider-specific fields in core types — provider-specific data lives in `EntryMetadata.custom`. |
| **Device agnostic** | Pass | Device is a first-class object with kind (desktop/phone/tablet/server/nas). No assumption about screen, input method, or always-on power. |
| **UI agnostic** | Pass | Domain objects carry no rendering information. No icon paths, no CSS classes, no layout hints. UIs derive display from kind/metadata. |
| **Platform agnostic** | Pass | No Windows paths hardcoded. No drive letter assumptions in core types. `Root.name` is a string — it holds "C:" on Windows, "/" on Linux, "My Drive" on Google Drive. `RootMetadata` holds platform-specific extras as optional fields. |
| **Transport agnostic** | Pass | All objects are `Serialize + Deserialize`. They work over MessagePack, JSON, Protobuf, or any future wire format. No transport-specific fields (no HTTP status codes, no WebSocket frame IDs). |
| **Future cloud support** | Pass | Provider + Root + Entry model covers all cloud providers tested (Google Drive, OneDrive, Dropbox, SharePoint, S3). ConnectorCapabilities allows each provider to declare what it can do. |
| **Future enterprise support** | Pass | Account evolves to Organization with members and roles. Permission evolves from flat booleans to RBAC. Both are additive changes (Part 9). |

### 11.2 Terminology Audit

| Term | Windows-Specific? | Replacement |
|------|-------------------|-------------|
| "Drive" | Yes (drive letter is Windows-only) | **Root** |
| "Directory" | Mostly (Linux uses it too, but S3/SharePoint do not) | **Folder** (as EntryKind variant) or just **Entry** |
| "File path" | Partially (backslash vs forward slash) | **Entry.path** (relative to Root, connector normalizes) |
| "Hidden file" | Partially (dot-prefix on Unix, attribute on Windows) | **EntryMetadata.hidden** (connector sets it appropriately per platform) |
| "Read-only" | Partially (attribute on Windows, permission on Unix) | **EntryMetadata.readonly** (connector sets it appropriately per platform) |
| "Clipboard" | No — universal concept | **Clipboard** (kept) |
| "Transfer" | No — universal concept | **Transfer** (kept) |
| "Notification" | No — universal concept | **Notification** (kept) |

No Windows-specific terminology remains in core domain names.

---

## Summary: Complete Domain Object Reference

```
Account
├── account_id: AccountId (Uuid)
├── display_name: String
├── avatar: Option<Bytes>
├── created_at: Timestamp
├── devices: Vec<DeviceId>
└── providers: Vec<ProviderId>

Device
├── device_id: DeviceId (Uuid)
├── friendly_name: String
├── owner_account: AccountId
├── kind: DeviceKind
├── os: String
├── os_version: String
├── arch: String
├── agent_version: String
├── capabilities: DeviceCapabilities
├── providers: Vec<ProviderId>
├── presence: Presence
├── trust_level: TrustLevel
├── network_kind: NetworkKind
├── battery_level: Option<u8>
├── last_seen: Timestamp
├── registered_at: Timestamp
└── last_sync: Option<Timestamp>

Provider (domain object)
├── provider_id: ProviderId (Uuid)
├── name: String
├── provider_type: String  // "local", "google_drive", "s3", etc.
├── device_id: DeviceId
├── status: ConnectorStatus
├── capabilities: ConnectorCapabilities
└── roots: Vec<RootId>

Root
├── id: RootId (String)
├── name: String
├── kind: RootKind
├── provider: ProviderId
├── capacity: Option<StorageCapacity>
└── metadata: RootMetadata

StorageCapacity
├── total_bytes: u64
├── free_bytes: u64
└── used_bytes: u64

Entry
├── id: EntryId (String)
├── name: String
├── path: String
├── kind: EntryKind
├── size: u64
├── created_at: Option<Timestamp>
├── modified_at: Option<Timestamp>
└── metadata: EntryMetadata

EntryRef
├── device_id: Option<DeviceId>
├── provider_id: ProviderId
├── root_id: RootId
└── path: String

Transfer
├── id: TransferId (Uuid)
├── source: EntryRef
├── destination: EntryRef
├── transfer_type: TransferType
├── status: TransferStatus
├── created_at: Timestamp
├── started_at: Option<Timestamp>
├── completed_at: Option<Timestamp>
└── error: Option<String>

TransferSnapshot
├── transfer_id: TransferId
├── status: TransferStatus
├── bytes_transferred: u64
├── total_bytes: u64
├── progress: f64
├── speed_bytes_per_second: u64
├── estimated_remaining_ms: u64
└── elapsed_ms: u64

ClipboardEntry
├── id: ClipboardEntryId (Uuid)
├── source_device: DeviceId
├── action: ClipboardAction
├── items: Vec<EntryRef>
├── created_at: Timestamp
└── expires_at: Timestamp

Notification
├── id: NotificationId (Uuid)
├── category: String
├── priority: Priority
├── title: String
├── body: String
├── source_device: DeviceId
├── target: NotificationTarget
├── created_at: Timestamp
├── read: bool
└── action: Option<String>

Session
├── id: SessionId (Uuid)
├── device_id: DeviceId
├── client_type: String
├── connected_at: Timestamp
└── last_active: Timestamp
```

---

## Related Documents

- `docs/architecture/Agent.md` — Agent architecture (references these domain objects)
- `crates/storageos-core/README.md` — Crate structure and migration plan
- `crates/storageos-core/src/models/mod.rs` — Current Rust model definitions (pre-rename)
- `.ai/ARCHITECTURE.md` — System boundaries and tech stack
- `.ai/DECISIONS.md` — Architectural decision records
