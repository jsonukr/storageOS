# Project State

> Single source of truth. Updated by Claude Code after every completed task.

## Overview

- **Project**: StorageOS — unified storage virtualization platform
- **Phase**: Sprint 00 (Project Setup)
- **Status**: Desktop app scaffolded, not yet compilable as Tauri (Rust missing)

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
- **Tauri build**: Blocked — Rust toolchain not installed

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
  - 4 IPC commands: health(), version(), platform(), app_directories()
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

## What Does NOT Exist

- [ ] Rust toolchain (cannot compile Tauri)
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

LS-004 — Professional Explorer layout complete (2026-06-30)
