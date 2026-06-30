# StorageOS Specification v1.0

# Volume 2 – Product Requirements Document

## PRD-017 – Permissions & Role-Based Access Control (RBAC)

**Requirement Group:** Authorization

### Purpose
Define the authorization model used to control access to every resource within StorageOS.

## Role Hierarchy

1. System Administrator
2. Organization Administrator
3. Workspace Owner
4. Workspace Administrator
5. Member
6. Viewer
7. Guest (limited)

## Permission Categories

### Identity
- Manage users
- Invite users
- Disable users
- Reset MFA

### Workspace
- Create
- Update
- Delete
- Transfer ownership

### Storage
- Connect providers
- Disconnect providers
- Browse
- Upload
- Download
- Delete
- Share

### Administration
- View audit logs
- Manage policies
- Manage licenses
- View monitoring

## Authorization Rules

- Permissions are evaluated using least-privilege.
- Deny rules override allow rules.
- Workspace permissions do not grant organization-level permissions.
- Resource owners may delegate access where permitted.

## Resource Scope

Permissions can apply to:
- Organization
- Workspace
- Device
- Storage Provider
- Folder
- File
- Connector

## User Stories

US-1501: Allow a Viewer to browse files but prevent uploads.

US-1502: Allow Workspace Admins to manage members without organization-wide access.

## Acceptance Criteria

- Unauthorized actions return access denied.
- Permission changes take effect immediately.
- Every authorization decision is auditable.

## Related APIs

GET /roles
GET /permissions
PATCH /members/{id}/role

## Next Chapter

PRD-018 – Accessibility
