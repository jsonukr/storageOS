# Architecture

> Human-owned. Claude Code must not modify without explicit approval.

## Tech Stack

### Desktop Client
| Layer | Technology | Version |
|-------|-----------|---------|
| Shell | Tauri | v2 |
| UI Framework | React | 19 |
| Language | TypeScript | 6 |
| Bundler | Vite | 8 |
| Styling | Tailwind CSS | v4 |
| Routing | React Router | v7 |
| State | Zustand | v5 |
| Server State | TanStack Query | v5 |

### Backend (Future)
| Layer | Technology | Version |
|-------|-----------|---------|
| API | ASP.NET Core | .NET 9 |
| Database | SQLite | — |
| Real-time | SignalR | — |
| Containers | Docker | — |

### Forbidden
- No additional UI component libraries (no shadcn, no MUI, no Chakra)
- No CSS-in-JS (no styled-components, no Emotion)
- No Redux, no MobX
- No Next.js, no Remix
- No Electron

## System Boundaries

```
┌─────────────────────────────────────────────┐
│                Desktop Client               │
│  ┌────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Tauri  │ │  React   │ │  Tailwind    │  │
│  │  (Rust) │ │  + TS    │ │  CSS v4      │  │
│  └────┬───┘ └────┬─────┘ └──────────────┘  │
│       │          │                          │
│       │    ┌─────┴──────┐                   │
│       │    │  Zustand   │                   │
│       │    │  TanStack  │                   │
│       │    │  Query     │                   │
│       │    └─────┬──────┘                   │
│       │          │                          │
│  ┌────┴──────────┴────┐                     │
│  │   IPC / HTTP       │                     │
│  └────────┬───────────┘                     │
└───────────┼─────────────────────────────────┘
            │
            v
┌───────────────────────┐
│   Backend Services    │
│   (.NET 9 API)        │
│   SQLite              │
│   Storage Agent       │
└───────────────────────┘
```

## Connector Architecture

```
┌────────────┐
│ Connector  │──── Local filesystem
│ SDK        │──── Google Drive
│ Interface  │──── Microsoft (OneDrive/SharePoint)
│            │──── Dropbox
└────────────┘
```

Each connector implements a standardized interface. No connector-specific logic leaks into the UI or API layers.

## Key Principles

1. Desktop-first (not web-first)
2. Connector-first architecture
3. Event-driven synchronization
4. Domain-Driven Design with bounded contexts
5. CQRS where appropriate
6. Offline-capable where possible
7. Zero-trust security
