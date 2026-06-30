# StorageOS Specification v1.0

# Volume 2 – Product Requirements Document

## PRD-014 – Settings & Preferences

**Requirement Group:** User Preferences & Configuration

### Purpose
Define configurable settings for users, workspaces and administrators.

## User Preferences

### SET-001 Appearance
- Light theme
- Dark theme
- System theme
- Accent color (future)

### SET-002 Explorer
- Default view (Grid/List/Details)
- Default sort order
- Hidden files
- File extensions
- Preview pane
- Startup location

### SET-003 Notifications
- Enable/disable categories
- Quiet hours
- Email notifications
- Desktop notifications

### SET-004 Transfers
- Default conflict behavior
- Concurrent transfer limit
- Bandwidth limits
- Retry policy

### SET-005 Search
- Indexing locations
- Excluded folders
- Search history
- AI search toggle

### SET-006 Privacy
- Telemetry consent
- Crash reporting
- Diagnostic logs
- Local cache size

### Workspace Settings
- Default storage provider
- Quotas
- Naming conventions
- Shared folder defaults

### Administration Settings
- Password policy
- MFA enforcement
- Session timeout
- Device approval
- Retention policy

## User Stories

US-1201: Configure StorageOS to always open in Details view.

US-1202: Disable notifications outside business hours.

## Acceptance Criteria

- Settings sync across user devices where applicable.
- Workspace settings override personal settings when required.
- Changes apply without restarting unless explicitly stated.

## Related APIs

GET /settings
PATCH /settings
GET /workspace/settings
PATCH /workspace/settings

## Next Chapter

PRD-015 – Error Handling & Recovery
