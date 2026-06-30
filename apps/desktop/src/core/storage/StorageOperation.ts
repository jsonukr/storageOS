/**
 * StorageOperation — Types for file operations (copy, move, upload, download).
 *
 * Operations can be long-running and support progress tracking,
 * pause/resume, and cancellation.
 */

import type { StorageItemId } from "./StorageItem";

/** The kind of file operation. */
export type OperationType =
  | "copy"
  | "move"
  | "upload"
  | "download"
  | "delete";

/** Current state of an operation. */
export type OperationState =
  | "pending"
  | "in_progress"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Progress information for a running operation.
 */
export interface OperationProgress {
  /** Bytes transferred so far. */
  readonly bytesTransferred: number;
  /** Total bytes to transfer. Undefined if unknown. */
  readonly totalBytes?: number;
  /** Percentage complete (0–100). Undefined if totalBytes is unknown. */
  readonly percent?: number;
  /** Current transfer speed in bytes per second. */
  readonly bytesPerSecond?: number;
  /** Estimated time remaining in milliseconds. */
  readonly estimatedRemainingMs?: number;
  /** Number of items completed (for batch operations). */
  readonly itemsCompleted?: number;
  /** Total items in the batch. */
  readonly itemsTotal?: number;
}

/**
 * Callback for operation progress updates.
 */
export type OperationProgressListener = (progress: OperationProgress) => void;

/**
 * Request to copy or move an item.
 */
export interface TransferRequest {
  /** Source item to copy/move. */
  readonly source: StorageItemId;
  /** Destination folder. */
  readonly destinationFolder: StorageItemId;
  /** New name at destination. If omitted, keeps original name. */
  readonly newName?: string;
  /** What to do if an item with the same name exists. */
  readonly conflictStrategy: ConflictStrategy;
}

/** How to resolve naming conflicts at the destination. */
export type ConflictStrategy =
  | "skip"
  | "overwrite"
  | "rename"
  | "ask";

/**
 * Request to upload a file.
 */
export interface UploadRequest {
  /** Destination folder. */
  readonly destinationFolder: StorageItemId;
  /** File name at destination. */
  readonly fileName: string;
  /** File size in bytes, if known ahead of time. */
  readonly fileSize?: number;
  /** MIME type of the file. */
  readonly contentType?: string;
  /** Conflict resolution strategy. */
  readonly conflictStrategy: ConflictStrategy;
}

/**
 * Request to download a file.
 */
export interface DownloadRequest {
  /** Item to download. */
  readonly source: StorageItemId;
  /** Local destination path (provided by Tauri file dialog). */
  readonly destinationPath: string;
}

/**
 * Handle for a running operation. Supports cancel, pause, resume.
 */
export interface OperationHandle {
  /** Unique operation ID. */
  readonly operationId: string;
  /** Type of operation. */
  readonly type: OperationType;
  /** Current state. */
  readonly state: OperationState;
  /** Cancel the operation. */
  readonly cancel: () => Promise<void>;
  /** Pause the operation (if supported by the provider). */
  readonly pause: () => Promise<void>;
  /** Resume a paused operation. */
  readonly resume: () => Promise<void>;
  /** Subscribe to progress updates. Returns an unsubscribe function. */
  readonly onProgress: (listener: OperationProgressListener) => () => void;
}
