# StorageOS Project Memory

> Living document updated after every sprint. Captures what we built, decisions made, known issues, technical debt, and next priorities.

---

## Sprint History

### Sprint 00 — Project Setup (Current)

**What we built:**
- Established repository folder structure
- Set up Claude Code integration
- Created documentation framework (Vision, PRD, SRS organized)

**Key architectural decisions:**
- Monorepo structure with `apps/`, `services/`, `connectors/`, `shared/`
- Desktop-first via Tauri (Rust + web frontend)
- .NET 9 backend API, SQLite database (MVP)
- Event-driven architecture with bounded contexts

**Known issues:**
- Docker Desktop not yet installed
- Rust toolchain not yet installed (required for Tauri)
- GitHub CLI not yet installed
- SQLite selected for MVP (no server dependency)

**Technical debt:**
- None yet

**Next priorities:**
- Install missing prerequisites (Docker, Rust, GitHub CLI)
- Initialize git remote and push
- Begin Sprint 01 planning

---

## Cumulative Decisions Log

| # | Decision | Rationale | Sprint |
|---|----------|-----------|--------|
| 1 | Monorepo structure | Single repo for all components simplifies CI/CD and cross-cutting changes | 00 |
| 2 | Tauri for desktop | Native performance, small binary size, Rust security | 00 |
| 3 | .NET 9 API | Strong typing, performance, ecosystem maturity | 00 |

## Cumulative Technical Debt

| # | Item | Severity | Introduced | Resolved |
|---|------|----------|------------|----------|
| — | No debt yet | — | — | — |
