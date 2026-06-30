# StorageOS Specification v1.0

# Volume 3 – Software Requirements Specification (SRS)

## SRS-001 – System Architecture Overview

**Document ID:** SRS-001
**Version:** 1.0 Draft

## Purpose

Define the high-level architecture of StorageOS, its major components, responsibilities and communication patterns.

## Architectural Goals

- Modular and extensible
- Connector-first design
- Cross-platform support
- Secure by default
- Event-driven synchronization
- Offline-capable where possible

## Core Components

### 1. Desktop Client
Responsibilities:
- Explorer UI
- Dashboard
- Search
- Transfer Manager
- Settings

### 2. Storage Agent
Responsibilities:
- File system monitoring
- Local indexing
- Device registration
- Event publishing
- File operations

### 3. Backend Services
Responsibilities:
- Authentication
- Workspace management
- Metadata
- Notifications
- Audit logging
- Policy management

### 4. Connector Layer
Provides a unified abstraction for:
- Local storage
- Cloud providers
- Network shares
- Enterprise repositories

### 5. Database Layer
Stores:
- Users
- Workspaces
- Metadata
- Permissions
- Audit logs
- Connector configuration

## Communication

- HTTPS for client ↔ backend
- SignalR/WebSockets for real-time updates
- Local IPC between Desktop Client and Storage Agent
- Provider APIs through connector implementations

## Non-Functional Requirements

- Horizontal scalability
- Fault isolation
- Dependency injection
- Structured logging
- Observability
- Secure secret storage

## Technology Stack

- React + TypeScript
- Tauri (Desktop)
- ASP.NET Core
- SQLite (local)
- PostgreSQL (server)
- SignalR
- Docker
- OpenTelemetry

## Next Chapter

SRS-002 – Domain Model & Bounded Contexts
