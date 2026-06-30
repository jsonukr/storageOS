# StorageOS Specification v1.0

# Volume 2 – Product Requirements Document

## PRD-007 – File Operations & Transfer Engine

**Requirement Group:** File Operations

### Purpose
Define how StorageOS performs reliable file operations across local, remote and cloud storage providers.

## Supported Operations

- Copy
- Move
- Rename
- Delete
- Restore
- Upload
- Download
- Duplicate
- Create Folder
- Create File (provider permitting)

## Transfer Engine Requirements

### FT-001 Transfer Queue
All transfers execute through a centralized queue supporting:
- Pause
- Resume
- Cancel
- Retry
- Priority ordering

### FT-002 Conflict Resolution
When a destination already contains a file:
- Replace
- Skip
- Keep Both
- Compare metadata

### FT-003 Integrity Verification
Where supported, verify transfers using checksums (MD5/SHA-256/provider checksum).

### FT-004 Progress Tracking
Display:
- Current file
- Overall progress
- Speed
- Estimated remaining time
- Completed / Failed items

### FT-005 Failure Handling
Recover gracefully from:
- Network interruptions
- Provider timeouts
- Permission errors
- Disk full
- File locks

Failed transfers remain in history and may be retried.

### FT-006 Cross-Provider Transfers
Support transfers between any compatible providers through the connector abstraction.

## User Stories

US-501: Drag a folder from Google Drive to a NAS.

US-502: Pause a large transfer and resume it later.

US-503: Review failed transfers and retry only failed items.

## Acceptance Criteria

- Queue survives application restart.
- Multiple transfers execute safely.
- Integrity verification reports failures.
- User can cancel individual or all transfers.

## Related APIs

POST /transfers
GET /transfers
PATCH /transfers/{id}
DELETE /transfers/{id}

## Next Chapter

PRD-008 – Search & Indexing
