# StorageOS Specification v1.0

# Volume 2 – Product Requirements Document

## PRD-006 – Unified Explorer

**Requirement Group:** User Interface & File Navigation

### Purpose
Define the behavior of the primary Explorer interface used to browse every connected storage provider through a single desktop-like experience.

## Objectives

The Unified Explorer shall provide a familiar experience similar to Windows Explorer while remaining provider-agnostic.

## Functional Requirements

### EXP-001 Navigation
- Tree view for folders
- Breadcrumb navigation
- Back, Forward and Up navigation
- Address bar
- Refresh

### EXP-002 Virtual Drives
Every connected provider appears as a virtual drive with:
- Icon
- Name
- Capacity
- Online status
- Provider type

### EXP-003 Views
Support:
- Grid
- List
- Details
- Large Icons
- Gallery (future)

### EXP-004 File Operations
Users can:
- Open
- Preview
- Copy
- Move
- Rename
- Delete
- Restore (Recycle Bin)
- Duplicate
- Download
- Upload

### EXP-005 Drag & Drop
Support dragging files:
- Between folders
- Between providers
- Between devices
- Into upload targets

Conflict options:
- Replace
- Skip
- Keep Both
- Compare

### EXP-006 Context Menu
Show provider-aware actions including:
- Open
- Share
- Copy Path
- Properties
- Version History (if supported)
- Manage Tags
- Pin
- Add to Favorites

### EXP-007 Favorites & Recent
Provide:
- Favorites
- Pinned folders
- Recent files
- Quick Access

### EXP-008 Status Indicators
Display:
- Syncing
- Uploading
- Downloading
- Offline
- Read-only
- Shared
- Encrypted

## User Stories

US-401: As a user, I can browse Google Drive and my local SSD in the same window.

US-402: As a user, I can drag files from a USB drive directly into SharePoint.

## Acceptance Criteria

- Navigation is consistent across providers.
- Unsupported operations are disabled gracefully.
- Explorer reflects provider status in real time.
- Drag-and-drop supports resumable transfers where available.

## Related APIs

- GET /explorer/tree
- GET /explorer/items
- POST /files/copy
- POST /files/move
- POST /files/delete

## Next Chapter

PRD-007 – File Operations & Transfer Engine
