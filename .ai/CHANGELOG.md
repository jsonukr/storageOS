# Changelog

All notable changes to StorageOS, logged after each commit.

## [Unreleased]

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
