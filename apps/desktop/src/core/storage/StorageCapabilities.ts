/**
 * StorageCapabilities — Declares what a provider can and cannot do.
 *
 * The UI checks capabilities before showing actions. For example,
 * if a provider doesn't support `canSearch`, the search bar is hidden
 * when browsing that provider.
 *
 * Maps to PRD SP-003.
 */

/**
 * Granular capability flags for a storage provider.
 * Each flag defaults to false if not specified.
 */
export interface StorageCapabilities {
  /** Can list directory contents. */
  readonly canListDirectory: boolean;
  /** Can read/download files. */
  readonly canRead: boolean;
  /** Can write/upload files. */
  readonly canWrite: boolean;
  /** Can rename files and folders. */
  readonly canRename: boolean;
  /** Can delete files and folders. */
  readonly canDelete: boolean;
  /** Can move items within the same provider. */
  readonly canMove: boolean;
  /** Can copy items within the same provider. */
  readonly canCopy: boolean;
  /** Can create new folders. */
  readonly canCreateFolder: boolean;
  /** Supports server-side or indexed search. */
  readonly canSearch: boolean;
  /** Can watch for real-time changes (filesystem events, webhooks). */
  readonly canWatchChanges: boolean;
  /** Supports streaming reads (partial content, range requests). */
  readonly canReadStream: boolean;
  /** Supports streaming writes (chunked upload, resumable upload). */
  readonly canWriteStream: boolean;
  /** Supports retrieving thumbnails. */
  readonly canGetThumbnail: boolean;
  /** Supports sharing or public links. */
  readonly canShare: boolean;
  /** Supports file version history. */
  readonly canVersionHistory: boolean;
  /** Supports trash/recycle bin with restore. */
  readonly canTrash: boolean;
  /** Maximum upload size in bytes, if limited. */
  readonly maxUploadBytes?: number;
  /** Maximum path length, if limited. */
  readonly maxPathLength?: number;
  /** Characters not allowed in file names. */
  readonly forbiddenCharacters?: readonly string[];
}
