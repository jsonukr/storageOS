/**
 * StorageProvider — The core abstraction that every storage connector
 * must implement.
 *
 * This is the single contract between the UI/application layer and
 * any storage backend. The Explorer, transfer engine, and search
 * all consume this interface — never provider-specific APIs.
 *
 * Providers: Local, Google Drive, OneDrive, SharePoint, Dropbox, etc.
 *
 * Design principles:
 * - Provider-agnostic: UI never sees provider internals
 * - Capability-driven: check capabilities before calling optional methods
 * - Async-first: all I/O operations return Promises
 * - Streamable: upload/download support streaming via ReadableStream
 */

import type { StorageCapabilities } from "./StorageCapabilities";
import type { StorageDrive, ConnectionState, ProviderType } from "./StorageDrive";
import type {
  StorageItem,
  StorageItemId,
  StorageItemPage,
  ListOptions,
  SearchOptions,
} from "./StorageItem";
import type {
  TransferRequest,
  UploadRequest,
  DownloadRequest,
  OperationHandle,
} from "./StorageOperation";
import type { StorageChangeListener, StorageWatcher } from "./StorageEvents";

/**
 * Authentication credentials passed to `authenticate`.
 * Shape varies by provider — each provider defines what it expects.
 */
export type AuthCredentials = Record<string, unknown>;

/**
 * Result of an authentication attempt.
 */
export interface AuthResult {
  /** Whether authentication succeeded. */
  readonly success: boolean;
  /** Error message if authentication failed. */
  readonly error?: string;
  /** When the token expires (ISO-8601). Undefined if no expiry. */
  readonly expiresAt?: string;
}

/**
 * Static metadata about a provider instance.
 * Available before initialization.
 */
export interface ProviderInfo {
  /** Unique provider instance ID (e.g. "google-drive-abc123"). */
  readonly providerId: string;
  /** Human-readable name (e.g. "Google Drive — Work"). */
  readonly providerName: string;
  /** Provider type for icon selection and behavior hints. */
  readonly providerType: ProviderType;
}

/**
 * The main storage provider interface.
 *
 * Every storage connector (Local, Google Drive, OneDrive, SharePoint,
 * Dropbox, future providers) must implement this interface.
 *
 * Methods marked as "Requires capability" should only be called after
 * checking the corresponding flag on `getCapabilities()`.
 */
export interface StorageProvider {
  // ── Identity ──────────────────────────────────────────────────────

  /** Static provider metadata. Always available. */
  readonly info: ProviderInfo;

  /** Current connection state. */
  readonly connectionState: ConnectionState;

  // ── Lifecycle ─────────────────────────────────────────────────────

  /**
   * Initialize the provider. Called once before any other operations.
   * Providers should set up SDK clients, load cached tokens, etc.
   */
  initialize(): Promise<void>;

  /**
   * Authenticate with the storage backend.
   * Optional — local filesystem doesn't need this.
   * @param credentials - Provider-specific authentication data.
   */
  authenticate?(credentials: AuthCredentials): Promise<AuthResult>;

  /**
   * Disconnect and clean up resources.
   * Called when removing or disabling a provider.
   */
  disconnect(): Promise<void>;

  // ── Capabilities ──────────────────────────────────────────────────

  /**
   * Declare what this provider supports.
   * The UI calls this to show/hide actions.
   */
  getCapabilities(): StorageCapabilities;

  // ── Drives ────────────────────────────────────────────────────────

  /**
   * List all drives/volumes exposed by this provider.
   * - Local: C:\, D:\, USB drives
   * - Google Drive: "My Drive", shared drives
   * - OneDrive: personal drive
   * - SharePoint: document libraries
   * - Dropbox: root namespace
   */
  listDrives(): Promise<readonly StorageDrive[]>;

  // ── Browsing ──────────────────────────────────────────────────────

  /**
   * List contents of a directory.
   * @param folderId - The folder to list. Use drive's rootItemId for root.
   * @param options - Pagination, sorting, filtering options.
   */
  listDirectory(
    folderId: StorageItemId,
    options?: ListOptions,
  ): Promise<StorageItemPage>;

  /**
   * Get a single item by its ID.
   * @param itemId - The item to retrieve.
   */
  getItem(itemId: StorageItemId): Promise<StorageItem>;

  // ── Search ────────────────────────────────────────────────────────

  /**
   * Search for items matching a query.
   * Requires capability: `canSearch`.
   * @param options - Search query and filters.
   */
  search?(options: SearchOptions): Promise<StorageItemPage>;

  // ── Mutations ─────────────────────────────────────────────────────

  /**
   * Create a new folder.
   * Requires capability: `canCreateFolder`.
   * @param parentId - Parent folder.
   * @param name - New folder name.
   * @returns The created folder item.
   */
  createFolder?(
    parentId: StorageItemId,
    name: string,
  ): Promise<StorageItem>;

  /**
   * Rename a file or folder.
   * Requires capability: `canRename`.
   * @param itemId - Item to rename.
   * @param newName - New name.
   * @returns The renamed item.
   */
  rename?(
    itemId: StorageItemId,
    newName: string,
  ): Promise<StorageItem>;

  /**
   * Delete a file or folder.
   * Requires capability: `canDelete`.
   * @param itemId - Item to delete.
   * @param permanent - Skip trash if true.
   */
  delete?(
    itemId: StorageItemId,
    permanent?: boolean,
  ): Promise<void>;

  // ── Transfers ─────────────────────────────────────────────────────

  /**
   * Copy an item to a destination folder.
   * Requires capability: `canCopy`.
   * @param request - Copy parameters.
   * @returns Handle for tracking progress and cancellation.
   */
  copy?(request: TransferRequest): Promise<OperationHandle>;

  /**
   * Move an item to a destination folder.
   * Requires capability: `canMove`.
   * @param request - Move parameters.
   * @returns Handle for tracking progress and cancellation.
   */
  move?(request: TransferRequest): Promise<OperationHandle>;

  /**
   * Upload a file to the provider.
   * Requires capability: `canWrite`.
   * @param request - Upload parameters.
   * @param stream - File content as a ReadableStream.
   * @returns Handle for tracking progress and cancellation.
   */
  upload?(
    request: UploadRequest,
    stream: ReadableStream<Uint8Array>,
  ): Promise<OperationHandle>;

  /**
   * Download a file from the provider.
   * Requires capability: `canRead`.
   * @param request - Download parameters.
   * @returns Handle for tracking progress and cancellation.
   */
  download?(request: DownloadRequest): Promise<OperationHandle>;

  // ── Streaming ─────────────────────────────────────────────────────

  /**
   * Open a readable stream for a file.
   * Requires capability: `canReadStream`.
   * @param itemId - File to read.
   * @param offset - Byte offset to start from.
   * @param length - Number of bytes to read. Undefined = read to end.
   */
  readStream?(
    itemId: StorageItemId,
    offset?: number,
    length?: number,
  ): Promise<ReadableStream<Uint8Array>>;

  /**
   * Open a writable stream for a file.
   * Requires capability: `canWriteStream`.
   * @param request - Upload parameters (destination, name, conflict strategy).
   */
  writeStream?(
    request: UploadRequest,
  ): Promise<WritableStream<Uint8Array>>;

  // ── Watching ──────────────────────────────────────────────────────

  /**
   * Watch a folder for real-time changes.
   * Requires capability: `canWatchChanges`.
   * @param folderId - Folder to watch.
   * @param listener - Callback invoked on each change.
   * @returns A watcher handle to stop watching.
   */
  watchChanges?(
    folderId: StorageItemId,
    listener: StorageChangeListener,
  ): Promise<StorageWatcher>;
}
