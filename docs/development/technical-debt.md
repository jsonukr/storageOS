# Technical Debt

> Tracked technical debt items. Each entry has a priority and planned resolution timeline.

---

## Explorer.tsx is a large single file

**Priority:** High

**Description:** `Explorer.tsx` contains FileArea rendering, multiple state components (NoResultsState, EmptyState, WelcomeState, ErrorState), context menu, dialogs, and all view modes in one file.

**Planned Sprint:** Refactor Sprint 01

**Resolution:** Extract into `components/explorer/` — FileArea, FileRow, FileGrid, ContextMenu, dialogs as separate components.

---

## Duplicate formatting utilities

**Priority:** Low

**Description:** Date formatting, file size formatting, and count formatting functions are defined inline in components (Explorer.tsx, StatusBar.tsx) rather than shared.

**Planned Sprint:** Refactor Sprint 01

**Resolution:** Extract to `src/utils/formatters.ts` and import everywhere.

---

## Search metadata duplication

**Priority:** Low

**Description:** `SearchProgressPayload` is defined in both Rust (`events/mod.rs`) and TypeScript (`types.ts`) without generated bindings — changes must be manually synchronized.

**Planned Sprint:** Unscheduled

**Resolution:** Consider `ts-rs` or `specta` crate for auto-generating TypeScript types from Rust structs.

---

## No test coverage

**Priority:** High

**Description:** Zero unit tests, integration tests, or E2E tests exist for either Rust or TypeScript code.

**Planned Sprint:** Testing Sprint

**Resolution:** Add Rust unit tests for services, Vitest for TypeScript logic, and Playwright or WebDriver for E2E.

---

## 5 compiler warnings in Rust

**Priority:** Low

**Description:** Dead code warnings for `BridgeReadyPayload`, `BridgeErrorEventPayload`, `BRIDGE_READY`, `BRIDGE_ERROR`, and `BridgeError::not_found`. These are defined but not yet used by any command.

**Planned Sprint:** Unscheduled

**Resolution:** Will resolve naturally as more features use the event system and error codes.
