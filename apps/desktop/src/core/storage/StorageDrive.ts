/**
 * StorageDrive — Represents a virtual drive or volume exposed by a provider.
 *
 * Each provider exposes one or more drives:
 * - Local: C:\, D:\, USB drives
 * - Google Drive: "My Drive", shared drives
 * - OneDrive: personal drive, shared libraries
 * - SharePoint: document libraries
 * - Dropbox: root namespace
 */

import type { StorageItemId } from "./StorageItem";

/** The kind of storage provider. Used for icon selection and behavior hints. */
export type ProviderType =
  | "local"
  | "google-drive"
  | "onedrive"
  | "sharepoint"
  | "dropbox"
  | "smb"
  | "sftp"
  | "ftp"
  | "webdav"
  | "s3"
  | "azure-blob";

/** Connection state of a provider or drive. Maps to PRD SP-004. */
export type ConnectionState =
  | "connected"
  | "syncing"
  | "offline"
  | "authentication_required"
  | "error"
  | "disabled";

/**
 * Storage capacity information for a drive.
 * All sizes are in bytes. Fields are optional because not all
 * providers expose quota information.
 */
export interface StorageQuota {
  /** Total capacity in bytes. */
  readonly totalBytes?: number;
  /** Used space in bytes. */
  readonly usedBytes?: number;
  /** Available space in bytes. */
  readonly availableBytes?: number;
}

/**
 * A virtual drive exposed by a storage provider.
 * The Explorer renders these as top-level entries in the sidebar/drive list.
 */
export interface StorageDrive {
  /** Unique drive identifier within the provider. */
  readonly id: string;
  /** Provider that owns this drive. */
  readonly providerId: string;
  /** Human-readable drive name (e.g. "My Drive", "C:"). */
  readonly name: string;
  /** Provider type for icon/behavior hints. */
  readonly providerType: ProviderType;
  /** Current connection state. */
  readonly state: ConnectionState;
  /** Root item ID — the entry point for browsing this drive. */
  readonly rootItemId: StorageItemId;
  /** Storage quota, if available. */
  readonly quota?: StorageQuota;
  /** Drive icon URL or identifier. */
  readonly iconUrl?: string;
  /** ISO-8601 timestamp of last successful sync. */
  readonly lastSyncAt?: string;
}
