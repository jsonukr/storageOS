/**
 * StorageItem — Core domain type representing a file or folder
 * in any storage provider.
 *
 * Every provider must map its native item representation to this type.
 * The UI layer consumes only StorageItem, never provider-specific types.
 */

/** Discriminates files from folders and other item types. */
export type StorageItemType = "file" | "folder" | "shortcut" | "unknown";

/** MIME-like content type hint. Providers should map to standard MIME types. */
export type ContentType = string;

/**
 * Unique reference to an item within a provider.
 * Composed of providerId + the provider's native item identifier.
 */
export interface StorageItemId {
  /** Which provider owns this item. */
  readonly providerId: string;
  /** Provider-native identifier (path, cloud ID, etc.). */
  readonly itemId: string;
}

/**
 * A file or folder as seen by the UI layer.
 * All fields are read-only — mutations go through StorageProvider operations.
 */
export interface StorageItem {
  /** Globally unique reference within StorageOS. */
  readonly id: StorageItemId;
  /** Display name (e.g. "report.pdf", "Documents"). */
  readonly name: string;
  /** Item type discriminator. */
  readonly type: StorageItemType;
  /** MIME type for files. Undefined for folders. */
  readonly contentType?: ContentType;
  /** Size in bytes. Undefined for folders or when unknown. */
  readonly size?: number;
  /** ISO-8601 creation timestamp. */
  readonly createdAt?: string;
  /** ISO-8601 last-modified timestamp. */
  readonly modifiedAt?: string;
  /** Parent folder ID. Undefined for root items. */
  readonly parentId?: StorageItemId;
  /** Full path from drive root (e.g. "/Documents/report.pdf"). */
  readonly path: string;
  /** File extension without dot (e.g. "pdf"). Undefined for folders. */
  readonly extension?: string;
  /** Whether the item is read-only within this provider. */
  readonly isReadOnly: boolean;
  /** Whether the item is hidden (dotfile, system attribute, etc.). */
  readonly isHidden: boolean;
  /** Thumbnail URL or data URI, if available. */
  readonly thumbnailUrl?: string;
  /** Provider-specific metadata the UI doesn't interpret directly. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Paginated result set for directory listings and search results.
 */
export interface StorageItemPage {
  /** Items in this page. */
  readonly items: readonly StorageItem[];
  /** Opaque cursor for fetching the next page. Undefined if no more pages. */
  readonly nextCursor?: string;
  /** Total count if known by the provider. */
  readonly totalCount?: number;
}

/**
 * Options for listing directory contents.
 */
export interface ListOptions {
  /** Opaque pagination cursor from a previous StorageItemPage. */
  readonly cursor?: string;
  /** Maximum items per page. */
  readonly pageSize?: number;
  /** Include hidden items. */
  readonly includeHidden?: boolean;
  /** Sort field. */
  readonly sortBy?: "name" | "size" | "modifiedAt" | "createdAt";
  /** Sort direction. */
  readonly sortDirection?: "asc" | "desc";
}

/**
 * Options for searching items.
 */
export interface SearchOptions extends ListOptions {
  /** Search query string. */
  readonly query: string;
  /** Restrict search to specific item types. */
  readonly itemType?: StorageItemType;
  /** Restrict search to items within a specific folder (recursive). */
  readonly scope?: StorageItemId;
  /** Restrict to specific file extensions (without dot). */
  readonly extensions?: readonly string[];
}
