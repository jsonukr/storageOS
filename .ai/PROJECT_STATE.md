# Project State

> Single source of truth. Updated by Claude Code after every completed task.

## Overview

- **Project**: StorageOS — unified storage virtualization platform
- **Phase**: Sprint 00 (Project Setup)
- **Status**: Desktop app compiling and running (Tauri + Rust + React)

## Repository Structure

```
StorageOS/
├── .ai/                    ← AI collaboration hub (this directory)
├── .claude/                ← Claude Code settings
├── .github/                ← GitHub workflows (empty)
├── apps/
│   └── desktop/            ← Tauri v2 + React + TypeScript + Vite
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
│   └── agent/
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
- **State**: Zustand (theme store, sidebar store, explorer store)
- **Data**: TanStack Query (configured, no queries yet)
- **Routing**: React Router v7 (4 routes — Explorer-first)
- **Layout**: Sidebar (icons, logo, collapse, version) + TopNav (breadcrumbs, search, notifications, profile) + Content + StatusBar
- **Dark mode**: Enhanced CSS palette, toggleable via Zustand store
- **Pages**: Explorer (3-panel layout: nav panel + file area + properties), Transfers, Devices, Settings
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

## What Does NOT Exist

- [x] Rust toolchain (rustc 1.96.0, cargo 1.96.0 stable)
- [ ] Docker Desktop
- [ ] GitHub CLI
- [ ] Any business logic
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

## Last Updated

LS-007A — File operations foundation implemented and verified (2026-06-30)
