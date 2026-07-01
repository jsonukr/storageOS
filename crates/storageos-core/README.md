# storageos-core

Shared business logic for StorageOS. Every StorageOS consumer — the Agent binary, the desktop app (via Tauri), the CLI, and future mobile clients — depends on this crate.

**This crate contains no transport logic.** No HTTP, no Tauri IPC, no Named Pipes, no WebSocket. It is pure domain logic that can be embedded in any host.

## Status

**Foundation + shared models + shared utilities + filesystem + transfers.** The crate owns canonical domain models (A-003), reusable utilities (A-004), filesystem business logic (A-005), and the transfer engine (A-006). The desktop app depends on this crate and its `services/` files are now thin adapters. The transfer engine uses a generic progress callback (`Fn(&TransferSnapshot)`) — no Tauri dependency — so it's reusable by the Agent, CLI, and future mobile clients.

## Module Structure

```
storageos-core/src/
├── lib.rs                    ← crate root, re-exports all modules
├── errors/mod.rs             ← CoreError, ErrorKind, CoreResult
├── models/                   ← canonical domain models (A-003)
│   ├── mod.rs                ← re-exports all sub-modules
│   ├── entry.rs              ← Entry, EntryId, EntryKind, EntryMetadata, EntryRef
│   ├── root.rs               ← Root, RootId, RootKind, StorageCapacity, RootMetadata
│   ├── transfer.rs           ← TransferStatus, TransferType, TransferSnapshot
│   ├── clipboard.rs          ← ClipboardAction, ClipboardEntry, ClipboardEntryId
│   ├── device.rs             ← DeviceId, DeviceKind, Presence, TrustLevel, NetworkKind
│   ├── provider.rs           ← ProviderId, ConnectorCapabilities, ConnectorStatus
│   ├── notification.rs       ← NotificationId, Priority, NotificationTarget
│   ├── session.rs            ← SessionId
│   ├── permission.rs         ← DevicePermissions
│   └── common.rs             ← AccountId, OperationResult, SearchSnapshot
├── utils/                    ← shared utilities (A-004)
│   ├── mod.rs                ← re-exports all sub-modules
│   ├── path.rs               ← parent_path, is_root_path, file_extension, normalize_separators
│   ├── validation.rs         ← is_valid_filename, validate_filename, INVALID_FILENAME_CHARS
│   ├── format.rs             ← format_bytes, format_speed, format_remaining
│   └── time.rs               ← epoch_secs, epoch_millis, system_time_to_epoch_secs
├── platform/mod.rs           ← Platform enum (Windows/Linux/macOS/Android/iOS)
├── config/                   ← application settings and constants (A-004)
│   ├── mod.rs                ← AppConfig, LogLevel
│   └── constants.rs          ← TRANSFER_CHUNK_SIZE, APP_NAME, limits, intervals
├── filesystem/               ← filesystem operations (A-005)
│   ├── mod.rs                ← FileSystemService trait, sub-module re-exports
│   ├── directory.rs          ← list_directory → Vec<Entry>
│   ├── operations.rs         ← create_folder, rename_item, delete_item, copy_item, move_item
│   ├── drives.rs             ← list_roots → Vec<Root> (Windows API, cfg-gated)
│   └── attributes.rs         ← get_attributes, set_hidden, set_readonly (Windows API, cfg-gated)
├── transfer/                 ← transfer engine (A-006)
│   ├── mod.rs                ← TransferService trait, sub-module re-exports
│   ├── engine.rs             ← execute_transfer (progress callback), chunked copy/move, disk space
│   └── controller.rs         ← signal registry: register/unregister/set_signal (pause/resume/cancel)
├── search/mod.rs             ← SearchService trait
├── clipboard/mod.rs          ← ClipboardService trait
├── providers/mod.rs          ← StorageConnector trait
└── events/mod.rs             ← CoreEvent enum, FileChangeKind
```

## Module Purpose & Future Ownership

Each module documents which existing code will eventually migrate into it.

### errors

Unified error type for all core operations. The desktop app maps `CoreError` → `BridgeError` at the Tauri command boundary via `From<CoreError> for BridgeError` (added in A-004).

### models

Canonical domain models (A-003). 10 sub-modules following `docs/architecture/DomainModel.md`. All types are `Serialize + Deserialize`.

| Core type | Desktop adapter | Status |
|-----------|----------------|--------|
| `OperationResult` | (none — used directly) | Migrated (A-003) |
| `Entry` | `DirectoryEntry` in `directory.rs` | Adapter with `From` conversions |
| `Root` | `LocalDrive` in `drives.rs` | Adapter with `From` conversion |
| `EntryMetadata` | `FileAttributes` in `file_attributes.rs` | Adapter with `From` conversions |
| `TransferSnapshot` | `TransferProgressPayload` (private, Tauri-specific) | Separate types |
| `ClipboardAction` | TypeScript `ClipboardOperation` | TypeScript-only currently |

### utils

Shared utility functions (A-004). Desktop imports `validate_filename()` and `format_bytes()`.

| Utility | Replaced in desktop |
|---------|-------------------|
| `validate_filename()` | Inline char checks in `file_operations.rs` |
| `format_bytes()` | Local `format_bytes()` in `transfer_worker.rs` |

### platform

Platform detection abstraction (A-004). `Platform` enum with compile-time `current()` detection.

### config

Application configuration and constants (A-004). `constants.rs` centralizes magic numbers (chunk sizes, intervals, ports).

### filesystem ✅ (A-005)

All local filesystem operations: directory listing, file CRUD, drive detection, file attributes.

| Module | Status |
|--------|--------|
| `directory.rs` | Migrated from `apps/desktop/src-tauri/src/services/directory.rs` |
| `operations.rs` | Migrated from `apps/desktop/src-tauri/src/services/file_operations.rs` |
| `drives.rs` | Migrated from `apps/desktop/src-tauri/src/services/drives.rs` |
| `attributes.rs` | Migrated from `apps/desktop/src-tauri/src/services/file_attributes.rs` |
| `watcher.rs` (new) | Not yet — filesystem change notifications via `notify` crate |

### transfer ✅ (A-006)

Chunked file copy/move engine with progress reporting, pause/resume/cancel. Transport-independent via progress callback.

| Module | Status |
|--------|--------|
| `engine.rs` | Migrated from `apps/desktop/src-tauri/src/services/transfer_worker.rs` |
| `controller.rs` | Signal registry (extracted from transfer_worker.rs) |
| `manager.rs` (new) | Not yet — transfer queue management, scheduling |
| `planner.rs` (new) | Not yet — conflict detection, destination path resolution |

### search

Filename search (current) and future full-text search via SQLite FTS5.

| Future owner of | Current location |
|-----------------|-----------------|
| `search.rs` | `apps/desktop/src-tauri/src/services/search.rs` |
| `index.rs` (new) | SQLite FTS5 index management |
| `query.rs` (new) | Query parsing and execution |

### clipboard

Agent-owned clipboard with history, expiration, and future cross-device sync.

| Future owner of | Current location |
|-----------------|-----------------|
| `service.rs` | TypeScript `apps/desktop/src/services/clipboard/ClipboardService.ts` (will be rewritten in Rust) |
| `sync.rs` (new) | Cross-device clipboard sync (Phase 2+) |

### providers

The StorageConnector trait and provider registry. Every storage backend implements this trait.

| Future owner of | Current location |
|-----------------|-----------------|
| `connector.rs` | TypeScript `apps/desktop/src/core/storage/` (contract only — will become Rust trait) |
| `registry.rs` (new) | Provider lifecycle management |
| `capabilities.rs` (new) | Capability negotiation |

Individual connector implementations live in `connectors/` (e.g., `connectors/local/`, `connectors/google-drive/`), not in this crate.

### events

Internal pub/sub event bus for decoupled service communication.

| Future owner of | Current location |
|-----------------|-----------------|
| `bus.rs` (new) | Does not exist — new infrastructure |
| `types.rs` | Partially in `apps/desktop/src-tauri/src/events/mod.rs` (Tauri-specific, will be generalized) |

### config

Application settings and platform-specific paths.

| Future owner of | Current location |
|-----------------|-----------------|
| `settings.rs` (new) | Partially in TypeScript (explorer store localStorage), will centralize in Agent |
| `paths.rs` (new) | Scattered across services (hardcoded paths) |

### utils

Pure utility functions with no side effects.

| Future owner of | Current location |
|-----------------|-----------------|
| Path helpers | Scattered across services (e.g., parent path extraction in explorer store) |
| Filename validation | `apps/desktop/src-tauri/src/services/file_operations.rs` (inline checks) |

## Dependency Rules

Modules may only depend on other modules in the directions shown below. No circular dependencies.

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  filesystem   │     │   transfer    │     │    search     │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        │         ┌───────────┼─────────────────────┘
        │         │           │
        ▼         ▼           ▼
┌───────────────┐     ┌───────────────┐
│  providers    │     │   clipboard   │
└───────┬───────┘     └───────┬───────┘
        │                     │
        └──────────┬──────────┘
                   │
                   ▼
            ┌─────────────┐
            │   events    │
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │   config    │
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │   models    │
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │   errors    │
            └──────┬──────┘
                   │
                   ▼
            ┌─────────────┐
            │    utils    │
            └─────────────┘
```

### Allowed Dependencies (by module)

| Module | May depend on |
|--------|--------------|
| `utils` | (none — leaf module) |
| `errors` | `utils` |
| `models` | `errors`, `utils` |
| `config` | `models`, `errors`, `utils` |
| `events` | `models`, `errors`, `utils` |
| `providers` | `models`, `errors`, `events`, `config`, `utils` |
| `clipboard` | `models`, `errors`, `events`, `utils` |
| `filesystem` | `models`, `errors`, `events`, `providers`, `config`, `utils` |
| `transfer` | `models`, `errors`, `events`, `providers`, `filesystem`, `config`, `utils` |
| `search` | `models`, `errors`, `events`, `providers`, `filesystem`, `config`, `utils` |

### Forbidden Dependencies

| From | Must NOT depend on |
|------|--------------------|
| `filesystem` | `transfer`, `search`, `clipboard` |
| `transfer` | `search`, `clipboard` |
| `search` | `transfer`, `clipboard` |
| `clipboard` | `filesystem`, `transfer`, `search`, `providers` |
| `models` | Any service module |
| `errors` | Any module except `utils` |
| `utils` | Any module |
| `events` | Any service module |
| `config` | Any service module |

## Public API (Trait Surface)

These traits define the contracts. Implementations come later during migration.

### FileSystemService

```rust
pub trait FileSystemService {
    fn list_directory(&self, path: &str) -> CoreResult<Vec<Entry>>;
    fn create_folder(&self, parent: &str, name: &str) -> CoreResult<OperationResult>;
    fn rename_item(&self, path: &str, new_name: &str) -> CoreResult<OperationResult>;
    fn delete_item(&self, path: &str) -> CoreResult<OperationResult>;
    fn list_roots(&self) -> CoreResult<Vec<Root>>;
    fn get_metadata(&self, path: &str) -> CoreResult<EntryMetadata>;
    fn set_hidden(&self, path: &str, hidden: bool) -> CoreResult<EntryMetadata>;
    fn set_readonly(&self, path: &str, readonly: bool) -> CoreResult<EntryMetadata>;
}
```

### TransferService

```rust
pub trait TransferService {
    fn start_transfer(&self, source: &str, destination: &str, transfer_type: TransferType, overwrite: bool, new_name: Option<&str>) -> CoreResult<String>;
    fn pause(&self, transfer_id: &str) -> CoreResult<()>;
    fn resume(&self, transfer_id: &str) -> CoreResult<()>;
    fn cancel(&self, transfer_id: &str) -> CoreResult<()>;
    fn get_snapshot(&self, transfer_id: &str) -> CoreResult<TransferSnapshot>;
    fn get_status(&self, transfer_id: &str) -> CoreResult<TransferStatus>;
    fn list_active(&self) -> CoreResult<Vec<TransferSnapshot>>;
}
```

### SearchService

```rust
pub trait SearchService {
    fn search_directory(&self, path: &str, query: &str, recursive: bool) -> CoreResult<Vec<Entry>>;
}
```

### ClipboardService

```rust
pub trait ClipboardService {
    fn copy(&self, items: Vec<EntryRef>) -> CoreResult<()>;
    fn cut(&self, items: Vec<EntryRef>) -> CoreResult<()>;
    fn paste(&self, destination: &str) -> CoreResult<Vec<String>>;
    fn clear(&self) -> CoreResult<()>;
    fn get_items(&self) -> CoreResult<Vec<EntryRef>>;
    fn get_action(&self) -> CoreResult<Option<ClipboardAction>>;
    fn has_items(&self) -> bool;
}
```

### StorageConnector

```rust
pub trait StorageConnector: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn capabilities(&self) -> ConnectorCapabilities;
    fn status(&self) -> ConnectorStatus;
    fn list(&self, path: &str) -> CoreResult<Vec<Entry>>;
    fn create_folder(&self, path: &str, name: &str) -> CoreResult<()>;
    fn delete(&self, path: &str) -> CoreResult<()>;
    fn rename(&self, path: &str, new_name: &str) -> CoreResult<()>;
}
```

## Migration Plan

Each phase is independently compilable. No big-bang migration.

### Phase 1: Create Crate ✅ (A-002)

- Create `crates/storageos-core/` with module structure
- Define trait surfaces and shared models
- Document ownership and dependency rules

### Phase 2: Move Models ✅ (A-003)

- Canonical domain models in `storageos-core::models` following `DomainModel.md`
- Desktop imports `OperationResult` from core; adapter types for `DirectoryEntry`, `LocalDrive`, `FileAttributes`
- `storageos-core` added as dependency to desktop `Cargo.toml`

### Phase 3: Move Utilities ✅ (A-004)

- Path helpers, filename validation, byte formatting, time helpers in `storageos-core::utils`
- Platform abstraction in `storageos-core::platform`
- Constants and limits in `storageos-core::config::constants`
- Desktop uses `validate_filename()` and `format_bytes()` from core
- `From<CoreError> for BridgeError` adapter in desktop errors

### Phase 4: Move Errors ✅ (A-004)

- Desktop Tauri commands can return `CoreError` via the `From` adapter
- Core services return `CoreError` natively

### Phase 5: Move Filesystem ✅ (A-005)

- Moved `directory.rs`, `file_operations.rs`, `drives.rs`, `file_attributes.rs` into `storageos-core::filesystem`
- Free functions implement the `FileSystemService` contract; trait retained for mocking
- Desktop services rewritten as thin adapters calling `storageos_core::filesystem::*`
- Added `windows-sys` v0.59 to core with `cfg(windows)` gating
- Platform-specific code isolated behind `#[cfg(target_os)]` in each sub-module
- 7 new unit tests (directory listing, CRUD operations, copy, move)
- **Compile check: both crates pass. 18 tests pass.**

### Phase 6: Move Transfers ✅ (A-006)

- Moved `transfer_worker.rs` into `storageos-core::transfer` as `engine.rs` + `controller.rs`
- Decoupled from `tauri::AppHandle` via generic progress callback `&dyn Fn(&TransferSnapshot)`
- Desktop provides Tauri adapter that bridges callback to `app.emit("transfer:progress", ...)`
- Signal registry (pause/resume/cancel) extracted into `controller.rs`
- Uses `std::sync::LazyLock` (no `once_cell` dependency in core)
- 13 new unit tests (signal registry, chunked copy, move, cancel, overwrite, directory, size calculation)
- **Compile check: both crates pass. 31 tests pass.**

### Phase 7: Move Search

- Move `search.rs` into `storageos-core::search`
- Decouple from Tauri event emission (same callback pattern as transfers)
- **Compile check + manual test: search, recursive search with progress**

### Phase 8: Desktop Uses storageos-core

- All desktop Tauri commands are thin wrappers around `storageos-core` traits
- Desktop `services/` directory is empty or removed
- Desktop `src-tauri/Cargo.toml` depends on `storageos-core`
- **Full regression test**

### Phase 9: Agent Uses storageos-core

- `crates/storageos-agent/` binary wraps `storageos-core` with Named Pipe / HTTP transport
- Agent and desktop both depend on the same `storageos-core`
- **This is the target architecture from docs/architecture/Agent.md**

## External Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `serde` | 1 | Serialization for all models |
| `thiserror` | 2 | Ergonomic error type derivation |
| `windows-sys` | 0.59 | Windows API calls (cfg-gated: drive detection, file attributes) |

No Tauri. No Axum. Platform-specific code (Windows APIs) is behind `#[cfg(target_os)]` gates.
