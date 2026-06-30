/**
 * Typed request/response models for Tauri IPC communication.
 *
 * Every Rust command maps to a typed pair here. The frontend
 * never sends untyped data across the bridge.
 */

/** Response from the `health` command. */
export interface HealthResponse {
  readonly status: "ok";
  readonly uptime_ms: number;
}

/** Response from the `version` command. */
export interface VersionResponse {
  readonly app_version: string;
  readonly tauri_version: string;
}

/** Response from the `platform` command. */
export interface PlatformResponse {
  readonly os: string;
  readonly arch: string;
  readonly locale: string | null;
}

/** Response from the `app_directories` command. */
export interface AppDirectoriesResponse {
  readonly data_dir: string;
  readonly config_dir: string;
  readonly cache_dir: string;
  readonly log_dir: string;
}

/** Drive type as reported by Windows GetDriveType. */
export type DriveType =
  | "fixed"
  | "removable"
  | "network"
  | "cd_rom"
  | "ram_disk"
  | "unknown";

/** Information about a single local drive. */
export interface LocalDriveInfo {
  readonly letter: string;
  readonly label: string;
  readonly drive_type: DriveType;
  readonly total_bytes: number;
  readonly free_bytes: number;
  readonly used_bytes: number;
  readonly file_system: string;
  readonly is_removable: boolean;
  readonly is_ready: boolean;
}

/** A single file or folder entry from a directory listing. */
export interface DirectoryEntry {
  readonly name: string;
  readonly full_path: string;
  readonly is_directory: boolean;
  readonly size: number;
  readonly last_modified: number;
  readonly hidden: boolean;
  readonly readonly: boolean;
  readonly extension: string;
}

/** Result of a file operation (create, rename, delete). */
export interface OperationResult {
  readonly success: boolean;
  readonly path: string;
}

/**
 * Error payload returned by Rust commands.
 * Maps to the Rust `BridgeError` enum.
 */
export interface BridgeErrorPayload {
  readonly code: BridgeErrorCode;
  readonly message: string;
}

/** Error codes that can come from the Rust backend. */
export type BridgeErrorCode =
  | "INTERNAL"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "INVALID_ARGUMENT"
  | "IO_ERROR"
  | "TIMEOUT";
