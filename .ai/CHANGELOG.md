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
