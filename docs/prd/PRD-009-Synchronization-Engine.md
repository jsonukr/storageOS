# StorageOS Specification v1.0

# Volume 2 – Product Requirements Document

## PRD-009 – Synchronization Engine

**Requirement Group:** Synchronization

### Purpose
Define how StorageOS synchronizes files and folders between devices and storage providers.

## Synchronization Modes

### SYNC-001 One-Way Sync
Changes flow from Source → Destination only.

### SYNC-002 Two-Way Sync
Changes made on either side are synchronized while preserving metadata where possible.

### SYNC-003 Mirror Mode
Destination becomes an exact copy of the source. Deleted source files are removed from the destination after confirmation or policy evaluation.

## Functional Requirements

### SYNC-004 Folder Pair Management
Users can create, edit, pause, resume and delete synchronization jobs.

### SYNC-005 Conflict Detection
Detect simultaneous modifications using timestamps, hashes and provider metadata.

Conflict options:
- Keep Newest
- Keep Both
- Manual Resolution
- Always Prefer Source
- Always Prefer Destination

### SYNC-006 Offline Synchronization
Queue changes while a provider is offline and synchronize automatically when connectivity returns.

### SYNC-007 Scheduling
Support:
- Real-time
- Hourly
- Daily
- Weekly
- Manual

### SYNC-008 Versioning
Where supported, maintain previous versions or integrate with provider version history.

### SYNC-009 Retry Policy
Retry transient failures using configurable exponential backoff.

### SYNC-010 Status
States:
- Idle
- Syncing
- Paused
- Completed
- Failed
- Waiting

## User Stories

US-701: Synchronize my Documents folder with Google Drive in real time.

US-702: Mirror a local backup to my NAS every night.

## Acceptance Criteria

- Sync resumes after interruptions.
- Conflicts are never resolved silently unless configured.
- Failed jobs remain retryable.
- Users can view synchronization history.

## Related APIs

POST /sync/jobs
GET /sync/jobs
PATCH /sync/jobs/{id}
DELETE /sync/jobs/{id}
GET /sync/history

## Next Chapter

PRD-010 – Notifications & Activity Timeline
