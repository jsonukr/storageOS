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
- **State**: Zustand (theme store, sidebar store)
- **Data**: TanStack Query (configured, no queries yet)
- **Routing**: React Router v7 (5 routes)
- **Layout**: Sidebar + TopNav + Content Area + StatusBar
- **Dark mode**: CSS custom properties, toggleable via Zustand store
- **Pages**: Dashboard, Explorer, Transfers, Devices, Settings (placeholders)
- **Frontend build**: Compiles successfully (tsc + vite build)
- **Tauri build**: Blocked — Rust toolchain not installed

## What Exists

- [x] Monorepo folder structure
- [x] Documentation organized (vision, prd, srs)
- [x] Desktop frontend scaffolded and compiling
- [x] Tailwind CSS v4 configured with dark mode theme
- [x] React Router with 5 placeholder pages
- [x] Zustand stores (theme, sidebar)
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

## What Does NOT Exist

- [ ] Rust toolchain (cannot compile Tauri)
- [ ] Docker Desktop
- [ ] GitHub CLI
- [ ] Any backend code
- [ ] Any business logic
- [ ] Any API integration
- [ ] Any authentication
- [ ] Any database
- [ ] Any tests
- [ ] Any CI/CD
- [ ] Git remote / GitHub repo

## Dependencies (apps/desktop)

### Runtime
- react 19.2.7
- react-dom 19.2.7
- react-router-dom 7.18.1
- zustand 5.0.14
- @tanstack/react-query 5.101.2

### Dev
- tailwindcss 4.3.2
- @tailwindcss/vite 4.3.2
- typescript 6.0.2
- vite 8.1.0
- @vitejs/plugin-react 6.0.2
- @tauri-apps/cli (Tauri CLI)

## Last Updated

TASK-101 — Design system foundation complete (2026-06-30)
