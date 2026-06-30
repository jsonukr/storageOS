# StorageOS Specification v1.0

# Volume 2 – Product Requirements Document

## PRD-016 – Audit Logging

**Requirement Group:** Audit & Compliance

### Purpose
Define immutable audit logging requirements for security, compliance, troubleshooting and operational visibility.

## Functional Requirements

### AUD-001 Logged Events
Audit the following:
- User login/logout
- Failed authentication
- MFA changes
- Workspace creation/deletion
- Role assignments
- Storage provider connections
- File operations (where applicable)
- Administrative actions
- Policy changes

### AUD-002 Audit Record Fields
Each record includes:
- Audit ID
- Timestamp (UTC)
- User ID
- Workspace ID
- Device ID
- Action
- Target resource
- Result (Success/Failure)
- Source IP (where applicable)

### AUD-003 Immutability
Audit records cannot be edited or deleted by standard users.

### AUD-004 Search & Filtering
Support filtering by:
- Date
- User
- Workspace
- Device
- Action
- Result

### AUD-005 Export
Administrators may export audit logs in CSV or JSON formats (future: PDF).

### AUD-006 Retention
Retention policies are configurable by workspace or organization.

## User Stories

US-1401: Review who deleted a shared folder.

US-1402: Export login history for compliance review.

## Acceptance Criteria

- Every privileged action generates an audit record.
- Audit timestamps use UTC.
- Export respects permissions.
- Audit data remains tamper-evident.

## Related APIs

GET /audit
GET /audit/{id}
POST /audit/export

## Next Chapter

PRD-017 – Permissions & RBAC
