# Claude Code Instructions

> Read this file before every task.

## Project

StorageOS — unified storage virtualization platform.
Desktop-first via Tauri v2 (Rust + React + TypeScript).
MVP targets Windows only.

## Before Starting Any Task

1. Read `.ai/CURRENT_TASK.md`
2. Read `.ai/PROJECT_STATE.md`
3. Read relevant docs in `docs/`

## After Completing Any Task

1. Update `.ai/PROJECT_STATE.md`
2. Append to `.ai/CHANGELOG.md`
3. Perform self review

## Rules

- Do NOT change architecture without human approval
- Do NOT add frameworks or unnecessary dependencies
- Do NOT rename project structure
- Do NOT skip self review
- Do NOT place AI workflow files in `docs/` — use `.ai/` only
- If architecture changes are required, stop and ask

## Tech Stack (MVP)

- Desktop: Tauri v2, React 19, TypeScript 6, Vite 8
- Styling: Tailwind CSS v4 (no component libraries)
- State: Zustand v5
- Server State: TanStack Query v5
- Routing: React Router v7
- Database: SQLite (local, embedded)
- Backend: ASP.NET Core .NET 9 (future)

## Code Standards

- Strict TypeScript
- No hardcoded values
- No unused imports
- No commented dead code
- No console.log in production
- Reusable components
- Meaningful names

## Git Conventions

- Branch: `feature/task-xxx` or `bugfix/task-xxx` from `develop`
- Commit: `feat(module): description`, `fix(module): description`, `docs(module): description`
- Never commit to `main` directly

## Key Files

| File | Purpose |
|------|---------|
| `.ai/PROJECT_STATE.md` | Current project state (update after every task) |
| `.ai/CURRENT_SPRINT.md` | Active sprint tasks |
| `.ai/CURRENT_TASK.md` | Task to work on now |
| `.ai/PLAYBOOK.md` | Development workflow (frozen) |
| `.ai/ARCHITECTURE.md` | Tech stack and system boundaries |
| `.ai/DECISIONS.md` | Architectural decision records |
| `.ai/CHANGELOG.md` | Chronological change log |
| `.ai/PROJECT_MEMORY.md` | Cumulative decisions and sprint history |

# UI Design Standard (Mandatory)

StorageOS is a native desktop application.

The UI MUST follow Windows 11 design language.

Do NOT invent custom layouts or visual styles.

Always prefer Windows 11 UX patterns unless explicitly instructed otherwise.

## Visual Style

- Windows 11 File Explorer
- Windows 11 Settings
- Windows 11 Context Menus
- Windows 11 Dialogs
- Windows 11 Progress Windows

## Design Principles

- Fluent Design
- Rounded corners (8px)
- Acrylic / Mica where appropriate
- Soft shadows
- Proper spacing
- Native Windows typography
- Native iconography style
- Consistent hover/focus/pressed states
- Smooth animations (150–250ms)

## Components

When implementing any UI, first ask:

"What would Windows 11 Explorer do?"

Examples:

- Explorer toolbar
- Breadcrumb bar
- Address bar
- Context menu
- Dialogs
- Progress windows
- File list
- Selection
- Properties panel
- Transfer queue

should closely resemble Windows 11 Explorer.

## Never

- Invent dashboard-like layouts.
- Use mobile-inspired cards where Windows uses lists.
- Replace Explorer paradigms with web app paradigms.
- Create custom controls if Windows already has an established interaction.

## Rule

Behavior first.
Windows UX second.
Custom branding third.

StorageOS should feel like a native Windows application, not a website running inside a desktop shell.