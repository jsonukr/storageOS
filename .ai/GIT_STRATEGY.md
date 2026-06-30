# Git Branch Strategy

> Operational reference for the branching model defined in PLAYBOOK.md.

## Branches

| Branch | Purpose | Merges Into |
|--------|---------|-------------|
| `main` | Production-ready releases only | — |
| `develop` | Integration branch for completed features | `main` (via PR) |
| `feature/task-xxx` | Individual task implementation | `develop` (via PR) |
| `bugfix/task-xxx` | Bug fixes | `develop` (via PR) |

## Rules

1. `main` is protected. No direct commits.
2. `develop` is the working integration branch. All feature branches merge here.
3. Feature branches are created from `develop`.
4. Every merge into `develop` requires review (ChatGPT or human).
5. `main` is updated only for releases, merged from `develop` via PR.

## Branch Lifecycle

```
main ─────────────────────────────────────── (releases only)
  │
  └── develop ────────────────────────────── (integration)
        │
        ├── feature/task-001 ──→ PR → develop
        ├── feature/task-002 ──→ PR → develop
        └── bugfix/task-003  ──→ PR → develop
```

## Setup Sequence

1. Create initial commit on `main`
2. Create `develop` from `main`
3. All work branches from `develop`
4. Current `feature/playbook` branch should be rebased onto `develop` once established

## Commit Format

```
type(scope): description

Types: feat, fix, refactor, docs, test, chore
Scope: module or area affected
```
