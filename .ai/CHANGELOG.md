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
