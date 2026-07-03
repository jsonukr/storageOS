# Project State

> Single source of truth. Updated by Claude Code after every completed task.

## Overview

- **Project**: StorageOS — unified storage virtualization platform
- **Phase**: Product Milestone 3 (Product Polish & UX) — Complete
- **Status**: Desktop + Agent + Android app with image preview, file transfers, cross-device copy/paste, polished UI

## Repository Structure

```
StorageOS/
├── .ai/                    ← AI collaboration hub (this directory)
├── .claude/                ← Claude Code settings
├── .github/                ← GitHub workflows (empty)
├── apps/
│   └── desktop/            ← Tauri v2 + React + TypeScript + Vite
├── crates/
│   └── storageos-core/     ← Shared business logic (Rust crate)
├── connectors/
│   ├── local/
│   ├── google-drive/
│   ├── microsoft/
│   └── dropbox/
├── docs/
│   ├── vision/
│   ├── prd/
│   ├── srs/
│   ├── architecture/
│   ├── database/
│   ├── api/
│   ├── ui/
│   ├── development/
│   └── decisions/
├── infrastructure/
│   ├── docker/
│   ├── scripts/
│   └── deployment/
├── services/
│   ├── api/
│   ├── agent/
│   └── storageos-agent/    ← Standalone Agent binary (A-008)
├── shared/
│   ├── contracts/
│   ├── models/
│   ├── events/
│   └── utilities/
├── tests/
└── Documentation/          ← Legacy v0.1 docs
```

## Desktop App (apps/desktop/)

- **Framework**: Tauri v2 (Rust backend) + React 19 + TypeScript 6 + Vite 8
- **Styling**: Tailwind CSS v4 (Vite plugin)
- **State**: Zustand (theme store, sidebar store, explorer store, transfer store)
- **Data**: TanStack Query (configured, no queries yet)
- **Routing**: React Router v7 (4 routes — Explorer-first)
- **Layout**: Sidebar (icons, logo, collapse, version) + TopNav (breadcrumbs, search, notifications, profile) + Content + StatusBar
- **Dark mode**: Enhanced CSS palette, toggleable via Zustand store
- **Pages**: Explorer (3-panel layout: nav panel + file area + properties), Transfers (transfer queue UI), Devices, Settings
- **Frontend build**: Compiles successfully (tsc + vite build)
- **Tauri build**: Working — Rust 1.96.0 stable installed, `npm run tauri dev` launches successfully

## What Exists

- [x] Monorepo folder structure
- [x] Documentation organized (vision, prd, srs)
- [x] Desktop frontend scaffolded and compiling
- [x] Tailwind CSS v4 configured with dark mode theme
- [x] React Router with 4 routes (Explorer-first landing)
- [x] Zustand stores (theme, sidebar, explorer)
- [x] TanStack Query provider
- [x] App layout shell (Sidebar, TopNav, Content, StatusBar)
- [x] Tauri v2 config (src-tauri/)
- [x] Root .gitignore (node_modules, dist, target, .env, OS/IDE files)
- [x] .ai/CLAUDE.md (Claude Code instructions)
- [x] .ai/GIT_STRATEGY.md (branch strategy documentation)
- [x] Tauri placeholder icons (all platforms)
- [x] Database standardized to SQLite for MVP
- [x] Design system foundation (src/design-system/)
  - Tokens: colors, spacing, typography, radius, shadow, zIndex, animation
  - Primitives: Button, Card, Input, Badge, Avatar, Spinner, Progress, Divider
  - States: EmptyState, LoadingState, ErrorState
  - Domain: StorageCard, DeviceCard, TransferCard, SearchInput
  - Barrel exports via design-system/index.ts
- [x] Storage provider contracts (src/core/storage/)
  - StorageProvider interface (18 methods: init, auth, list, search, CRUD, transfers, streams, watch)
  - StorageItem, StorageItemId, StorageItemPage, ListOptions, SearchOptions
  - StorageDrive, ProviderType (11 types), ConnectionState, StorageQuota
  - StorageCapabilities (17 capability flags + limits)
  - StorageError class with 16 error codes and retryable flag
  - StorageEvents for real-time change watching
  - StorageOperation types (copy, move, upload, download with progress)
  - Barrel exports via core/index.ts
- [x] Tauri IPC bridge (src/lib/tauri/ + src-tauri/src/)
  - TypeScript: typed invoke wrapper, command definitions, event system, error mapping
  - Rust: commands/ (health, version, platform, app_directories), core/ (AppState), errors/ (BridgeError), events/
  - 9 IPC commands: health(), version(), platform(), app_directories(), list_drives(), list_dir(), create_folder(), rename_item(), delete_item()
  - File attribute commands: get_attributes(), set_hidden(), set_readonly() — Windows API via GetFileAttributesW/SetFileAttributesW
  - BridgeError with 6 error codes, JSON-serialized across IPC boundary
  - Typed event system (bridge:ready, bridge:error)
  - Barrel exports via lib/tauri/index.ts
- [x] Professional Explorer layout (LS-004)
  - 3-panel layout: NavigationPanel (resizable, 240px) + FileArea + PropertiesPanel (resizable, 280px, collapsed by default)
  - Toolbar: Navigation (Back/Forward/Up/Refresh) | Actions (New Folder/Upload/Download) | View (Grid/List/Details) | More (Sort/Filter/Properties)
  - Breadcrumb address bar with folder icons, clickable segments, refresh button
  - NavigationPanel: 6 collapsible sections (Quick Access, Favorites, Local Storage, Cloud Storage, Network, Trash)
  - ResizeHandle component for panel resizing
  - Column headers for details view (Name, Date Modified, Type, Size)
  - StatusBar: Ready indicator, current provider, item count, zoom percentage
  - Explorer store (viewMode, panel widths, properties toggle)
- [x] Local drive detection (LS-005)
  - Rust: `services/drives.rs` — Windows API drive detection (GetLogicalDriveStringsW, GetDriveTypeW, GetDiskFreeSpaceExW, GetVolumeInformationW)
  - LocalDrive struct: letter, label, drive_type, total_bytes, free_bytes, used_bytes, file_system, is_removable, is_ready
  - DriveType enum: Fixed, Removable, Network, CdRom, RamDisk, Unknown
  - Cross-platform stub (empty Vec on non-Windows)
  - Rust command: `list_drives` registered in lib.rs
  - TypeScript bridge: LocalDriveInfo type, DriveType type, listDrives() command
  - NavigationPanel: dynamic drive loading from Rust, usage bars (color-coded: accent/warning/danger), drive letter/label/filesystem display
  - Added `windows-sys` v0.59 crate dependency (Win32_Storage_FileSystem, Win32_System_WindowsProgramming features)
  - Verified: detects 3 drives (C:, D:, S:) with correct metadata on dev machine
- [x] Directory listing (LS-006A)
  - Rust: `services/directory.rs` — reads directory entries via `std::fs::read_dir`, collects metadata (name, full_path, is_directory, size, last_modified, hidden, readonly, extension)
  - Windows hidden file detection via `FILE_ATTRIBUTE_HIDDEN`, cross-platform fallback (dot-prefix)
  - Sorting: folders first, then alphabetical (case-insensitive)
  - Error handling: NotFound, InvalidArgument, PermissionDenied mapped to BridgeError
  - Rust command: `list_dir` registered in lib.rs via `commands/list_directory.rs`
  - TypeScript bridge: DirectoryEntry type, listDirectory() command
  - ExplorerService abstraction layer (`services/ExplorerService.ts`) — UI never calls Rust directly
  - Explorer store: currentPath, entries, loading, error state, navigateTo action
  - NavigationPanel: drive click calls `navigateTo(drivePath)`, active drive highlighted
  - FileArea component: details view (column headers + rows) and grid view (icon grid)
  - States: loading spinner, error message, empty folder, welcome ("Select a drive")
  - File/folder icons (inline SVG), date/size/extension formatters
  - 6 IPC commands total: health, version, platform, app_directories, list_drives, list_dir
- [x] Explorer navigation (LS-006B)
  - Explorer store: historyStack, forwardStack, selectedEntry, openEntry, goBack, goForward, goUp, refresh
  - getParentPath utility: extracts parent from Windows paths, stops at drive root
  - Toolbar buttons: Back/Forward/Up/Refresh wired to store actions with correct disabled states
  - Single click selects entry (highlighted with accent), click background deselects
  - Double click opens folders (navigates into), files ignored (no file opening yet)
  - Dynamic breadcrumb address bar: parses currentPath into clickable segments (drive root + folder chain)
  - Breadcrumb click navigates to that ancestor folder, pushes current to history
  - History stack: navigateTo and openEntry push current path before navigating, clear forward stack
  - Forward stack: goBack pushes current to forward, goForward pushes current to history
  - goUp: navigates to parent directory, pushes current to history
  - refresh: reloads current directory without affecting stacks
  - StatusBar: shows real item count from entries, selected item name, loading state
- [x] File operations foundation (LS-007A)
  - Rust: `services/file_operations.rs` — create_folder, rename_item, delete_item with OperationResult return type
  - Input validation: empty names, invalid characters (\ / : * ? " < > |), duplicate names, non-existent paths
  - Error handling: PermissionDenied, NotFound, InvalidArgument mapped to BridgeError
  - Delete: permanent deletion (documented; designed for future Recycle Bin replacement via IFileOperation)
  - Rust commands: `create_folder`, `rename_item`, `delete_item` registered in lib.rs via `commands/file_operations.rs`
  - TypeScript bridge: OperationResult type, createFolder(), renameItem(), deleteItem() commands
  - ExplorerService extended: createFolder(), rename(), delete() methods
  - Explorer store: operationLoading, operationError, createFolder/renameEntry/deleteEntry actions with auto-refresh
  - UI state: newFolderDialogOpen, renameTarget, deleteTarget, contextMenu position/entry
  - New Folder dialog: text input with auto-focus/select, loading state, inline error display
  - Rename dialog: text input pre-filled with current name, extension-aware selection, loading state
  - Delete confirmation dialog: warns about permanent deletion, folder content warning, loading state
  - Context menu: right-click on entry (Open/Rename/Delete), right-click on background (New Folder)
  - Toolbar: New Folder button wired (disabled when no directory open)
  - Auto-refresh: directory reloads after every successful create/rename/delete operation
  - 9 IPC commands total: health, version, platform, app_directories, list_drives, list_dir, create_folder, rename_item, delete_item
- [x] Local filename search (LS-008A)
  - Rust: `services/search.rs` — current-directory filename search (non-recursive)
  - Async command via `tauri::async_runtime::spawn_blocking` — never blocks the UI thread
  - Case-insensitive substring matching against filenames and folder names
  - Reuses `DirectoryEntry` type from `services/directory.rs`
  - Results sorted: folders first, then case-insensitive alphabetical
  - Rust command: `search_directory(path, query)` registered in lib.rs via `commands/search.rs`
  - TypeScript bridge: `searchDirectory()` command in `lib/tauri/commands.ts`
  - ExplorerService extended: `searchDirectory()` method
  - Explorer store: searchQuery, searchResults, searchLoading, searchError state
  - Generation counter for cancellation — stale results from previous searches are discarded
  - Search state automatically cleared on any navigation (navigateTo, openEntry, goBack, goForward, goUp)
  - TopNav SearchBox: 300ms debounce, loading spinner (replaces search icon), clear button (X), Escape key clears
  - Search box is never disabled — shows "Select a folder to search..." placeholder when no directory is open
  - Current directory listing stays visible while search is in-flight; results replace listing only on completion
  - NoResultsState (with query text), result count in StatusBar
  - Search does not change currentPath — clearing restores original directory listing
  - 10 IPC commands total: health, version, platform, app_directories, list_drives, list_dir, create_folder, rename_item, delete_item, search_directory
- [x] Recursive search (LS-008B)
  - Extended `search_directory()` to support `recursive: bool` parameter (defaults to false)
  - Recursive mode: BFS directory walk, skips symbolic links, ignores inaccessible folders
  - Runs entirely inside `spawn_blocking` — UI thread never blocked
  - Progress events: Rust emits `search:progress` via `app.emit()` with `SearchProgressPayload` (directories_scanned, files_scanned, matches_found)
  - Progress throttled to ~250ms in command layer using `Instant` tracking
  - TypeScript: `SearchProgressPayload` type, `"search:progress"` added to event system
  - Explorer store: `searchRecursive`, `searchProgress`, `searchDurationMs` state; listens for progress events
  - TopNav: "Search subfolders" checkbox next to search box, default unchecked, remembered during session
  - Toggling checkbox re-triggers active search immediately
  - Generation counter cancellation continues working across recursive/non-recursive modes
  - StatusBar: shows live progress (folders/files/matches) during recursive search, completion time after
  - Previous directory listing stays visible until search completes
  - Current-folder-only search unchanged when checkbox unchecked
- [x] Transfer engine foundation (LS-009A)
  - TypeScript-only infrastructure — no Rust changes, no actual filesystem operations
  - `services/transfer/types.ts`: TransferJob interface (id, type, name, source, destination, status, progress, bytesTransferred, totalBytes, speed, startedAt, completedAt, error)
  - TransferStatus union: queued | preparing | running | paused | completed | cancelled | failed
  - TransferType union: copy | move
  - `services/transfer/TransferQueue.ts`: queue class with enqueue, dequeue, cancel, pause, resume, clearCompleted, getJobs, updateProgress, setStatus
  - Subscription system: listeners notified on every state change
  - Status transitions enforced: pause only from running, resume only from paused, cancel from queued/preparing/running/paused
  - `services/transfer/TransferService.ts`: public API wrapping TransferQueue — UI communicates only through this service
  - `stores/transfer.ts`: Zustand store subscribing to TransferService, exposes jobs array and action methods
  - Transfers page: professional table layout with 8 columns (Name, Source, Destination, Status, Progress, Speed, ETA, Actions)
  - Grouped display: Active, Paused, Queued, Finished sections with counts
  - Progress bars: color-coded by status (accent/warning/success/danger)
  - Action buttons: Pause (running), Resume (paused), Cancel (active), Remove (terminal)
  - Clear Finished button in header
  - Empty state when no jobs
  - 7 mock jobs seeded on first visit for visual verification (various statuses)
  - Utility functions: formatBytes, formatSpeed, formatRemaining (ETA calculation)
- [x] Clipboard and copy foundation (LS-009B)
  - TypeScript-only — no Rust changes, no filesystem operations
  - `services/clipboard/types.ts`: ClipboardItem (providerId, path, type, size, name), ClipboardOperation union (copy | cut)
  - `services/clipboard/ClipboardService.ts`: copy(), cut(), clear(), getItems(), hasItems(), isCutOperation(), subscribe()
  - Provider-agnostic: `providerId` field supports future cloud providers
  - Explorer store: `clipboardCount`, `copyEntries()`, `cutEntries()`, `pasteEntries()` actions
  - `pasteEntries()` creates queued TransferJobs via TransferService — no filesystem copy executed
  - Cut operation clears clipboard after paste; copy preserves clipboard
  - Context menu: Copy/Cut/Paste items on right-click entry; Paste on right-click background
  - Paste disabled when clipboard is empty or no directory is open
  - ContextMenuItem supports `disabled` prop for greyed-out state
- [x] Real-time transfer progress (LS-010A)
  - Rust: `services/transfer_worker.rs` — chunked file copy engine with 4MB buffer, progress events every 100ms
  - `execute_transfer()`: calculates total size, reads/writes in 4MB chunks via BufReader/BufWriter, emits `transfer:progress` events via `app.emit()`
  - Progress payload: transferId, status (running/completed/failed), bytesTransferred, totalBytes, progress (%), speedBytesPerSecond, estimatedRemainingMs, elapsedMs, error
  - Directory support: recursive chunked copy with cumulative progress across all files
  - Move optimization: tries `fs::rename` first (instant on same volume), falls back to chunked copy+delete for cross-volume moves (ERROR_NOT_SAME_DEVICE)
  - Error recovery: cleans up partial copies on failure, reports "copied but failed to delete source" for cross-volume move edge case
  - Overwrite/new_name support preserved from LS-009B conflict dialog
  - Rust: `commands/transfer.rs` — async Tauri command `start_transfer` spawns transfer in background thread via `spawn_blocking`, returns immediately
  - TypeScript bridge: `TransferProgressPayload` type, `transfer:progress` event, `startTransfer()` command
  - TransferStore: event-driven updates via `onBridgeEvent("transfer:progress")` — never polls, updates TransferService on each event
  - TransferQueue.updateProgress: accepts totalBytes (Rust worker reports actual size), auto-transitions queued→running
  - Explorer store: `pasteEntries()` rewritten as non-blocking — creates TransferJob, calls `startTransfer()` (fire-and-forget), conflict detection via in-memory entries check
  - Explorer auto-refreshes directory listing when a transfer targeting the current path completes
  - Transfers page: removed mock data, added Elapsed column (9 columns total), live progress bars, speed, ETA from real events
  - 11 IPC commands total: +start_transfer
- [x] Transfer pause/resume/cancel (LS-010B)
  - Rust: `services/transfer_manager.rs` — AtomicBool pause/cancel flags per transfer, checked between chunks
  - Pause: sets flag, worker spin-waits; Resume: clears flag; Cancel: sets flag, worker deletes partial file
  - Commands: `pause_transfer`, `resume_transfer`, `cancel_transfer` registered in lib.rs
  - TypeScript bridge: pauseTransfer(), resumeTransfer(), cancelTransfer() commands
  - 14 IPC commands total: +pause_transfer, +resume_transfer, +cancel_transfer
- [x] Hidden files & file attributes (EXP-005)
  - Rust: `services/file_attributes.rs` — get_attributes, set_hidden, set_readonly using Windows GetFileAttributesW/SetFileAttributesW
  - FileAttributes struct: hidden, readonly, system, archive (all bool)
  - Cross-platform stubs for non-Windows
  - Rust commands: `get_attributes`, `set_hidden`, `set_readonly` via `commands/file_attributes.rs`
  - TypeScript bridge: FileAttributes type, getAttributes(), setHidden(), setReadonly() commands
  - Explorer store: showHiddenItems (persisted to localStorage), showFileExtensions (persisted), toggles for both
  - Ctrl+H keyboard shortcut toggles Show Hidden Items
  - View dropdown: "Hidden items" and "File name extensions" checkboxes
  - FileArea: hidden entries filtered out when showHiddenItems is false
  - File name extensions: stripped from display when showFileExtensions is false
  - Context menu: Hide/Unhide and Set read-only/Remove read-only items (multi-select aware)
  - Properties panel: file info (size, dates), attribute chips (Hidden, Read Only, System, Archive), file path
  - Visual indicators: hidden files at 50% opacity, lock badge overlay on read-only files (all 3 view modes)
  - 17 IPC commands total: +get_attributes, +set_hidden, +set_readonly
- [x] File previews with Rust-side thumbnails (EXP-006)
  - Rust: `services/thumbnail.rs` — image thumbnail generation using `image` crate (resize + JPEG encode + base64 data URL)
  - Rust command: `get_thumbnail(path, max_size)` via `commands/thumbnail.rs`, runs on `spawn_blocking` thread pool
  - TypeScript bridge: `getThumbnail(path, maxSize)` IPC command
  - Tauri v2 asset protocol enabled: `"enable": true` in config, `protocol-asset` Cargo feature, CSP null, scope `**/*`
  - Added `image` crate v0.25 (jpeg/png/gif/webp/bmp)
  - Explorer grid view: real image thumbnails via Rust-side generation (not full-resolution)
  - IntersectionObserver lazy loading with 100px margin, max 3 concurrent loads, in-memory cache
  - CSS `content-visibility: auto` + `containIntrinsicSize` for scroll performance
  - File type detection: 12 categories with color-coded icons (PDF=red, Word=blue, Excel=green, PowerPoint=orange, etc.)
  - Video files: lightweight SVG icon with play button overlay
  - 18 IPC commands total: +get_thumbnail

## Shared Crates

- [x] `crates/storageos-core/` — Shared business logic crate (A-002) + domain model migration (A-003)
  - 10 modules: errors, models, filesystem, transfer, search, clipboard, providers, events, config, utils
  - **Canonical domain models (A-003)**: 10 model sub-modules following `docs/architecture/DomainModel.md`:
    - `models/entry.rs`: Entry, EntryId, EntryKind (File|Folder), EntryMetadata (flat optional fields + custom HashMap), EntryRef (cross-device pointer)
    - `models/root.rs`: Root, RootId, RootKind (Drive|Bucket|Library|SharedDrive|Volume|Mount|Container), StorageCapacity, RootMetadata
    - `models/transfer.rs`: TransferStatus (6 states), TransferType (Copy|Move), TransferSnapshot
    - `models/clipboard.rs`: ClipboardAction (Copy|Cut), ClipboardEntry, ClipboardEntryId
    - `models/device.rs`: DeviceId, DeviceKind (6 types), Presence (7 states), TrustLevel (3 states), NetworkKind (4 types)
    - `models/provider.rs`: ProviderId, ConnectorCapabilities (11 flags), ConnectorStatus (4 states)
    - `models/notification.rs`: NotificationId, Priority (4 levels), NotificationTarget
    - `models/session.rs`: SessionId
    - `models/permission.rs`: DevicePermissions (13 capabilities with sensible defaults)
    - `models/common.rs`: AccountId, OperationResult, SearchSnapshot
  - Service traits updated to use canonical model names: Entry (not DirectoryEntry), Root (not LocalDrive), EntryMetadata (not FileAttributes), TransferSnapshot (not TransferProgress), EntryRef (not ClipboardItem), ClipboardAction (not ClipboardOperation)
  - Trait definitions: FileSystemService, TransferService, SearchService, ClipboardService, StorageConnector
  - CoreError with 10 error kinds (replaces BridgeError at core level)
  - CoreEvent enum for internal pub/sub
  - AppConfig for Agent/application settings
  - Dependencies: serde 1, thiserror 2, windows-sys 0.59 (cfg-gated)
  - README.md: module ownership map, dependency rules diagram, public API surface, migration plan
  - **Shared utilities (A-004)**: 4 utility sub-modules + platform module + config constants
    - `utils/path.rs`: parent_path, is_root_path, file_extension, normalize_separators (with tests)
    - `utils/validation.rs`: is_valid_filename, validate_filename, INVALID_FILENAME_CHARS, MAX_FILENAME_LENGTH, reserved name detection (with tests)
    - `utils/format.rs`: format_bytes, format_speed, format_remaining (with tests)
    - `utils/time.rs`: epoch_secs, epoch_millis, system_time_to_epoch_secs
    - `platform/mod.rs`: Platform enum (Windows/Linux/macOS/Android/iOS), current(), is_desktop(), is_mobile(), path_separator(), display_name()
    - `config/constants.rs`: TRANSFER_CHUNK_SIZE, TRANSFER_PROGRESS_INTERVAL_MS, SEARCH_PROGRESS_INTERVAL_MS, CLIPBOARD_EXPIRY_SECS, HEARTBEAT_INTERVAL_SECS, APP_NAME, APP_IDENTIFIER, DEFAULT_AGENT_PORT
  - **Desktop consumes storageos-core** (A-003 + A-004): path dependency added to desktop Cargo.toml
    - `OperationResult` replaced: desktop `file_operations.rs` re-exports from `storageos_core::models::OperationResult` (identical shape)
    - `DirectoryEntry` adapter: kept for TS serialization compat, `From<Entry>` and `Into<Entry>` conversions added
    - `FileAttributes` adapter: kept for TS serialization compat, `From<EntryMetadata>` and `Into<EntryMetadata>` conversions added
    - `LocalDrive`/`DriveType` adapter: kept for TS serialization compat, `Into<Root>` conversion added
    - `validate_filename()` replaces inline char checks in `file_operations.rs` (A-004)
    - `format_bytes()` replaces local function in `transfer_worker.rs` (A-004)
    - `From<CoreError> for BridgeError` adapter added to desktop errors module (A-004)
    - `From<Root> for LocalDrive` reverse adapter added (A-005) for core→desktop conversion
    - Desktop compiles clean with storageos-core dependency
  - **Filesystem migration (A-005)**: Business logic moved from desktop `services/` into `storageos_core::filesystem`
    - `filesystem/directory.rs`: list_directory() → Vec<Entry> with sorted output, platform-specific is_hidden()
    - `filesystem/operations.rs`: create_folder, rename_item, delete_item, copy_item, move_item → CoreResult<OperationResult>
    - `filesystem/drives.rs`: list_roots() → Vec<Root> with Windows API drive detection (cfg-gated), volume_label/windows_drive_type in metadata.custom
    - `filesystem/attributes.rs`: get_attributes, set_hidden, set_readonly → CoreResult<EntryMetadata> with Windows GetFileAttributesW/SetFileAttributesW (cfg-gated)
    - `filesystem/mod.rs`: sub-module declarations, re-exports, FileSystemService trait retained
    - Desktop services rewritten as thin adapters: call core, convert CoreError→BridgeError (existing From), convert Entry→DirectoryEntry / Root→LocalDrive / EntryMetadata→FileAttributes
    - 18 unit tests passing (11 existing + 7 new filesystem tests)
    - Both crates compile clean, no TypeScript/IPC/JSON changes
  - **Transfer engine migration (A-006)**: Transfer engine moved from desktop into `storageos_core::transfer`
    - `transfer/engine.rs`: `execute_transfer()` with generic progress callback `Fn(&TransferSnapshot)`, chunked copy/move, progress/speed/ETA calculation, disk space checks, overwrite handling, same-volume move optimization, partial cleanup on cancel/error
    - `transfer/controller.rs`: signal registry (CONTROLS HashMap<String, Arc<AtomicU8>>), `register()`, `unregister()`, `set_signal()`, signal constants (SIGNAL_RUNNING/PAUSED/CANCEL)
    - `transfer/mod.rs`: sub-module declarations, re-exports, `TransferService` trait retained
    - Uses `std::sync::LazyLock` for CONTROLS static (no `once_cell` dependency needed)
    - Uses `crate::config::constants::TRANSFER_CHUNK_SIZE` and `TRANSFER_PROGRESS_INTERVAL_MS`
    - Uses `crate::utils::format_bytes` for disk space error messages
    - `get_free_space()` moved to core with Windows cfg-gating
    - Desktop `transfer_worker.rs`: thin adapter with `TransferProgressPayload` (camelCase for TS), converts `TransferType` string→enum, bridges callback to `app.emit("transfer:progress", ...)`
    - Desktop `commands/transfer.rs`: uses named signal constants instead of magic numbers
    - 31 unit tests passing (18 existing + 13 new: 2 controller + 11 engine)
    - Both crates compile clean, no TypeScript/IPC/JSON changes
  - **Search engine migration (A-007)**: Search engine moved from desktop into `storageos_core::search`
    - `search/engine.rs`: `search_directory()` with generic progress callback `&dyn Fn(&SearchSnapshot)`, BFS traversal via VecDeque, case-insensitive substring matching, symlink skipping, sorted results (folders first), 9 unit tests
    - `search/mod.rs`: sub-module declaration, re-export `search_directory`, `SearchService` trait retained
    - Reuses `is_hidden()` from `filesystem::directory` (made `pub(crate)`) — no duplicate platform-specific code
    - Uses core domain types: `Entry`, `EntryId`, `EntryKind`, `EntryMetadata`, `SearchSnapshot`
    - Desktop `services/search.rs`: thin adapter — calls core, maps `Entry` → `DirectoryEntry` via existing `From` impl
    - Desktop `commands/search.rs`: bridges `SearchSnapshot` → `SearchProgressPayload` with `Cell<Instant>` for 250ms throttling (compatible with `Fn` callback)
    - 41 unit tests passing (31 existing + 9 new search + 1 existing search-related). Both crates compile clean. No TypeScript/IPC/JSON changes.

## StorageOS Agent (services/storageos-agent/)

- [x] Standalone Agent binary (A-008)
  - Rust binary crate: `storageos-agent` v0.1.0
  - Depends on `storageos-core` (path dependency) — no Tauri dependency
  - Configuration: TOML-based (`AgentConfig` struct), loads from `%LocalAppData%\StorageOS\config.toml` or `--config` CLI arg
    - 4 sections: server (port), logging (level), database (path), storage (path)
    - Defaults from storageos-core constants (`DEFAULT_AGENT_PORT` = 19742)
    - CLI overrides: `--config <path>`, `--port <port>`
  - Structured logging: `tracing` + `tracing-subscriber`, dual output (stderr human-readable + JSON daily-rotated file)
  - SQLite database: `rusqlite` (bundled), WAL mode, `schema_version` table, idempotent init, graceful close with WAL checkpoint
  - HTTP API (Axum 0.7): `GET /health`, `GET /version`, `GET /roots`, `GET /directory?path=...`
  - WebSocket: `/ws` endpoint, accepts connections, Ping/Pong, infrastructure only
  - Lifecycle: config → logging → database → provider registration → HTTP/WS → graceful shutdown (Ctrl+C)
  - Platform paths: Windows `%LocalAppData%\StorageOS\data\`, Linux/macOS `~/.local/share/storageos/`
  - 5 unit tests (3 config, 2 database)
  - Dependencies: tokio, axum 0.7, rusqlite 0.32, tracing, tracing-subscriber, tracing-appender, toml, serde, serde_json
- [x] Desktop ↔ Agent Integration Phase 1 (A-009)
  - AgentClient service (`services/agent/AgentClient.ts`): connection state machine, health polling, auto-launch, retry loop, subscriber pattern
  - Connection states: Offline, Starting, Connecting, Connected, Error
  - Zustand store (`stores/agent.ts`): reactive state, version, uptime, error tracking
  - Rust agent launcher (`services/agent.rs`): binary locator (same-dir/parent-dir), detached process spawner (Windows `CREATE_NO_WINDOW | DETACHED_PROCESS`)
  - Tauri commands: `launch_agent` (find + spawn), `agent_port` (constant from storageos-core)
  - TypeScript bridge: `launchAgent()`, `agentPort()`, `AgentLaunchResult` type
  - `useAgentConnection` hook in `App.tsx` — boots on app start, wires to store
  - StatusBar: dynamic agent status (color-coded dot, state label, version when connected)
  - Desktop fully functional without agent — shows "Agent Offline"
  - 20 IPC commands total (+launch_agent, +agent_port)
  - Agent auto-launched with `--bind 0.0.0.0` for LAN access (Sprint 8 Part 2)
- [x] QR Pair Device dialog (Sprint 8 Part 3)
  - `PairDeviceDialog` component: modal overlay, fetches `/pair` info + displays QR from `/pair/qr`
  - Shows device name, IP:port, "Both devices must be on same Wi-Fi" notice
  - Accessible from StatusBar "Pair" button and NavigationPanel "Devices" section
- [x] Devices section in NavigationPanel (Sprint 8 Part 4 + TDN-001)
  - "This PC" with agent status dot
  - Remote devices from `GET /devices` with type-aware icons (phone/desktop), friendly names, status dots (online=green, offline=gray)
  - "Pair device..." button opens QR dialog
  - Polls every 10 seconds for live status
- [x] Devices page (Sprint 8 Part 4 + TDN-001 Part 7)
  - "This PC" card with agent name, address, version, status dot
  - "Pair Device" button opens QR dialog
  - Paired Devices section with rich cards: friendly name, device type icon (phone/desktop), status dot (online/offline), platform, address/last seen, paired date, version
  - Action buttons per device: Browse (disabled when offline), Rename (modal dialog with system name shown), Forget (confirmation dialog warning about bilateral removal)
  - Polls `GET /devices` every 8 seconds for live status updates
  - Empty state for no paired devices
- [x] Settings page (Sprint 8 Part 6)
  - Agent section: status badge, version, uptime, port, bind address
  - Appearance section: theme (system default)
  - Startup section: agent start mode
  - About section: StorageOS version, Tauri, platform, repository
- [x] Local Filesystem API Phase 1 (A-010)
  - Agent endpoints: `GET /roots` (drive enumeration), `GET /directory?path=...` (directory listing)
  - Agent `dto.rs`: `LocalDriveDto`, `DirectoryEntryDto`, `ErrorDto` — convert core types to UI-compatible JSON shapes
  - `GET /directory` runs on `spawn_blocking`, maps CoreError to HTTP status codes (404/403/400/500)
  - AgentClient: `fetchRoots()`, `fetchDirectory(path)`, `isConnected()` methods
  - Module-level singleton: `getAgentClient()` / `setAgentClientInstance()`
  - ExplorerService: `listDrives()` and `listDirectory()` try Agent first, silently fall back to Tauri IPC
  - All other operations remain on Tauri IPC (unchanged)
  - No duplicated business logic — both Agent and Desktop use `storageos_core::filesystem::*`
  - Desktop UI unchanged, Explorer behavior identical regardless of data source
- [x] File Read API (A-011)
  - Agent endpoints: `GET /file?path=...` (metadata), `GET /download?path=...` (streaming), `GET /thumbnail?path=...&max_size=256` (JPEG thumbnails)
  - `security.rs`: path validation module — rejects empty, relative, traversal (`..`), nonexistent paths; `validate_path()` and `validate_file_path()` (confirms `is_file()`); 5 unit tests
  - `file_service.rs`: `get_file_metadata()` (validates + reads metadata → Entry), `prepare_download()` (validates file + mime_guess), `supports_thumbnail()` (jpg/jpeg/png/gif/webp/bmp), `generate_thumbnail()` (validates + opens image + resizes + JPEG encode)
  - `GET /file`: returns `DirectoryEntryDto` via `spawn_blocking`, maps CoreError to HTTP status codes
  - `GET /download`: streams file via `tokio::fs::File` + `ReaderStream` — never loads entire file into memory; Content-Type/Content-Length/Content-Disposition headers
  - `GET /thumbnail`: generates JPEG thumbnail on `spawn_blocking`, configurable `max_size` (default 256), Cache-Control header
  - Shared `core_error_to_response()` maps CoreError kinds to HTTP status codes (404/403/400/500) and error codes
  - Dependencies added: `image 0.25` (jpeg/png/gif/webp/bmp), `tokio-util 0.7` (io), `mime_guess 2`
  - Desktop NOT migrated — continues using Tauri IPC for all file access
  - 51 tests passing (41 core + 10 agent)
- [x] Agent network bind support (VS-001 prerequisite)
  - Added `bind` field to `ServerConfig` (default: `"127.0.0.1"`)
  - Added `--bind` CLI arg (e.g. `--bind 0.0.0.0` for LAN access)
  - Config file support: `[server] bind = "0.0.0.0"` in config.toml
  - Fallback to 127.0.0.1 on invalid bind address with warning log
- [x] System tray icon (Sprint 8 Part 1)
  - `tray-icon 0.24` crate, Windows `PeekMessageW` message pump on background thread
  - Menu items: status label, View Logs, Restart, Exit
  - 32x32 blue circle RGBA icon with anti-aliased edge
  - `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` — no console in release
  - Graceful shutdown via `tokio::select!` between Ctrl+C and tray Exit command
  - Added `windows-sys 0.59` dependency (Win32_UI_WindowsAndMessaging)
- [x] Desktop auto-launches Agent with `--bind 0.0.0.0` (Sprint 8 Part 2)
- [x] QR pairing endpoints (Sprint 8 Part 3)
  - `GET /pair` — returns JSON `{host, port, name}` with auto-detected LAN IP and hostname
  - `GET /pair/qr` — returns SVG QR code image encoding the pair JSON payload
  - LAN IP detection via UDP socket trick (no external request)
  - Added `qrcode 0.14` and `hostname 0.4` dependencies
- [x] Trusted Device Network Foundation (TDN-001)
  - **Part 1 — Persistent Device Registry**: SQLite `devices.db` with `agent_identity` (persistent UUID) and `devices` tables (13 columns: device_id, system_name, friendly_name, device_type, platform, version, address, last_seen, paired_at, status, capabilities, permissions, public_key)
  - `DeviceRegistry` struct: `get_or_create_device_id()`, `register_device()`, `get_device()`, `list_devices()`, `update_friendly_name()`, `update_device_status()`, `remove_device()`
  - **Part 2 — Editable Friendly Names**: PATCH `/devices/{id}` updates friendly_name, system_name stays immutable
  - **Part 3 — Enhanced QR Pairing**: QR payload includes device_id + pairing_token + version. POST `/devices/pair` validates token, mutual registration (both devices store each other). PairDeviceResponse returns agent's own device info
  - **Part 4 — Presence Poller**: Background tokio task polls GET `/presence` on every known device every 12 seconds, updates status to online/offline in SQLite. GET `/presence` returns device_id, system_name, status, address, version, platform, capabilities, uptime, timestamp
  - **Part 5 — Auto-reconnect**: Presence poller continuously monitors known devices, automatically detects when offline devices come back online
  - **Part 6 — Forget Device**: DELETE `/devices/{id}` removes local record AND spawns async task to notify remote via POST `/devices/{id}/forget`. Remote endpoint removes device from its own registry
  - **Part 8a — Android Embedded HTTP Server**: NanoHTTPD on port 19743 exposing phone storage (health, presence, roots, directory, download). CORS enabled. JSON format matches desktop agent
  - **Part 8b — Desktop Remote Browsing**: Explorer transparently browses remote device storage via HTTP. Remote banner, breadcrumb support, read-only mode
  - **Part 9 — Heartbeat Health**: Presence poller serves as continuous health monitoring with 12-second intervals
  - **CORS**: `tower-http` CorsLayer with `allow_origin(Any)` for Tauri webview cross-origin access
  - Added dependencies: `uuid 1` (v4), `reqwest 0.12` (json, rustls-tls), `tower-http 0.6` (cors)

## Android App (apps/mobile/android/)

- [x] Android Remote Browse MVP (VS-001)
  - **Framework**: Jetpack Compose + Material 3 + Navigation Compose
  - **Language**: Kotlin, minSdk 26, targetSdk 35
  - **Architecture**: Single Activity, MVVM (ViewModel + StateFlow)
  - **Network**: Retrofit 2 + OkHttp + kotlinx.serialization
  - **Screens**: ConnectScreen (IP + port input) → BrowserScreen (drives → folders → files)
  - **Agent API**: Uses `GET /health`, `GET /roots`, `GET /directory?path=...`
  - **Features**:
    - Enter IP and port, tap Connect, health check validates connection
    - Drive list with storage usage bars (free/total)
    - Directory listing with folder/file icons, name, date, size
    - Folders first, alphabetical sort (matches Desktop)
    - Tap folder to navigate in, system back button to go back
    - Path shown in top bar with item count
    - Back from drives returns to connect screen
    - Friendly error messages (connection failed, timeout, permission denied, not found)
    - Material You dynamic color on Android 12+
    - Edge-to-edge display
  - **Read-only**: No write operations, no file downloads, browse only
  - **No**: authentication, accounts, discovery, search, transfers
- [x] QR Device Pairing (Sprint 8 Part 3) + TDN-001 Enhanced Pairing
  - ZXing embedded QR scanner (camera permission + scanner activity)
  - Scans QR JSON payload (device_id, host, port, name, pairing_token, version)
  - Calls POST `/devices/pair` with pairing_token for mutual registration
  - `DeviceStore`: SharedPreferences-based paired device storage with persistent device_id (UUID v4)
  - `SavedDevice` stores full device info: deviceId, host, port, name, systemName, deviceType, platform, version
  - Device dedup by device_id (not host:port) — handles IP changes
  - ConnectViewModel: `onQrScanned()`, `connectToSaved()`, `connect()` with pairing_token support
- [x] Android Redesign (Sprint 8 Part 5)
  - Breadcrumb navigation bar (scrollable, clickable segments, home icon)
  - Shimmer loading placeholder (animated gradient, 8 skeleton rows)
  - Pull-to-refresh via `PullToRefreshBox`
  - Grid/List toggle with `LazyVerticalGrid` (adaptive 96dp columns)
  - `AnimatedContent` transitions between states
  - Item count display below breadcrumbs
- [x] Android Sectioned Home View (PM2-006)
  - Root/home view redesigned to match desktop NavigationPanel layout
  - "LOCAL STORAGE" section: compact DriveRow items (36dp icon, name, file system tag, 4dp progress bar, free/total text)
  - "DEVICES" section: DeviceRow items with 8dp status dots (This Phone, My Computer)
  - SectionHeader composable with icon + uppercase label
  - Replaced old DriveCard with compact list-style layout
- [x] Android Settings (Sprint 8 Part 6)
  - SettingsScreen: Theme (system), Clear saved devices (with confirmation dialog), About
  - Settings icon in BrowserScreen top bar
  - Navigation route: browser → settings → back
- [x] Android Device Dashboard (TDN-001 Part 7)
  - `DevicesScreen`: shows paired devices with live status (online/offline indicator)
  - `DeviceCard`: device icon (phone/desktop), friendly name, address, status dot, platform, version, paired date, last seen
  - `DevicesViewModel`: polls `GET /devices` every 8 seconds
  - `AgentApi.listDevices()` endpoint added
  - Devices button in BrowserScreen top bar (phone icon)
  - Navigation route: browser → devices → back
- [x] Android Embedded HTTP Server (TDN-001 Part 8a)
  - `StorageServer.kt`: NanoHTTPD on port 19743, bound to `0.0.0.0`
  - Endpoints: `/health`, `/presence`, `/roots` (StatFs), `/directory?path=...`, `/download?path=...`
  - Path translation: `0:\` → `Environment.getExternalStorageDirectory()`
  - JSON shapes match desktop agent exactly (DirectoryEntry, LocalDriveInfo format)
  - CORS headers (Access-Control-Allow-Origin: *) for cross-origin webview access
  - Started on `MainActivity.onCreate`, stopped on `onDestroy`
  - Storage permissions: READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_MEDIA_AUDIO
  - Dependency: `org.nanohttpd:nanohttpd:2.3.1`
- [x] Desktop Remote Device Browsing (TDN-001 Part 8b)
  - `ExplorerService.listRemoteRoots()` / `listRemoteDirectory()` for HTTP fetch from remote devices
  - Explorer store: `remoteDevice` state, `browseRemoteDevice()` / `exitRemoteBrowse()` actions
  - `loadDirectory` transparently routes to local or remote based on `remoteDevice` state
  - Remote device banner in Explorer: device name, address, Disconnect button
  - AddressBar shows device name instead of "This PC" in remote mode
  - Breadcrumb navigation handles Unix-style absolute paths (Android native paths)
  - NavigationPanel: devices clickable to browse, active device highlighted, "This PC" exits remote mode
  - Devices page: Browse calls `browseRemoteDevice()` + navigates to Explorer
  - File operations disabled in remote browse mode (read-only)

## Product Milestone 2 — Image Preview & File Transfers

- [x] Android: Image Preview with Coil (PM2-001 / PM2-006)
  - Full-screen viewer with dark immersive background
  - HorizontalPager for swipe left/right through all images in current folder
  - ZoomableImage composable: pinch-to-zoom (1x–5x), double-tap zoom (3x), pan with bounds
  - `beyondViewportPageCount = 1` for preloading adjacent images
  - Coil SubcomposeAsyncImage with crossfade transition
  - Loading indicator (CircularProgressIndicator), error screen (BrokenImage icon)
  - Tap to show/hide overlay controls (filename, page counter, close button)
  - BackHandler for back gesture support
  - Loads from agent `/download?path=` endpoint (works for both local and remote)
  - Supported formats: jpg, jpeg, png, gif, bmp, webp
- [x] Desktop: Image Preview (PM2-006)
  - Full-screen overlay (`z-[60]`) with dark background (95% opacity)
  - Zoom: scroll wheel (0.25x–10x), double-click toggle (1x ↔ 3x), +/- keys, 0 to reset
  - Pan: click-and-drag when zoomed in (grab/grabbing cursor)
  - Previous/Next: arrow keys + on-screen circular buttons
  - Escape to close
  - Top bar: filename, page counter (N/M), zoom level, close button
  - Loading spinner, error state with broken image icon
  - Adjacent image preloading via `new Image()` prefetch
  - Local images: Tauri asset protocol via `convertFileSrc()`
  - Remote images: `http://<address>/download?path=` (transparent routing)
  - Context menu "Preview" action for image files
  - Integrated into explorer store: `previewImages`, `previewIndex`, `openImagePreview()`, `closeImagePreview()`, `previewNext()`, `previewPrev()`
  - `openEntry()` now detects image files and opens preview instead of ignoring
- [x] Android: Streaming downloads to MediaStore (PM2-005)
  - `DownloadManager.kt`: OkHttp streaming to MediaStore Downloads with IS_PENDING pattern
  - Progress/speed/ETA tracking every 200ms
  - `TransferJob` data class and `TransferStatus` enum (shared with upload)
  - Download context menu in BrowserScreen
- [x] Android: File upload to desktop (PM2-005)
  - `UploadManager.kt`: OkHttp multipart streaming from ContentResolver URIs
  - `ActivityResultContracts.OpenMultipleDocuments` file picker
  - Upload FAB alongside New Folder FAB
- [x] Desktop: Remote download from phone (PM2-005)
  - Rust `remote_download` command: ureq GET streaming to file with progress events
  - Registers with storageos-core transfer controller for cancel support
  - `ExplorerService.remoteDownloadFile()` creates TransferJob and fires
- [x] Desktop: Remote upload to phone (PM2-005)
  - Rust `remote_upload` command: reads file, constructs multipart body, POSTs via ureq
  - `ExplorerService.remoteUploadToDevice()` creates TransferJob and fires
- [x] Cross-device copy/paste (PM2-005)
  - Clipboard stores `providerId: "remote:<address>"` for remote sources
  - `pasteEntries()` detects source/dest device and routes to correct transfer method
  - Remote→Local: `remoteDownloadFile()`, Local→Remote: `remoteUploadToDevice()`
  - Cut across devices treated as copy
  - Directory transfer handled by FolderTransferService (PM2-009)

- [x] Recursive Folder Transfers (PM2-009)
  - `FolderTransferService.ts` (~656 lines): orchestration for 3 cross-device recursive folder transfer directions
  - `FolderTransfer` type in `types.ts`: tracks child jobs, file/folder counts, bytes, speed, current file/folder, conflict policy, cancel flag
  - `ConflictPolicy` type: `replace_all | skip_all | keep_both_all`
  - `listRecursive()`: depth-first recursive enumeration of source folder (local or remote)
  - `ensureFolder()`: lazy destination folder creation — builds parent chain on demand before first file
  - `waitForJob()`: subscribes to TransferService, resolves when child job hits terminal status
  - Three async runners: `runRemoteToLocal`, `runLocalToRemote`, `runRemoteSameDevice`
  - Sequential file transfers (one at a time per folder operation)
  - Empty folder creation: remaining empty directories created after all files transfer
  - Cancel: `cancelled` flag checked before each file, running child jobs cancelled via TransferService
  - Error handling: continue on error, finalize with error counts, partial completion reported
  - Explorer store `pasteEntries()`: routes `item.type === "directory"` to FolderTransferService for cross-device; local→local unchanged (Rust engine handles natively)
  - Transfer store: subscribes to both TransferService and FolderTransferService, exposes `folderTransfers`, `cancelFolderTransfer`, `removeFolderTransfer`, `isChildJob`
  - Transfers page: `FolderRow` component with expand/collapse, folder icon, aggregate progress (bytesTransferred/speed/ETA computed from child jobs), status detail, cancel/remove
  - Child jobs hidden from main list via `isChildJob` filter, shown indented when folder row expanded

## Domain Model

- [x] `docs/architecture/DomainModel.md` — Canonical domain model (A-002.5)
  - 11-part DDD architecture document defining the shared vocabulary for all StorageOS components
  - Core domain objects: Account, Device, Provider, Root, Entry, Transfer, Clipboard, Notification, Session, Permission
  - Hierarchy: Account → Device → Provider → Root → Entry (with cross-cutting Transfer, Clipboard, Notification)
  - Composition over inheritance: EntryKind discriminator, RootKind (Drive/Bucket/Library/SharedDrive/Volume/Mount/Container), EntryMetadata (flat optional struct + custom map)
  - Key renames: DirectoryEntry → Entry, LocalDrive → Root, DriveType → RootKind, FileAttributes → EntryMetadata, ClipboardItem → EntryRef, TransferProgress → TransferSnapshot
  - EntryRef: universal cross-device cross-provider pointer (device + provider + root + path)
  - 30+ canonical events with consistent `{domain}.{action}` naming convention
  - Strongly typed identifiers: AccountId, DeviceId, ProviderId, RootId, EntryId, TransferId, etc.
  - Cross-provider compatibility verified for 12 providers (Windows/Linux/macOS/Android/Google Drive/OneDrive/Dropbox/SharePoint/S3/SMB/FTP/NAS)
  - Future-proofed against 10 features (sync, offline cache, versioning, sharing, collaboration, AI, virtual providers, encryption, backup, snapshots) — all additive
  - Migration strategy: renames in storageos-core first, Tauri command layer provides compatibility mapping, frontend updated last

## Architecture Documents

- [x] `docs/architecture/Agent.md` — StorageOS Agent architecture v2.0 (A-001R revision)
  - **Fundamental reframe**: Agent is the product, all UIs are thin clients, distributed personal storage platform (not a file manager helper)
  - Account Architecture: Account as root identity, Ed25519 key pairs, OS key store, future family/organization evolution
  - Device Registry: 20+ field model (device_type, capabilities, presence, battery, network, public_key, certificate, trust_level)
  - Pairing Architecture: QR/code pairing via ECDH, Ed25519 device certificates, no passwords, no central server required
  - Discovery: 4-layer strategy (local cache → mDNS → relay/future → manual), works offline
  - Communication: Named Pipes/UDS for local IPC, TCP+TLS for network, QUIC for future mobile, MessagePack protocol
  - StorageOS SDK: Rust core with FFI to TypeScript/Kotlin/Swift, transport abstraction, auto-reconnect, caching
  - Permissions: 13-capability per-device model, designed to evolve to RBAC for enterprise
  - Presence: 7 states (online/offline/sleeping/busy/syncing/transferring/idle), heartbeat protocol
  - Clipboard: Agent-owned, persistent, cross-device sync, history, expiration, permissions
  - Notifications: First-class system with categories, priorities, persistence, cross-device delivery, OS-native integration
  - Execution Mode: Background user process for MVP (not Windows Service), evolution path to tray/service/systemd
  - Search: SQLite FTS5 for MVP (not tantivy), tantivy deferred to Phase 5
  - Plugin Architecture: Honestly deferred to Phase 6 (not MVP-appropriate)
  - Connector Layer: StorageConnector trait, capability negotiation, all connectors compiled in (no dynamic loading)
  - Transfer Engine: cross-provider + cross-device streaming, pause/resume across network interruptions
  - 7-phase evolution roadmap: Desktop → Multi-Device → Cloud → Sync → AI → Platform → Enterprise
  - Section 29: "Architectural Changes from Revision 1" — 14 documented changes with rationale

## What Does NOT Exist

- [x] Rust toolchain (rustc 1.96.0, cargo 1.96.0 stable)
- [ ] Docker Desktop
- [ ] GitHub CLI
- [x] Filesystem business logic in storageos-core (A-005)
- [ ] Any API integration
- [ ] Any authentication
- [ ] Any database
- [ ] Any tests
- [ ] Any CI/CD
- [x] Git remote (GitHub) and branch strategy (main + develop)

## Dependencies (apps/desktop)

### Runtime
- react 19.2.7
- react-dom 19.2.7
- react-router-dom 7.18.1
- zustand 5.0.14
- @tanstack/react-query 5.101.2
- @tauri-apps/api (Tauri IPC bridge)

### Dev
- tailwindcss 4.3.2
- @tailwindcss/vite 4.3.2
- typescript 6.0.2
- vite 8.1.0
- @vitejs/plugin-react 6.0.2
- @tauri-apps/cli (Tauri CLI)

## Dependencies (apps/mobile/android)

### Runtime
- Jetpack Compose (BOM 2024.12.01)
- Material 3 + Material Icons Extended
- Navigation Compose 2.8.5
- Retrofit 2.11.0 + OkHttp 4.12.0
- kotlinx-serialization-json 1.7.3
- Lifecycle ViewModel Compose 2.8.7
- ZXing Android Embedded (QR code scanning)

### Build
- AGP 8.7.3
- Kotlin 2.1.0
- Gradle 8.11.1

- [x] Android: Streaming Downloads with Notifications (PM2-007)
  - `TransferNotifications.kt`: Two-channel notification system (progress + completion)
    - `CHANNEL_PROGRESS` (IMPORTANCE_LOW): ongoing download/upload progress with percentage and speed
    - `CHANNEL_COMPLETE` (IMPORTANCE_DEFAULT): completion, upload complete, and failure notifications
    - Stable notification IDs via `hashCode()` with COMPLETE_OFFSET to avoid collision
    - Opens app on tap via PendingIntent
  - `DownloadManager.kt` enhancements:
    - Notification integration: progress during streaming, completion after IS_PENDING cleared, failure on error, cancel on user abort
    - `formatSpeed()`: human-readable speed formatting (B/s → KB/s → MB/s → GB/s)
    - `resolveUniqueName()`: queries MediaStore for existing filenames, appends (1), (2), etc. for duplicates
  - `UploadManager.kt` enhancements:
    - Notification integration: upload progress, upload completion, failure, cancel
    - `formatSpeed()` helper matching DownloadManager
    - `clearCompleted()` method for clearing terminal transfer jobs
  - `TransfersScreen.kt`: Full transfers management UI
    - Lists all download and upload jobs with status-specific icons (cloud download/upload, check, error, cancel)
    - Running transfers: LinearProgressIndicator, transferred/total size, speed, ETA
    - Terminal states: Completed (size), Failed (error message), Cancelled
    - Cancel button for active transfers, remove button for completed
    - Clear All action in top bar for batch cleanup
    - Empty state when no transfers
    - `formatSize()`, `formatSpeed()`, `formatEta()` display helpers
  - Navigation: Transfers button (SwapVert icon) in BrowserScreen top bar
  - DownloadManager and UploadManager lifted to AppNavigation level for shared state across screens
  - Navigation route: browser → transfers → back

- [x] Streaming Uploads (PM2-008)
  - **Rust streaming upload rewrite**: `execute_remote_upload()` in `remote_transfer_worker.rs` rewritten from full-memory `std::fs::read()` to streaming via custom `PipeRead` struct
    - `PipeRead` implements `Read` trait with 4 phases: Header → File → Footer → Done
    - Streams file data through multipart boundary format without loading entire file into memory
    - Progress events emitted every 200ms via `app.emit("transfer:progress", ...)`
    - Cancel support via `storageos_core::transfer::get_signal()` checked on every `read()` call
    - Content-Length calculated upfront (header + file + footer) for accurate streaming
  - **Agent /upload endpoint streaming**: Rewrote from `field.bytes().await` (full buffer) to `field.chunk().await` loop
    - Streams chunks directly to disk via `tokio::fs::File` + `AsyncWriteExt::write_all()`
    - `resolve_upload_name()` for duplicate filename handling (appends (1), (2), etc.)
  - **Android /upload endpoint**: `resolveUploadName()` for duplicate filename handling on StorageServer
    - Changed from `copyTo(overwrite=true)` to `resolveUploadName()` + `copyTo(overwrite=false)`
  - **Desktop file picker**: Native file dialog via `rfd` crate (Rust File Dialog)
    - `pick_files` Tauri command: opens native Windows file picker, returns selected file paths with names and sizes
    - TypeScript: `pickFiles()` IPC command, `PickedFile` type
    - Upload toolbar button wired to `pickFiles()` → `remoteUploadToDevice()` / `uploadToLocal()`
    - Context menu "Upload files" option on right-click background
    - `ExplorerService.uploadToLocal()`: local copy via existing transfer pipeline
  - **Dependencies**: Added `rfd 0.15` to desktop Cargo.toml for native file dialog
  - 23 IPC commands total (+pick_files)

- [x] Fix: Cross-device copy/paste bugs
  - **Missing filename in upload URL**: `remoteUploadToDevice` and `remoteUpload` now include `&filename=` in upload URL query params — Android NanoHTTPD server uses this to save with correct filename
  - **Same-device remote copy/paste**: Copying files within a remote device (same address) now works via `remoteCopyOnDevice()` (download blob + re-upload) instead of showing "not supported" error
  - **Conflict resolution preserves providerId**: `pasteConflict` stores `providerId` so cross-device paste after name conflict resolution uses the correct transfer path
  - **Download dest path**: Trailing separator stripped before joining filename

## Product Milestone 3 — Product Polish & UX

- [x] Design System documentation (PM3-001)
  - 8 files in `docs/design/`: DesignSystem.md, Colors.md, Typography.md, Icons.md, Motion.md, Desktop.md, Android.md, Accessibility.md
  - Covers design tokens, color palettes, typography scale, icon system, animation guidelines, platform-specific patterns, WCAG 2.1 AA accessibility standards
- [x] Desktop dark theme polish (PM3-002)
  - Warmer Windows 11-aligned dark palette: surface, border, sidebar, toolbar, accent-subtle colors updated
  - Deep navy (#0c1222) replaced with warmer tones (#1a1a2e) throughout
- [x] Desktop layout polish (PM3-003)
  - Sidebar: logo height h-12→h-11, text 13px, nav padding py-2, tooltip on collapsed items, transition-colors
  - TopNav: title attributes on all icon buttons, context-aware theme toggle aria-label, gap/margin tweaks, breadcrumb separator shrink-0
  - TopNav: Ctrl+K keyboard shortcut to focus search, "Ctrl+K" hint in placeholder, Esc to clear with title
  - StatusBar: title tooltip on agent status dot
- [x] Desktop dialog consistency (PM3-004)
  - Devices.tsx Rename dialog: aligned backdrop (bg-black/50), heading (13px), input (h-8, 12px, focus:border-accent), buttons (h-8 px-4)
  - Devices.tsx Forget dialog: aligned backdrop, heading, body (leading-relaxed), strong text class, buttons
  - All dialogs now share consistent styling patterns across Explorer and Devices pages
- [x] Desktop context menu polish (PM3-005)
  - Min-width 160→180px, added role="menu"
  - ContextMenuItem: added shortcut prop, role="menuitem", flex layout with right-aligned shortcut hints
  - Shortcut hints: Open→Enter, Copy→Ctrl+C, Cut→Ctrl+X, Paste→Ctrl+V, Rename→F2, Hide→Ctrl+H, Delete→Del
- [x] Desktop pages polish (PM3-006)
  - Explorer: ToolbarButton rounded→rounded-md, ToolbarDivider h-4 mx-1
  - Explorer dialogs: backdrop bg-black/50, width 360px, rounded-lg
  - Transfers: table header bg-surface-secondary, empty state redesigned with accent-subtle icon container
  - PropertiesPanel: header py-2, text-[11px] text-text-secondary
- [x] Desktop empty/loading/error states (PM3-007)
  - Transfers empty state: centered icon in rounded-2xl accent-subtle container, heading + description
- [x] Performance review (PM3-008)
  - Sidebar: transition-all→transition-colors (specific, avoids layout thrash)
  - Breadcrumb separator: shrink-0 prevents layout reflow
  - CSS containment and content-visibility already in place from EXP-006
- [x] Desktop accessibility & keyboard (PM3-009)
  - FileArea keyboard handler: Delete, F2, Ctrl+C/X/V/H/A, Enter, Escape, F5, Alt+Arrow (Back/Forward/Up)
  - Ctrl+A: selects all visible entries using existing shift-select range logic
  - Escape: clears search or deselects, F5: refresh, Alt+Arrows: navigation
  - All keyboard shortcuts match context menu shortcut hints (PM3-005)
- [x] Android Material 3 polish (PM3-010)
  - Light theme: added primaryContainer, secondaryContainer, error/onError colors, refined surface/outline
  - Dark theme: added primaryContainer, secondaryContainer, error/onError colors, refined surface/outline to match iOS-inspired dark palette
- [x] Build verification (PM3-011)
  - TypeScript: `npx tsc --noEmit` — clean pass
  - Rust: `cargo check` — passed (pre-existing dead_code warnings only, unrelated to PM3)

## Last Updated

Product Milestone 3 — PM3-011 Build verification and self review (2026-07-03)
