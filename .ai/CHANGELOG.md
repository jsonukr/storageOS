# Changelog

All notable changes to StorageOS, logged after each commit.

## [Unreleased]

### Product Milestone 3 — Product Polish & UX

#### 2026-07-03 — PM3: Visual Polish, Accessibility, Design System

- **Design System Documentation (PM3-001)**: 8 comprehensive design docs in `docs/design/`
  - `DesignSystem.md`: Design token architecture, 8px spacing grid, component principles
  - `Colors.md`: Light/dark palettes, semantic color roles, theme switching via CSS custom properties
  - `Typography.md`: Type scale (11px–18px), font stack, weight usage, line height
  - `Icons.md`: Inline SVG system, 16/20px sizes, stroke widths, file type color coding
  - `Motion.md`: 150–250ms duration targets, easing curves, transition-colors preference
  - `Desktop.md`: Windows 11 Fluent Design patterns, Explorer-derived layouts, dialog/toolbar/context menu specs
  - `Android.md`: Material 3 / Material You theming, Jetpack Compose patterns, touch targets
  - `Accessibility.md`: WCAG 2.1 AA target, keyboard shortcuts reference, ARIA patterns, focus management, contrast requirements

- **Desktop Dark Theme Polish (PM3-002)**: Warmer Windows 11-aligned dark palette
  - Surface colors: deep navy (#0c1222) → warmer (#1a1a2e) series
  - Border colors: #1e293b → #2d2d4a (more visible separation)
  - Sidebar/toolbar/statusbar: #0f1829 → #16162b / #1e1e35
  - Accent-subtle: #172554 → #1e2a4a

- **Desktop Layout Polish (PM3-003)**: Sidebar, TopNav, StatusBar refinements
  - Sidebar: logo h-12→h-11, text-[13px], py-2 nav items, py-[7px] item padding, tooltip on collapsed items, transition-colors
  - TopNav: title attributes on all icon-only buttons, context-aware aria-labels, gap-1 spacing, Ctrl+K search focus shortcut with placeholder hint, Esc clear with title
  - StatusBar: title tooltip on agent status dot

- **Desktop Dialog Consistency (PM3-004)**: Unified dialog styling across pages
  - Devices Rename dialog: backdrop bg-black/50, title text-[13px], input h-8 text-[12px] with focus:border-accent focus:ring-1, buttons h-8 px-4
  - Devices Forget dialog: same backdrop/title/button pattern, leading-relaxed body, strong text-text-primary
  - All dialogs now consistent with Explorer dialogs

- **Desktop Context Menu Polish (PM3-005)**: Keyboard shortcut hints + ARIA
  - Context menu: min-width 180px, role="menu"
  - ContextMenuItem: shortcut prop, role="menuitem", flex layout with right-aligned shortcut text
  - Shortcut hints: Open→Enter, Copy→Ctrl+C, Cut→Ctrl+X, Paste→Ctrl+V, Rename→F2, Hide→Ctrl+H, Delete→Del

- **Desktop Pages Polish (PM3-006)**: Explorer, Transfers, PropertiesPanel
  - Explorer: ToolbarButton rounded-md, ToolbarDivider h-4 mx-1, dialogs w-[360px] rounded-lg bg-black/50
  - Transfers: table header bg-surface-secondary, empty state redesigned with accent-subtle icon + heading/description
  - PropertiesPanel: header py-2, text-[11px] text-text-secondary

- **Desktop Accessibility & Keyboard (PM3-009)**: Comprehensive keyboard navigation
  - FileArea keyboard handler: 15+ shortcuts covering all file operations
  - Delete, F2 rename, Ctrl+C/X/V copy/cut/paste, Ctrl+H toggle hidden, Ctrl+A select all
  - Enter open, Escape deselect/clear search, F5 refresh
  - Alt+Arrow navigation: Back, Forward, Up
  - All keyboard shortcuts behave identically to context menu actions

- **Android Material 3 Polish (PM3-010)**: Refined color schemes
  - Light theme: added primaryContainer/onPrimaryContainer, secondaryContainer/onSecondaryContainer, error/onError; refined surface (#F3F3F3→#F8F8FA), surfaceContainerHigh, onSurfaceVariant, outline
  - Dark theme: added primaryContainer/onPrimaryContainer, secondaryContainer/onSecondaryContainer, error/onError; refined surface (#202020→#1C1C1E), surfaceContainer, surfaceContainerHigh, onSurface, onSurfaceVariant, outline

- **Build Verification (PM3-011)**: TypeScript and Rust clean pass

### Product Milestone 2 — Image Preview & File Transfers

#### 2026-07-03 — PM2-009: Recursive Folder Transfers

- **FolderTransferService**: Full recursive folder transfer orchestration for cross-device directions
  - `FolderTransfer` type: tracks childJobIds, totalFiles/completedFiles/failedFiles/skippedFiles, totalFolders/createdFolders, totalBytes/bytesTransferred, speed, currentFile/currentFolder, conflictPolicy, cancelled
  - `ConflictPolicy` type: `replace_all | skip_all | keep_both_all`
  - `listRecursive()`: depth-first recursive enumeration of source folder structure (local or remote)
  - `ensureFolder()`: lazy destination folder creation — creates parent chain on demand before first file in each directory
  - `waitForJob()`: subscribes to TransferService, resolves promise when child job reaches terminal status
  - Three async runners: `runRemoteToLocal`, `runLocalToRemote`, `runRemoteSameDevice`
  - Sequential file transfers within folder (one at a time to avoid overwhelming network/remote)
  - Empty folder handling: remaining empty directories created after all files transfer
  - Cancel support: `cancelled` flag checked before each file, running child jobs cancelled
  - Error handling: continue on error, finalize with error counts, partial completion reported
  - Public API: `subscribe`, `getTransfers`, `getTransfer`, `isChildJob`, `getParentId`, `cancelFolderTransfer`, `removeFolderTransfer`, `clearCompleted`, `startRemoteToLocal`, `startLocalToRemote`, `startRemoteSameDevice`

- **Explorer store**: Directory routing through FolderTransferService
  - `pasteEntries()` now routes `item.type === "directory"` to FolderTransferService for all 3 cross-device directions
  - Remote→Local directories: `FolderTransferService.startRemoteToLocal()`
  - Local→Remote directories: `FolderTransferService.startLocalToRemote()`
  - Same-device remote directories: `FolderTransferService.startRemoteSameDevice()`
  - Local→Local directories: unchanged (Rust engine's `copy_dir_chunked` handles natively)
  - Removed `skippedDirs` variable and "folder transfer not yet supported" notification

- **Transfer store**: Dual-service subscription
  - Added `folderTransfers` state, `cancelFolderTransfer`, `removeFolderTransfer`, `isChildJob` methods
  - Subscribes to both TransferService and FolderTransferService
  - `clearCompleted` calls both services
  - `syncState` reads from both services

- **Transfers page**: Folder transfer UI with expandable groups
  - `FolderRow` component: expand/collapse chevron, folder icon, aggregate progress bar, status detail (e.g. "3/10 files"), speed, ETA, elapsed, cancel/remove actions
  - `computeFolderProgress()`: real-time aggregate bytes/speed/progress/ETA from child TransferJob objects
  - Expanded view shows indented child jobs with smaller text and simplified display
  - Standalone jobs filtered via `isChildJob` — child jobs hidden from main list
  - Folder transfers grouped in Active and Finished sections alongside standalone jobs

#### 2026-07-03 — PM2-008: Streaming Uploads

- **Rust: Streaming Upload Rewrite**: `execute_remote_upload()` rewritten from full-memory to streaming
  - Custom `PipeRead` struct implementing `Read` trait with Header → File → Footer → Done phases
  - Streams file through multipart boundary format without buffering entire file in memory
  - Progress events emitted every 200ms during upload
  - Cancel support via `storageos_core::transfer::get_signal()` checked on each `read()` call
  - Content-Length pre-calculated for correct HTTP streaming

- **Agent: Streaming Upload Endpoint**: `/upload` endpoint rewritten from full-buffer to chunk streaming
  - Changed from `field.bytes().await` (loads entire upload into memory) to `field.chunk().await` loop
  - Streams chunks to disk via `tokio::fs::File` + `AsyncWriteExt::write_all()`
  - `resolve_upload_name()`: duplicate filename handling with (1), (2), etc. suffix

- **Android: Upload Conflict Handling**: `resolveUploadName()` on StorageServer
  - Changed `serveUpload()` from `copyTo(overwrite=true)` to unique name resolution + `copyTo(overwrite=false)`

- **Fix: Cross-device Copy/Paste** (Ctrl+C/V and context menu)
  - **Missing filename in upload URL**: `remoteUploadToDevice` and `remoteUpload` now include `&filename=` query parameter in upload URLs — Android's NanoHTTPD server uses this to save files with correct names instead of temp file names
  - **Same-device remote copy/paste**: Copy+paste within a remote device no longer shows "not supported" error — implemented via download+reupload through `remoteCopyOnDevice()`
  - **Conflict resolution preserves providerId**: `pasteConflict` now stores `providerId` so that cross-device paste after name conflict resolution routes through the correct transfer path instead of falling back to "local"
  - **Download dest path**: Trailing backslash stripped from `localDestDir` before joining with filename to avoid double-separator

- **Desktop: Native File Picker**: `rfd` crate for native Windows file dialog
  - New `pick_files` Tauri command: opens system file dialog, returns `Vec<PickedFile>` (path, name, size)
  - TypeScript: `pickFiles()` IPC command, `PickedFile` type in barrel exports
  - Upload toolbar button wired: opens native picker → `remoteUploadToDevice()` (remote) or `uploadToLocal()` (local)
  - Context menu "Upload files" on right-click background
  - `ExplorerService.uploadToLocal()`: copies picked files to current directory via existing transfer engine
  - Added `rfd 0.15` dependency to desktop Cargo.toml

#### 2026-07-03 — PM2-007: Streaming Downloads

- **Android: Transfer Notification System**: Two-channel notifications for download/upload progress and completion
  - `TransferNotifications.kt`: CHANNEL_PROGRESS (low importance, ongoing) for live progress with speed/percentage, CHANNEL_COMPLETE (default importance) for completion/failure alerts
  - Stable notification IDs via `hashCode()` + COMPLETE_OFFSET to avoid collision between progress and completion
  - Tap notification opens app via PendingIntent (FLAG_IMMUTABLE + FLAG_UPDATE_CURRENT)
  - Download notifications: system download icon during progress, download-done on success, error icon on failure
  - Upload notifications: system upload icon during progress, upload-done on success, error icon on failure
  - Cancel clears both progress and completion notifications for a given job

- **Android: DownloadManager Enhancements**: Notifications, duplicate filename handling, speed formatting
  - Progress notification emitted every 200ms during streaming (matches existing progress throttle)
  - Completion notification after MediaStore IS_PENDING cleared (atomic write confirmed)
  - Failure notification on error with error message, cancel clears notification
  - `resolveUniqueName()`: queries MediaStore Downloads for existing display names, appends (1), (2), etc.
  - `formatSpeed()`: human-readable speed (B/s → KB/s → MB/s → GB/s)

- **Android: UploadManager Enhancements**: Notification integration + clearCompleted
  - Upload progress notification every 200ms with speed and percentage
  - Upload completion and failure notifications
  - `clearCompleted()` method for clearing terminal transfer jobs (matches DownloadManager)
  - `formatSpeed()` helper matching DownloadManager format

- **Android: Transfers Screen**: Full transfer management UI
  - `TransfersScreen.kt`: lists all downloads and uploads with real-time status
  - Status-specific icons: CloudDownload/CloudUpload (active), CheckCircle (completed), Error (failed), Cancel (cancelled)
  - Running transfers: LinearProgressIndicator, transferred/total size text, speed, ETA
  - Terminal states: Completed with size, Failed with error message, Cancelled
  - Cancel button for active transfers, remove button for terminal states
  - "Clear" action in top bar removes all completed/failed/cancelled jobs
  - Empty state with icon when no transfers exist
  - `formatSize()`, `formatSpeed()`, `formatEta()` display helpers

- **Android: Navigation Integration**: Transfers accessible from browser
  - SwapVert icon button added to BrowserScreen top bar (between grid toggle and devices)
  - DownloadManager and UploadManager lifted to AppNavigation level for shared state across screens
  - New navigation route: browser → transfers → back

#### 2026-07-02 — PM2-006: Modern Image Preview

- **Desktop: Built-in Image Viewer**: Full-screen overlay with zoom, pan, navigation
  - Scroll wheel zoom (0.25x–10x), double-click toggle (1x ↔ 3x), keyboard (+/-/0)
  - Click-and-drag pan when zoomed in
  - Arrow key and on-screen button navigation (previous/next)
  - Escape to close, top bar with filename, page counter, zoom level
  - Loading spinner and error state
  - Adjacent image preloading for smooth navigation
  - Context menu "Preview" action for image files
  - Works transparently for local files (Tauri asset protocol) and remote devices (HTTP streaming)
  - Supported formats: jpg, jpeg, png, gif, bmp, webp

- **Android: Image Preview Enhancement**: Added `beyondViewportPageCount = 1` to HorizontalPager for preloading adjacent images during swipe

- **Android: Sectioned Home View**: Redesigned root/home view to match desktop NavigationPanel layout
  - "LOCAL STORAGE" section with compact drive rows (icon, name, file system type, usage bar, free space)
  - "DEVICES" section with "This Phone" and "My Computer" entries with online status dots
  - Replaced large card-based DriveList with compact sectioned layout
  - Section headers with uppercase labels and icons (matching desktop style)
  - "My Computer" device entry navigates to Devices screen

- **Desktop: Cross-device Copy/Paste Fix**: Fixed "Source not found" error when pasting files copied from remote device
  - Clipboard now stores remote device address in `providerId`
  - `pasteEntries()` routes to `remoteDownloadFile()` or `remoteUploadToDevice()` for cross-device transfers
  - Cut across devices treated as copy (no atomic cross-device move)

- **Desktop: Dialog Text Overflow Fix**: Long filenames in Delete and Paste Conflict dialogs now wrap properly (`overflowWrap: anywhere`)

### Sprint 08 — Productization & Device Experience + TDN-001

#### 2026-07-02 — TDN-001: Trusted Device Network Foundation

- **Agent: Persistent Device Registry (Parts 1–2)**: SQLite-backed device storage replacing in-memory HashMap
  - `devices.db` with `agent_identity` (persistent UUID v4) and `devices` tables (13 columns)
  - `DeviceRegistry` struct with full CRUD: register, get, list, update friendly name, update status, remove
  - Editable friendly names via PATCH `/devices/{id}`, system name immutable, device_id as sole unique key
  - Dependencies: `uuid 1` (v4), `reqwest 0.12` (json, rustls-tls), `tower-http 0.6` (cors)

- **Agent: Enhanced QR Pairing (Part 3)**: Mutual registration protocol
  - QR payload now includes device_id, pairing_token (UUID v4), version
  - POST `/devices/pair` validates pairing_token, stores remote device, returns own device info
  - Both devices store each other's info — no host/client distinction

- **Agent: Presence & Heartbeat (Parts 4, 5, 9)**: Background health monitoring
  - Presence poller: tokio task polls `GET /presence` on every known device every 12 seconds
  - Updates device status to online/offline in SQLite
  - GET `/presence` endpoint returns device_id, system_name, status, address, version, platform, capabilities, uptime, timestamp
  - Serves as auto-reconnect — offline devices automatically detected when they come back

- **Agent: Forget Device (Part 6)**: Bilateral trust removal
  - DELETE `/devices/{id}` removes local record + spawns async reqwest task to POST `/devices/{id}/forget` on remote
  - Remote endpoint removes the requesting device from its own registry

- **Desktop: Device Dashboard (Part 7)**: Rich device management UI
  - Devices page rewritten with "This PC" card and paired devices section
  - Device cards show: friendly name, type icon (phone/desktop), status dot, platform, address, paired date, version
  - Action buttons: Browse (disabled when offline), Rename (modal with system name), Forget (confirmation with bilateral warning)
  - Rename dialog: text input with Enter key submit, shows system name reference
  - Forget dialog: warns about bilateral removal, requires confirmation
  - NavigationPanel DevicesSection updated: uses DeviceRecord format, type-aware icons, status-aware dots
  - PairDeviceDialog updated: shows version from enhanced pairing info
  - Polls `/devices` every 8 seconds for live status

- **Android: Enhanced Pairing + Device Dashboard (Parts 3, 7)**: Full TDN integration
  - `PairDeviceRequest`/`PairDeviceResponse` replace old `RegisterDeviceRequest`/`RegisteredDevice`
  - `DeviceStore.getOrCreateDeviceId()` generates persistent UUID v4 for phone identity
  - `SavedDevice` stores full device record: deviceId, host, port, name, systemName, deviceType, platform, version
  - Device dedup by device_id instead of host:port — handles IP changes
  - `ConnectViewModel` updated: parses enhanced QR payload, calls `/devices/pair` with pairing_token, sends phone's own device info
  - New `DevicesScreen` + `DevicesViewModel`: shows paired devices with live status (online/offline)
  - `DeviceCard` composable: device icon, friendly name, status indicator, platform/version/paired date/last seen
  - Devices button in BrowserScreen top bar, navigation route wired
  - `AgentApi.listDevices()` endpoint added

- **Android: Embedded HTTP Server (Part 8a)**: Symmetric storage foundation
  - `StorageServer.kt`: NanoHTTPD server on port 19743, bound to `0.0.0.0`
  - Endpoints: `/health`, `/presence`, `/roots` (StatFs), `/directory?path=...` (dotfile-filtered, folders-first), `/download?path=...` (streaming)
  - Path translation: `0:\` maps to `Environment.getExternalStorageDirectory()`
  - JSON shapes match desktop agent exactly — same `DirectoryEntry`, `LocalDriveInfo` format
  - CORS headers (`Access-Control-Allow-Origin: *`) for desktop webview cross-origin access
  - Started in `MainActivity.onCreate`, stopped in `onDestroy`
  - Storage permissions: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`

- **Desktop: Remote Device Browsing (Part 8b)**: Browse phone storage from Explorer
  - `ExplorerService.listRemoteRoots(address)` and `listRemoteDirectory(address, path)` methods
  - `ExplorerStore.remoteDevice` state with `browseRemoteDevice()` / `exitRemoteBrowse()` actions
  - `loadDirectory` transparently routes to local or remote based on `remoteDevice` state
  - Remote device banner in Explorer toolbar: shows device name, address, Disconnect button
  - AddressBar shows device name instead of "This PC" when browsing remote
  - Breadcrumb navigation supports Unix-style absolute paths (Android native paths)
  - NavigationPanel: devices are clickable to browse, active device highlighted, "This PC" returns to local
  - Devices page: Browse button calls `browseRemoteDevice` + navigates to Explorer
  - File operations (create folder, rename, delete) disabled in remote browse mode

- **Agent: CORS Fix**: Added `tower-http` CorsLayer with `allow_origin(Any)` to fix "Agent offline" in Desktop caused by Tauri webview cross-origin restrictions

#### 2026-07-01

- **Part 1: Background Agent**: System tray icon with menu (View Logs, Restart, Exit)
  - `tray-icon 0.24` crate with Windows message pump on background thread
  - 32x32 blue circle RGBA icon generated from pixels
  - `windows_subsystem = "windows"` hides console in release builds
  - Graceful shutdown via `tokio::select!` between Ctrl+C and tray Exit
  - Dependencies: `tray-icon 0.24`, `windows-sys 0.59` (Win32_UI_WindowsAndMessaging)

- **Part 2: Desktop Productization**: Agent auto-starts with LAN bind
  - Desktop `launch_agent()` now passes `--bind 0.0.0.0` for LAN access

- **Part 3: QR Device Pairing**: Scan QR to connect phone to desktop
  - Agent: `GET /pair` (JSON with LAN IP, port, hostname), `GET /pair/qr` (SVG QR code)
  - LAN IP auto-detected via UDP socket routing (no external request)
  - Desktop: `PairDeviceDialog` component — modal with QR code, device info, fallback text
  - "Pair" button in StatusBar (visible when agent connected)
  - Android: ZXing embedded QR scanner with camera permission
  - `DeviceStore` (SharedPreferences) saves paired devices for reconnection
  - Saved devices shown as cards on ConnectScreen

- **Part 4: Device Dashboard**: Desktop and Android device views
  - Desktop NavigationPanel: "Devices" section with "This PC" status and "Pair device..." button
  - Desktop Devices page: PC info card with agent status, pair button, empty state
  - Android: saved device cards on ConnectScreen with tap-to-reconnect

- **Part 5: Android Redesign**: Material 3 polish
  - Breadcrumb navigation bar (scrollable, clickable path segments, home icon)
  - Shimmer loading placeholder (animated gradient, 8 skeleton rows)
  - Pull-to-refresh (`PullToRefreshBox`)
  - Grid/List toggle (`LazyVerticalGrid` with adaptive 96dp columns)
  - `AnimatedContent` transitions between loading/error/content states
  - Item count display below breadcrumbs

- **Part 6: Settings**: Desktop and Android settings pages
  - Desktop: Agent (status/version/uptime/port/bind), Appearance (theme), Startup, About
  - Android: Theme (system), Clear saved devices (with AlertDialog), About (version, protocol)
  - Settings icon in BrowserScreen top bar, navigation route wired

- **Part 7: Release builds**: Agent release binary compiled

### Sprint 07 — Visual Sprint (Android Remote Browse)

#### 2026-07-01

- **Android Remote Browse MVP (VS-001)**: First Android app — browse desktop files from phone over LAN
  - New Android project at `apps/mobile/android/` — Kotlin, Jetpack Compose, Material 3, minSdk 26
  - Single Activity architecture with Navigation Compose (ConnectScreen → BrowserScreen)
  - **ConnectScreen**: IP address + port input fields (default port 19742), Connect button with loading state, friendly error messages for connection failures/timeouts/unknown hosts
  - **BrowserScreen**: drive list with storage usage bars (LinearProgressIndicator, free/total display), directory listing with folder/file icons and metadata (name, date, size), folders sorted first then alphabetical (matches Desktop), tap-to-navigate folders, system back button navigates up then to drives then to connect screen
  - **TopAppBar**: shows current path or "My Computer" at root, item count subtitle, back arrow when navigable
  - **Error handling**: connection refused, timeout, permission denied, not found — all with user-friendly messages and "Go back" recovery
  - **API layer**: Retrofit 2 + kotlinx.serialization, `AgentApi` interface with `health()`, `roots()`, `directory(path)` endpoints, 5s connect / 10s read timeouts
  - **Data models**: `HealthResponse`, `DriveInfo`, `DirectoryEntry`, `ErrorResponse` — exact match to Agent DTO JSON shapes
  - **Theme**: Material You dynamic color on Android 12+ (S+), custom StorageOS light/dark color schemes as fallback
  - **Edge-to-edge**: `enableEdgeToEdge()` for modern Android look
  - **Cleartext traffic**: enabled in manifest for HTTP Agent connection on LAN
  - **No**: authentication, accounts, discovery, pairing, search, transfers, settings, file downloads
  - Dependencies: Compose BOM 2024.12.01, Navigation Compose 2.8.5, Retrofit 2.11.0, OkHttp 4.12.0, kotlinx-serialization 1.7.3, Lifecycle ViewModel Compose 2.8.7

- **Agent network bind (VS-001 prerequisite)**: Allow Agent to accept connections from the LAN
  - Added `bind` field to `ServerConfig` (default: `"127.0.0.1"`, configurable via TOML or CLI)
  - Added `--bind` CLI argument (e.g. `storageos-agent --bind 0.0.0.0`)
  - Config file: `[server] bind = "0.0.0.0"` in config.toml
  - Invalid bind address falls back to 127.0.0.1 with warning log
  - Desktop launch unchanged — default remains localhost-only

### Sprint 06 — Agent Foundation

#### 2026-07-01

- **File Read API (A-011)**: Read-only file access through the Agent — metadata, streaming downloads, thumbnails
  - `GET /file?path=...`: returns file/folder metadata as `DirectoryEntryDto`, runs on `spawn_blocking`, maps CoreError to HTTP status codes (404/403/400/500)
  - `GET /download?path=...`: streams file content via `tokio::fs::File` + `tokio_util::io::ReaderStream` — never loads entire file into memory. Returns Content-Type (via `mime_guess`), Content-Length, Content-Disposition headers
  - `GET /thumbnail?path=...&max_size=256`: generates JPEG thumbnails for supported image formats (jpg, jpeg, png, gif, webp, bmp) on `spawn_blocking`. Configurable `max_size` parameter (default 256). Cache-Control: private, max-age=3600
  - `security.rs`: path validation module — `validate_path()` rejects empty, relative, traversal (`..`), nonexistent paths with proper error kinds; `validate_file_path()` additionally confirms target is a regular file; 5 unit tests
  - `file_service.rs`: `get_file_metadata()` (path validation + `std::fs::metadata` + `get_attributes` → Entry), `prepare_download()` (file validation + mime type), `supports_thumbnail()` (extension check), `generate_thumbnail()` (validation + `image::open` + `thumbnail()` resize + JPEG encode to Vec<u8>)
  - Shared `core_error_to_response()` function replaces inline error mapping — maps `ErrorKind` to HTTP StatusCode + error code string
  - Dependencies added to `services/storageos-agent/Cargo.toml`: `image 0.25` (jpeg/png/gif/webp/bmp features, default-features off), `tokio-util 0.7` (io feature), `mime_guess 2`
  - Desktop NOT migrated to these APIs — continues using Tauri IPC for all file operations
  - All 51 tests passing (41 core + 10 agent). Desktop TypeScript and Rust compile clean.

- **Local Filesystem API Phase 1 (A-010)**: First production Agent API — read-only filesystem endpoints
  - Agent `GET /roots`: returns all storage roots (drives) via `storageos_core::filesystem::list_roots()`, serialized to `LocalDriveInfo`-compatible JSON through `dto::LocalDriveDto`
  - Agent `GET /directory?path=...`: returns directory listing via `storageos_core::filesystem::list_directory()` on `spawn_blocking`, serialized to `DirectoryEntry`-compatible JSON through `dto::DirectoryEntryDto`. Proper HTTP status codes: 404 (NotFound), 403 (PermissionDenied), 400 (InvalidArgument)
  - Agent `dto.rs`: Data Transfer Objects (`LocalDriveDto`, `DirectoryEntryDto`, `ErrorDto`) that convert core `Root`/`Entry` types to exact JSON shapes the Desktop UI expects — zero UI changes needed
  - `AgentClient.fetchRoots()` and `AgentClient.fetchDirectory(path)`: typed HTTP calls with 3s timeout and AbortController
  - `AgentClient.isConnected()`: public state check for fallback logic
  - `getAgentClient()` / `setAgentClientInstance()`: module-level singleton for ExplorerService access
  - `ExplorerService.listDrives()`: tries Agent first, silently falls back to Tauri IPC on any error
  - `ExplorerService.listDirectory()`: tries Agent first, silently falls back to Tauri IPC on any error
  - All other operations (create/rename/delete/copy/move/search) remain on Tauri IPC — no changes
  - No duplicated business logic — Agent and Desktop both call `storageos_core::filesystem::*`
  - Desktop UI unchanged — Explorer loads drives and folders identically whether served by Agent or Tauri IPC
  - Stopping the Agent triggers automatic fallback; restarting reconnects via health polling

- **Desktop ↔ Agent Integration Phase 1 (A-009)**: Connection lifecycle between Desktop and Agent
  - TypeScript `services/agent/AgentClient.ts`: connection state machine (Offline/Starting/Connecting/Connected/Error), health polling (15s interval), auto-launch agent on startup, retry loop (6×1.5s), HTTP timeout (3s), subscriber pattern for state changes
  - TypeScript `services/agent/types.ts`: `AgentConnectionState`, `AgentHealthResponse`, `AgentVersionResponse`, `AgentConnectionInfo` types
  - Zustand store `stores/agent.ts`: reactive connection state, version, uptime, error, health check timestamp
  - Rust `services/agent.rs`: agent binary locator (same-dir, parent-dir search), detached process spawner (Windows: `CREATE_NO_WINDOW | DETACHED_PROCESS` flags, Unix: null stdio)
  - Rust commands `launch_agent` (finds + spawns agent binary, returns `AgentLaunchResult`) and `agent_port` (returns `DEFAULT_AGENT_PORT` from storageos-core constants)
  - TypeScript bridge: `launchAgent()`, `agentPort()` IPC commands, `AgentLaunchResult` type
  - `useAgentConnection` hook: boots AgentClient on app start, wires launcher via Tauri IPC, connects to Zustand store
  - `App.tsx`: `AgentBootstrap` wrapper ensures agent connection initializes before routes render
  - StatusBar: dynamic agent indicator replaces hardcoded "Ready" — color-coded dot (green/pulsing-yellow/red/grey), state label, version display when connected
  - Desktop operates normally without agent — shows "Agent Offline" and all filesystem features continue working
  - No new npm dependencies. 20 IPC commands total (+launch_agent, +agent_port)

- **Standalone StorageOS Agent (A-008)**: First standalone Agent binary at `services/storageos-agent/`
  - New Rust binary crate: `storageos-agent` v0.1.0, consumes `storageos-core` as path dependency
  - No Tauri dependency — compiles and runs independently of the desktop app
  - Configuration: TOML-based (`config.default.toml`), loads from `%LocalAppData%\StorageOS\config.toml`, CLI overrides (`--config`, `--port`), 4 sections (server, logging, database, storage) with sensible defaults, reuses `DEFAULT_AGENT_PORT` (19742) from storageos-core constants
  - Structured logging: `tracing` + `tracing-subscriber` with dual output — human-readable to stderr, JSON to daily-rotated file (`agent.log`), configurable log level
  - SQLite database: `rusqlite` with bundled SQLite, WAL journal mode, `schema_version` table with version tracking, idempotent initialization, graceful close with WAL checkpoint
  - HTTP API: Axum 0.7, binds `127.0.0.1:{port}`, `GET /health` (status, uptime, version, platform), `GET /version` (agent, core, platform)
  - WebSocket: Axum built-in WS support at `/ws`, accepts connections, responds to Ping/Pong, logs connect/disconnect — infrastructure only, no event streams
  - Lifecycle: startup → config → logging → database → provider registration → HTTP/WS server → graceful shutdown (Ctrl+C / SIGTERM), database WAL checkpoint on close
  - Local Storage Provider: registered at startup (log event — connector implementation deferred)
  - Platform paths: `%LocalAppData%\StorageOS\data\` (Windows), `~/.local/share/storageos/` (Linux/macOS)
  - Dependencies: tokio (async runtime), axum 0.7 (HTTP+WS), rusqlite 0.32 (SQLite), tracing + tracing-subscriber + tracing-appender (logging), toml (config), serde + serde_json (serialization)
  - 5 unit tests (3 config, 2 database). `cargo check` clean. Desktop unaffected.

### Sprint 05 — Core Foundation

#### 2026-07-01

- **Search engine migration (A-007)**: Search engine moved from desktop into `storageos_core::search`
  - Created `search/engine.rs`: `search_directory()` with generic progress callback `&dyn Fn(&SearchSnapshot)` — transport-independent, no Tauri dependency. BFS traversal via VecDeque, case-insensitive substring matching, symlink skipping, sorted results (folders first, then case-insensitive alpha), 9 unit tests
  - Updated `search/mod.rs`: sub-module declaration, re-export `search_directory`, `SearchService` trait retained
  - Made `is_hidden()` in `filesystem/directory.rs` `pub(crate)` — search module reuses it, eliminating the duplicate platform-specific implementation from desktop
  - Desktop `services/search.rs`: thin adapter (16 lines) — calls core, maps `Entry` → `DirectoryEntry` via existing `From` impl, `CoreError` → `BridgeError` via existing `From` impl
  - Desktop `commands/search.rs`: progress callback uses `Cell<Instant>` for 250ms throttling (compatible with `&dyn Fn` callback pattern), bridges `SearchSnapshot` (u32) → `SearchProgressPayload` (u64) for TypeScript
  - 41 unit tests all passing (31 existing + 9 new search + 1 existing). Both crates compile clean. No TypeScript/IPC/JSON changes.
- **Transfer engine migration (A-006)**: Transfer engine moved from desktop into `storageos_core::transfer`
  - Created `transfer/controller.rs`: signal registry for pause/resume/cancel — `CONTROLS` HashMap<String, Arc<AtomicU8>>, `register()`, `unregister()`, `set_signal()`, signal constants (`SIGNAL_RUNNING`/`SIGNAL_PAUSED`/`SIGNAL_CANCEL`), 2 unit tests
  - Created `transfer/engine.rs`: `execute_transfer()` with generic progress callback `&dyn Fn(&TransferSnapshot)` — transport-independent, no Tauri dependency. Includes: chunked copy via BufReader/BufWriter (4MB chunks), recursive directory copy, progress/speed/ETA calculation, move optimization (rename first, fall back to copy+delete for cross-volume), disk space validation via `get_free_space()` (Windows cfg-gated), overwrite handling, partial cleanup on cancel/error, 11 unit tests
  - Updated `transfer/mod.rs`: sub-module declarations, re-exports (`execute_transfer`, `calculate_total_size`, `get_free_space`, `set_signal`, signal constants), `TransferService` trait retained
  - Uses `std::sync::LazyLock` instead of `once_cell::sync::Lazy` (Rust 1.80+ stdlib)
  - Uses core constants: `TRANSFER_CHUNK_SIZE` (4MB), `TRANSFER_PROGRESS_INTERVAL_MS` (100ms)
  - Desktop `services/transfer_worker.rs`: thin adapter — keeps `TransferProgressPayload` (camelCase for TypeScript), converts `&str` transfer_type to `TransferType` enum, bridges core callback to `app.emit("transfer:progress", ...)` via `From<&TransferSnapshot>` impl
  - Desktop `commands/transfer.rs`: now uses named signal constants (`SIGNAL_PAUSED`, `SIGNAL_RUNNING`, `SIGNAL_CANCEL`) instead of magic numbers (1, 0, 2)
  - Desktop `once_cell` dependency no longer used by transfer code (kept for other uses)
  - 31 unit tests all passing (18 existing + 13 new). Both crates compile clean. No TypeScript/IPC/JSON changes.
- **Filesystem migration (A-005)**: Business logic moved from desktop `services/` into `storageos_core::filesystem`
  - Created `filesystem/directory.rs`: `list_directory()` → `Vec<Entry>` with sorted output (folders first, case-insensitive alpha), platform-specific `is_hidden()` (#[cfg] gated), 2 unit tests
  - Created `filesystem/operations.rs`: `create_folder()`, `rename_item()`, `delete_item()`, `copy_item()`, `move_item()` → `CoreResult<OperationResult>`, uses `validate_filename()` from utils, recursive `copy_dir_recursive()`, 5 unit tests
  - Created `filesystem/drives.rs`: `list_roots()` → `Vec<Root>` with Windows API drive detection (GetLogicalDriveStringsW, GetDriveTypeW, GetDiskFreeSpaceExW, GetVolumeInformationW), stores `volume_label`/`windows_drive_type`/`drive_letter` in `metadata.custom` for adapter reconstruction
  - Created `filesystem/attributes.rs`: `get_attributes()`, `set_hidden()`, `set_readonly()` → `CoreResult<EntryMetadata>` with Windows GetFileAttributesW/SetFileAttributesW (cfg-gated), Unix `set_readonly` via `PermissionsExt`, `not_supported` error for Unix `set_hidden`
  - Updated `filesystem/mod.rs`: 4 sub-module declarations, re-exports all public functions, `FileSystemService` trait retained
  - Added `windows-sys` v0.59 to storageos-core `Cargo.toml` with `[target.'cfg(windows)'.dependencies]` gating
  - Desktop `services/directory.rs`: thin adapter — calls `storageos_core::filesystem::list_directory()`, maps `Entry` → `DirectoryEntry` via existing `From` impl
  - Desktop `services/drives.rs`: thin adapter — calls `storageos_core::filesystem::list_roots()`, maps `Root` → `LocalDrive` via new `From<Root> for LocalDrive` impl (reconstructs letter/label/drive_type from metadata.custom)
  - Desktop `services/file_attributes.rs`: thin adapter — calls core `get_attributes`/`set_hidden`/`set_readonly`, maps `EntryMetadata` → `FileAttributes` via existing `From` impl
  - Desktop `services/file_operations.rs`: thin adapter — delegates to core, `CoreError` → `BridgeError` via existing `From` impl, `AlreadyExists` error kind now used (was `InvalidArgument`)
  - 18 unit tests all passing (11 existing + 7 new). Both crates compile clean. No TypeScript changes. No IPC changes. No JSON shape changes.
- **Shared utilities migration (A-004)**: Reusable utilities, platform abstraction, and constants in storageos-core
  - Restructured `utils/` into 4 sub-modules:
    - `utils/path.rs`: `parent_path()`, `is_root_path()`, `file_extension()`, `normalize_separators()` — cross-platform path helpers with 6 unit tests
    - `utils/validation.rs`: `is_valid_filename()`, `validate_filename()`, `INVALID_FILENAME_CHARS`, `MAX_FILENAME_LENGTH`, Windows reserved name detection — with 2 unit tests
    - `utils/format.rs`: `format_bytes()`, `format_speed()`, `format_remaining()` — human-readable size/speed/time formatting with 3 unit tests
    - `utils/time.rs`: `epoch_secs()`, `epoch_millis()`, `system_time_to_epoch_secs()` — Unix timestamp helpers
  - Created `platform/mod.rs`: `Platform` enum (Windows/Linux/macOS/Android/iOS) with `current()`, `is_desktop()`, `is_mobile()`, `path_separator()`, `display_name()`
  - Created `config/constants.rs`: centralized magic numbers — `TRANSFER_CHUNK_SIZE` (4MB), `TRANSFER_PROGRESS_INTERVAL_MS` (100), `SEARCH_PROGRESS_INTERVAL_MS` (250), `CLIPBOARD_EXPIRY_SECS` (24h), `HEARTBEAT_INTERVAL_SECS` (30), `APP_NAME`, `APP_IDENTIFIER`, `DEFAULT_AGENT_PORT` (19742)
  - Desktop: replaced inline filename char validation in `file_operations.rs` with `storageos_core::utils::validate_filename()` (also catches reserved names, trailing dots/spaces)
  - Desktop: replaced local `format_bytes()` in `transfer_worker.rs` with `storageos_core::utils::format_bytes()`
  - Desktop: added `From<CoreError> for BridgeError` in `errors/mod.rs` — maps all 10 ErrorKind variants to BridgeErrorCode
  - 11 unit tests all passing. Both crates compile clean. No TypeScript changes. No IPC changes.
  - Updated `crates/storageos-core/README.md`: new module structure, migration phases 1-3 marked complete, trait surfaces updated to canonical names
- **Shared domain model migration (A-003)**: Canonical domain models in storageos-core, desktop wired to consume
  - Created 10 model sub-modules in `crates/storageos-core/src/models/` following `docs/architecture/DomainModel.md`:
    - `entry.rs`: Entry, EntryId, EntryKind (File|Folder), EntryMetadata (flat optional + custom HashMap), EntryRef (cross-device pointer)
    - `root.rs`: Root, RootId, RootKind (7 variants: Drive|Bucket|Library|SharedDrive|Volume|Mount|Container), StorageCapacity, RootMetadata
    - `transfer.rs`: TransferStatus (6 states), TransferType (Copy|Move), TransferSnapshot (point-in-time progress)
    - `clipboard.rs`: ClipboardAction (Copy|Cut), ClipboardEntry, ClipboardEntryId
    - `device.rs`: DeviceId, DeviceKind (6 types), Presence (7 states), TrustLevel (3 states), NetworkKind (4 types)
    - `provider.rs`: ProviderId, ConnectorCapabilities (11 flags), ConnectorStatus (4 states)
    - `notification.rs`: NotificationId, Priority (4 levels), NotificationTarget (AllDevices|Device)
    - `session.rs`: SessionId
    - `permission.rs`: DevicePermissions (13 capabilities with sensible defaults)
    - `common.rs`: AccountId, OperationResult, SearchSnapshot
  - Updated all 6 service trait modules to use canonical model names (Entry, Root, EntryMetadata, TransferSnapshot, EntryRef, ClipboardAction)
  - Removed duplicate `ConnectorCapabilities`/`ConnectorStatus` from providers module — now imported from models
  - Removed duplicate `SearchProgress` from search module — replaced by `SearchSnapshot` from models
  - Added `storageos-core` as path dependency to desktop Cargo.toml
  - Replaced desktop's `OperationResult` definition with re-export from `storageos_core::models::OperationResult`
  - Added `From<Entry> for DirectoryEntry` and reverse conversion in `directory.rs` (TS-compat adapter)
  - Added `From<EntryMetadata> for FileAttributes` and reverse conversion in `file_attributes.rs` (TS-compat adapter)
  - Added `From<LocalDrive> for Root` conversion in `drives.rs` (TS-compat adapter)
  - Both crates compile clean. Desktop app unchanged in behavior — all TypeScript-facing JSON shapes preserved.
- **StorageOS domain model design (A-002.5)**: Canonical DDD domain model for all StorageOS components
  - `docs/architecture/DomainModel.md` — 11-part design document defining the shared vocabulary
  - Part 1 — Core domain objects: Account, Device, Provider, Root, Entry, Transfer, Clipboard, Notification, Session, Permission with ownership relationships
  - Part 2 — Complete hierarchy: Account → Device → Provider → Root → Entry with cross-cutting concerns (Transfer, Clipboard, Notification)
  - Part 3 — Composition over inheritance: EntryKind and RootKind discriminators, flat EntryMetadata with provider-specific optional fields and custom escape hatch
  - Part 4 — Naming review: DirectoryEntry → Entry, LocalDrive → Root, DriveType → RootKind, FileAttributes → EntryMetadata, ClipboardItem → EntryRef, TransferProgress → TransferSnapshot, ClipboardOperation → ClipboardAction. Kept: Account, Device, Provider, Transfer, TransferStatus, TransferType, OperationResult, Notification, CoreError
  - Part 5 — Cross-provider compatibility verified for 12 providers (Windows/Linux/macOS/Android/Google Drive/OneDrive/Dropbox/SharePoint/S3/SMB/FTP/NAS). S3 folder simulation, SharePoint library mapping, Linux mount points, Android scoped storage documented
  - Part 6 — 30+ canonical events: `{domain}.{action}` pattern (entry.*, transfer.*, provider.*, device.*, clipboard.*, search.*, notification.*) with typed payloads
  - Part 7 — Strongly typed identifiers: UUID-based (Account, Device, Transfer, ClipboardEntry, Notification, Session) and String-based (Root, Entry — preserves provider-native IDs). EntryRef as universal cross-boundary pointer
  - Part 8 — Relationship diagrams with cardinality (Account 1→N Device, Device 0→N Provider, Provider 1→N Root, Root 0→N Entry)
  - Part 9 — Future proofing validated against 10 features (cloud sync, offline cache, version history, file sharing, collaboration, AI, virtual providers, encryption, backup, snapshots) — all additive, no structural changes
  - Part 10 — Migration strategy: every existing Rust and TypeScript model mapped to domain model names, rename sequencing aligned with storageos-core migration phases
  - Part 11 — Architecture validation passed: provider-agnostic, device-agnostic, UI-agnostic, platform-agnostic, transport-agnostic, future cloud and enterprise support confirmed
  - Updated Agent.md glossary with Entry, EntryRef, Root, Session terms and added DomainModel.md cross-reference
- **storageos-core crate foundation (A-002)**: Created shared Rust crate at `crates/storageos-core/`
  - 10 modules: errors, models, filesystem, transfer, search, clipboard, providers, events, config, utils
  - Each module has `mod.rs` with documentation of purpose, future ownership (which existing code migrates), and trait definitions
  - Public API traits: `FileSystemService` (8 methods), `TransferService` (7 methods), `SearchService` (1 method), `ClipboardService` (7 methods), `StorageConnector` (8 methods)
  - Shared models: `DirectoryEntry`, `LocalDrive`, `DriveType`, `FileAttributes`, `OperationResult`, `TransferProgress`, `TransferStatus`, `TransferType`, `ClipboardItem`, `ClipboardOperation`
  - `CoreError` with 10 error kinds + `CoreResult<T>` alias — replaces `BridgeError` at the core level
  - `CoreEvent` enum for decoupled internal pub/sub (transfer progress, file changes, provider status)
  - `ConnectorCapabilities` (11 flags) and `ConnectorStatus` for provider abstraction
  - `AppConfig` with port, log level, data/log directory paths
  - Utility functions: `is_valid_filename()`, `parent_path()`, `INVALID_FILENAME_CHARS`
  - Dependency rules documented with directed graph — no circular dependencies allowed
  - README.md: complete module ownership map, dependency rules diagram, public API surface, 9-phase migration plan (create → models → utils → errors → filesystem → transfers → search → desktop integration → Agent integration)
  - External dependencies: serde 1, thiserror 2 only — zero Tauri/platform dependencies
  - Compiles clean (`cargo check` passes). Desktop app unchanged and still compiling.

### Sprint 04 — Explorer Polish

#### 2026-07-01

- **File previews with Rust-side thumbnails (EXP-006)**: Windows Explorer-style file previews
  - Rust `services/thumbnail.rs`: image thumbnail generation using `image` crate — reads full image, resizes with `thumbnail()`, encodes as JPEG, returns base64 data URL. Inline base64 encoder (no external dependency)
  - Rust command `get_thumbnail(path, max_size)` via `commands/thumbnail.rs`, runs on `spawn_blocking` thread pool
  - TypeScript bridge: `getThumbnail(path, maxSize)` IPC command
  - Enabled Tauri v2 asset protocol: `"enable": true` in `app.security.assetProtocol`, `protocol-asset` Cargo feature, CSP set to null, scope `**/*`
  - Added `image` crate v0.25 (jpeg, png, gif, webp, bmp features)
  - Explorer grid view: real image thumbnails via Rust-side generation (not full-resolution asset loading)
  - IntersectionObserver lazy loading: thumbnails generated only when grid items enter viewport (100px margin)
  - Concurrent load limiter: max 3 simultaneous thumbnail generations to avoid CPU overload
  - Thumbnail cache: in-memory Map<string, string> prevents redundant IPC calls
  - CSS `content-visibility: auto` + `containIntrinsicSize` for scroll performance
  - File type detection: 12 categories with color-coded icons (PDF=red, Word=blue, Excel=green, PowerPoint=orange, etc.)
  - `FileIcon` component for details/list views with colored file-page SVG icons and type-specific symbols
  - Video files: lightweight SVG icon with play button overlay (no `<video>` elements)
  - 18 IPC commands total (+get_thumbnail)

- **Hidden files & file attributes (EXP-005)**: Complete hidden/readonly attribute management
  - Rust `services/file_attributes.rs`: get_attributes, set_hidden, set_readonly via Windows GetFileAttributesW/SetFileAttributesW
  - FileAttributes struct: hidden, readonly, system, archive (all bool) with cross-platform stubs
  - Rust commands `get_attributes`, `set_hidden`, `set_readonly` via `commands/file_attributes.rs`
  - TypeScript bridge: FileAttributes type, getAttributes(), setHidden(), setReadonly() IPC commands
  - Explorer store: showHiddenItems + showFileExtensions persisted to localStorage, toggles, Ctrl+H shortcut
  - View dropdown: "Hidden items" and "File name extensions" checkboxes
  - FileArea: filters hidden entries when showHiddenItems is false; strips extensions when showFileExtensions is false
  - Context menu: Hide/Unhide and Set read-only/Remove read-only items (multi-select aware)
  - Properties panel: full implementation with file info (size, dates), attribute chips (Hidden, Read Only, System, Archive), file path
  - Visual indicators: hidden files at 50% opacity (all views), lock badge SVG overlay on read-only files (all 3 view modes)
  - 17 IPC commands total (+get_attributes, +set_hidden, +set_readonly)
- **Keyboard shortcut fix**: Fixed HMR-safe event handler duplication for Ctrl+C/X/V, smarter text input guard, same-directory paste notification
- **Agent architecture (A-001)**: Complete architecture document for the StorageOS Agent
  - `docs/architecture/Agent.md` — 23-section specification covering purpose, responsibilities, technology (Rust/Axum/SQLite/tantivy), process architecture, lifecycle (startup/shutdown/recovery), service mode vs tray mode, connector layer (StorageConnector trait + plugin system), transfer engine (cross-provider streaming, persistence, conflict resolution), search & indexing (tantivy + future semantic search), sync engine (one-way/two-way/mirror), authentication (local API key + OAuth + future mTLS device pairing), event bus, REST+WebSocket API design, logging/monitoring, plugin SDK, security model, migration path from current Tauri IPC architecture, and non-functional targets
- **Agent architecture review & revision (A-001R)**: Senior architecture review, complete rewrite of Agent.md to v2.0
  - Fundamental perspective shift: Agent as the product of a distributed personal storage platform, not a file manager helper process
  - 14 new/expanded sections: Account Architecture, Device Registry (20+ fields), Pairing (ECDH + QR + certificates, no passwords), Discovery (4-layer: cache → mDNS → relay → manual), Communication (Named Pipes/UDS/TCP+TLS/QUIC, MessagePack protocol), StorageOS SDK (Rust core with FFI), Permissions (13 per-device capabilities → future RBAC), Presence (7 states + heartbeat), Clipboard (Agent-owned, cross-device sync), Notifications (first-class with categories/priorities/OS-native), Execution Mode (background user process, not Windows Service), Search (SQLite FTS5 for MVP, tantivy deferred), Plugin Architecture (deferred to Phase 6), Evolution Roadmap (7 phases)
  - Section 29: "Architectural Changes from Revision 1" documenting 14 major changes with rationale
  - Challenged: Windows Service (wrong for MVP), tantivy (premature), plugin system (premature), HTTP-only comms (inefficient for local IPC), no account/pairing/presence/permissions (cannot support multi-device)

### Sprint 00 — Project Setup

#### 2026-06-30

- **Repo structure**: Created monorepo layout (apps, services, connectors, shared, infrastructure, tests)
- **Docs organized**: Moved Vision chapters, PRD docs, SRS docs into proper subdirectories
- **Desktop scaffold**: Created Tauri v2 + React 19 + TypeScript 6 + Vite 8 project in `apps/desktop/`
- **Tailwind CSS v4**: Configured with dark mode theme via CSS custom properties
- **Routing**: React Router v7 with 5 routes (Dashboard, Explorer, Transfers, Devices, Settings)
- **State management**: Zustand stores for theme and sidebar
- **Server state**: TanStack Query provider configured
- **Layout**: AppLayout with Sidebar, TopNav, Content Area, StatusBar
- **AI hub**: Created `.ai/` directory for multi-agent collaboration
- **Design system**: Tokens (colors, spacing, typography, etc.), 8 primitives, 3 state components, 4 domain components
- **Storage contracts**: StorageProvider interface (18 methods), typed errors, events, operations
- **IPC bridge (LS-002)**: Tauri IPC communication layer between React frontend and Rust backend
  - TypeScript: `src/lib/tauri/` — typed invoke wrapper, command definitions, event system, error mapping
  - Rust: `src-tauri/src/` — commands/, core/, errors/, events/ modules
  - 4 commands: health, version, platform, app_directories
  - BridgeError with 6 error codes, serialized across IPC boundary
  - Added `@tauri-apps/api` runtime dependency
- **UI polish (LS-003)**: Professional desktop application layout
  - Enhanced CSS theme: expanded color palette with accent-subtle, accent-text, surface-hover, text-tertiary, toolbar tokens
  - Sidebar: logo icon, SVG nav icons, active indicator bar, hover animations, collapse animation, version footer
  - TopNav: breadcrumb navigation, centered search box, theme toggle, notifications placeholder, profile avatar
  - Explorer: toolbar (back/forward/refresh/new folder/upload/view toggle), Windows-style address bar, professional empty state
  - StatusBar: ready indicator, item count, provider status, theme label
  - Removed Dashboard page, Explorer-first landing experience
  - 4 routes (Explorer, Transfers, Devices, Settings)
- **Explorer layout (LS-004)**: Professional 3-panel file manager
  - Left: NavigationPanel with 6 collapsible sections (Quick Access, Favorites, Local Storage, Cloud Storage, Network, Trash)
  - Center: Toolbar (Navigation | Actions | View | More) + breadcrumb address bar + file area with column headers
  - Right: PropertiesPanel (collapsed by default, "No item selected" placeholder)
  - Resizable panels with drag handles (ResizeHandle component)
  - Explorer Zustand store (viewMode, panel widths, properties toggle)
  - StatusBar: Ready + provider + item count + zoom %
  - 3 view modes: grid, list, details (with column headers)
- **Local drive detection (LS-005)**: First real StorageOS feature
  - Rust `services/drives.rs`: Windows API drive enumeration (GetLogicalDriveStringsW, GetDriveTypeW, GetDiskFreeSpaceExW, GetVolumeInformationW)
  - LocalDrive struct with letter, label, drive_type, total/free/used bytes, file_system, is_removable, is_ready
  - DriveType enum: Fixed, Removable, Network, CdRom, RamDisk, Unknown
  - Cross-platform: returns empty Vec on non-Windows
  - Rust command `list_drives` wired through commands/list_drives.rs → lib.rs
  - TypeScript bridge: LocalDriveInfo, DriveType types + listDrives() command
  - NavigationPanel: fetches drives on mount, renders under "Local Storage" section
  - Drive items show: icon (fixed vs USB), label, letter, filesystem tag, usage bar (color-coded by capacity), free/total text
  - Added `windows-sys` v0.59 dependency (Win32_Storage_FileSystem feature)
- **Directory listing (LS-006A)**: Browse real directory contents
  - Rust `services/directory.rs`: reads directory entries, collects metadata (name, path, size, modified, hidden, readonly, extension)
  - Windows hidden file detection via `FILE_ATTRIBUTE_HIDDEN`, cross-platform fallback (dot-prefix)
  - Sorting: folders first, then case-insensitive alphabetical
  - Error handling: NotFound, InvalidArgument, PermissionDenied → BridgeError
  - Rust command `list_dir` wired through `commands/list_directory.rs` → lib.rs
  - TypeScript bridge: DirectoryEntry type + listDirectory() command
  - ExplorerService abstraction layer — UI components never call Rust directly
  - Explorer store: currentPath, entries, loading, error, navigateTo action
  - NavigationPanel: drive click triggers navigateTo, active drive highlighted with accent color
  - FileArea component with details view (Name, Date Modified, Type, Size columns) and grid view (icon + name tiles)
  - Loading state (spinner), error state (icon + message), empty folder state, welcome state ("Select a drive")
  - File/folder SVG icons (14px for details, 32px for grid), date/size/extension formatters
  - Hidden files shown at 50% opacity
- **Explorer navigation (LS-006B)**: Full filesystem navigation like Windows Explorer
  - Explorer store: historyStack, forwardStack, selectedEntry, openEntry, goBack, goForward, goUp, refresh actions
  - getParentPath utility: extracts parent from Windows paths, stops at drive root (e.g. `C:\`)
  - Toolbar: Back/Forward/Up/Refresh buttons wired to store with correct disabled states
  - Single click selects entry (accent highlight), click background deselects
  - Double click opens folders (navigates into directory), files are no-op
  - Dynamic breadcrumb address bar: parses currentPath into clickable segments
  - Clicking a breadcrumb ancestor navigates there, pushing current path to history
  - History/forward stacks behave exactly like Windows Explorer (Back pushes to forward, Forward pushes to history)
  - goUp navigates to parent, refresh reloads current directory — neither breaks stacks
  - StatusBar: real-time item count, selected item name, loading indicator
- **File operations foundation (LS-007A)**: First write operations for local filesystem
  - Rust `services/file_operations.rs`: create_folder, rename_item, delete_item with OperationResult
  - Input validation: empty names, invalid Windows filename characters, duplicate names
  - Error handling: PermissionDenied, NotFound, InvalidArgument → BridgeError
  - Delete: permanent deletion (documented for future Recycle Bin replacement via IFileOperation)
  - Rust commands `create_folder`, `rename_item`, `delete_item` registered via `commands/file_operations.rs`
  - TypeScript bridge: OperationResult type + createFolder(), renameItem(), deleteItem() commands
  - ExplorerService extended: createFolder(), rename(), delete() methods
  - Explorer store: file operation actions with auto-refresh, UI state for dialogs/context menu
  - New Folder dialog: auto-focused input, loading/error display, keyboard submit
  - Rename dialog: pre-filled name, extension-aware selection (selects name without extension)
  - Delete confirmation: permanent deletion warning, folder content warning
  - Context menu: right-click entry (Open/Rename/Delete), right-click background (New Folder)
  - Toolbar New Folder button wired (disabled when no directory open)
  - Directory auto-refreshes after every successful operation
- **Local filename search (LS-008A)**: Non-blocking filename search in current directory
  - Rust `services/search.rs`: current-directory search, case-insensitive substring matching, reuses DirectoryEntry type
  - Async Rust command via `tauri::async_runtime::spawn_blocking` — UI never blocks
  - TypeScript bridge: searchDirectory() command, ExplorerService extended
  - Explorer store: search state (query, results, loading, error) with generation counter for cancellation
  - TopNav SearchBox: 300ms debounce, small loading spinner in search box, clear button, Escape to clear, never disabled
  - FileArea: keeps directory listing visible while searching; results replace listing only after completion
  - NoResultsState with query text; StatusBar shows result count during search
  - Search box shows "Select a folder to search..." when no directory open (not disabled)
  - Search cleared automatically on navigation; does not change currentPath
- **Recursive search (LS-008B)**: Optional deep search across subfolders with live progress
  - Extended `search_directory()` Rust service with `recursive: bool` parameter, BFS walk via VecDeque
  - Skips symbolic links, ignores inaccessible directories (permission errors silently skipped)
  - Progress callback in service layer; command layer throttles to 250ms via `Instant` tracking
  - Rust emits `search:progress` events with `SearchProgressPayload` (directories_scanned, files_scanned, matches_found)
  - TypeScript event system extended: `SearchProgressPayload` type, `"search:progress"` in `BridgeEventMap`
  - Explorer store: `searchRecursive`, `searchProgress`, `searchDurationMs` state; module-level event listener
  - TopNav: "Search subfolders" checkbox next to search box; toggling re-triggers active search
  - StatusBar: live progress counters during search, completion time after (e.g. "Search completed in 1.4s")
  - Generation counter cancellation works across recursive/non-recursive mode switches
  - Directory listing stays visible until search completes; current-folder search unchanged when unchecked
- **Transfer engine foundation (LS-009A)**: Infrastructure-only transfer queue system
  - `services/transfer/types.ts`: TransferJob, TransferStatus (7 states), TransferType (copy | move)
  - `services/transfer/TransferQueue.ts`: queue with enqueue, dequeue, cancel, pause, resume, clearCompleted, updateProgress, setStatus
  - Subscription pattern: listeners notified on every mutation, status transitions enforced
  - `services/transfer/TransferService.ts`: public API — UI talks only to this service, queue is encapsulated
  - `stores/transfer.ts`: Zustand store subscribing to TransferService changes
  - Transfers page: professional table with 8 columns, grouped sections (Active/Paused/Queued/Finished)
  - Progress bars color-coded by status, action buttons (Pause/Resume/Cancel/Remove), Clear Finished
  - 7 mock jobs seeded for visual verification — no real filesystem operations
  - Utility functions: formatBytes, formatSpeed, formatRemaining (ETA from speed + remaining bytes)
- **Clipboard and copy foundation (LS-009B)**: Copy/Cut/Paste workflow without filesystem operations
  - `services/clipboard/`: ClipboardItem type (providerId, path, type, size, name), ClipboardService with copy/cut/clear/subscribe
  - Provider-agnostic design: `providerId` field supports local and future cloud providers
  - Explorer store: `copyEntries()`, `cutEntries()`, `pasteEntries()` actions; `clipboardCount` reactive state
  - Paste creates queued TransferJobs via TransferService — no actual file copy/move occurs
  - Cut clears clipboard after paste; copy preserves it for repeated paste
  - Context menu: Copy/Cut/Paste on entry right-click; New Folder + Paste on background right-click
  - Paste greyed out when clipboard empty or no directory open
  - ContextMenuItem `disabled` prop for correct enable/disable states
- **Real-time transfer progress (LS-010A)**: Chunked transfer engine replacing blocking `fs::copy()`
  - Rust `services/transfer_worker.rs`: 4MB chunked read/write via BufReader/BufWriter, progress events every 100ms
  - `execute_transfer()`: calculates total size upfront, streams chunks, emits `transfer:progress` events via `app.emit()`
  - Progress payload: transferId, status, bytesTransferred, totalBytes, progress %, speedBytesPerSecond, estimatedRemainingMs, elapsedMs, error
  - Directory support: recursive chunked copy with cumulative progress tracking across all files in tree
  - Move optimization: `fs::rename` first (instant same-volume), chunked copy+delete fallback for cross-volume (ERROR_NOT_SAME_DEVICE = 17)
  - Error recovery: cleans up partial copies on failure, handles edge case "copied but failed to delete source"
  - Rust `commands/transfer.rs`: async `start_transfer` command, spawns worker via `spawn_blocking`, returns immediately (non-blocking)
  - TypeScript bridge: `TransferProgressPayload` type, `transfer:progress` event in BridgeEventMap, `startTransfer()` IPC command
  - TransferStore: event-driven via `onBridgeEvent("transfer:progress")` — updates TransferService on each event, never polls
  - TransferQueue.updateProgress: now accepts totalBytes (Rust reports actual size), auto-transitions queued→running on first progress
  - Explorer store `pasteEntries()`: rewritten as non-blocking — pre-checks conflicts via entries array, creates TransferJob + fire-and-forget `startTransfer()`
  - Explorer auto-refreshes when a transfer targeting the current path completes
  - Transfers page: removed 7 mock jobs, added Elapsed column (9 columns), all data from real transfer events
  - Conflict dialog from LS-009B continues working — pre-check before transfer start
  - 11 IPC commands total (added start_transfer)
