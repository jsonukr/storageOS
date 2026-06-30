/**
 * StorageEvents — Event types for real-time change watching.
 *
 * Providers that support `canWatchChanges` emit these events
 * through the `watchChanges` method on StorageProvider.
 * The UI uses these to update directory listings in real time.
 */

import type { StorageItem, StorageItemId } from "./StorageItem";

/** What happened to an item. */
export type StorageChangeType =
  | "created"
  | "modified"
  | "deleted"
  | "renamed"
  | "moved";

/**
 * A single change event from a storage provider.
 */
export interface StorageChangeEvent {
  /** Type of change. */
  readonly type: StorageChangeType;
  /** Provider that emitted the event. */
  readonly providerId: string;
  /** The affected item after the change. Undefined for deletions. */
  readonly item?: StorageItem;
  /** The item ID before the change (for renames/moves). */
  readonly previousId?: StorageItemId;
  /** The previous path (for renames/moves). */
  readonly previousPath?: string;
  /** ISO-8601 timestamp when the change was detected. */
  readonly timestamp: string;
}

/**
 * Listener callback for storage change events.
 */
export type StorageChangeListener = (event: StorageChangeEvent) => void;

/**
 * Handle returned by `watchChanges` to stop watching.
 */
export interface StorageWatcher {
  /** Stop watching and clean up resources. */
  readonly unwatch: () => void;
}
