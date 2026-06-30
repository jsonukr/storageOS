# Architectural Decision Records

## ADR-001: Monorepo Structure

**Date**: 2026-06-30
**Status**: Accepted
**Context**: Need to manage desktop app, backend services, connectors, and shared libraries.
**Decision**: Single monorepo with `apps/`, `services/`, `connectors/`, `shared/`.
**Rationale**: Simplifies CI/CD, enables cross-cutting changes, shared type definitions.

## ADR-002: Tauri v2 for Desktop

**Date**: 2026-06-30
**Status**: Accepted
**Context**: Need a native desktop shell for the React frontend.
**Decision**: Tauri v2 (Rust backend + web frontend).
**Rationale**: Native performance, small binary (~10MB vs ~150MB Electron), Rust security guarantees, no bundled Chromium.

## ADR-003: .NET 9 Backend API

**Date**: 2026-06-30
**Status**: Accepted
**Context**: Need a backend API for workspace management, auth, metadata.
**Decision**: ASP.NET Core on .NET 9.
**Rationale**: Strong typing, high performance, mature ecosystem, excellent SQLite support via EF Core.

## ADR-004: Tailwind CSS v4 (No UI Libraries)

**Date**: 2026-06-30
**Status**: Accepted
**Context**: Need styling solution for the desktop app.
**Decision**: Tailwind CSS v4 only. No component libraries.
**Rationale**: Full design control, smaller bundle, Figma-to-code alignment, no dependency on third-party component update cycles.

## ADR-005: Zustand over Redux

**Date**: 2026-06-30
**Status**: Accepted
**Context**: Need client-side state management.
**Decision**: Zustand v5.
**Rationale**: Minimal boilerplate, TypeScript-first, no providers needed for stores, tiny bundle size.

## ADR-006: AI Collaboration via .ai/ Directory

**Date**: 2026-06-30
**Status**: Accepted
**Context**: Multiple AI tools (Claude Code, ChatGPT, Figma AI) need to coordinate.
**Decision**: `.ai/` directory with structured files for project state, tasks, and decisions.
**Rationale**: Gives each AI agent clear context, prevents drift, maintains human oversight.

## ADR-007: SQLite for MVP Database

**Date**: 2026-06-30
**Status**: Accepted
**Context**: ARCHITECTURE.md listed both PostgreSQL (server) and SQLite (local), creating inconsistency with PLAYBOOK.md which specifies SQLite only.
**Decision**: SQLite is the sole database for MVP. No PostgreSQL dependency.
**Rationale**: Desktop-first app needs an embedded database with zero server dependencies. SQLite is portable, requires no installation, and is well-supported by EF Core. PostgreSQL may be reconsidered for future server-side features.
