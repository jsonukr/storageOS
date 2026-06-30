/**
 * Typed command definitions for the Tauri IPC bridge.
 *
 * Each function maps 1:1 to a `#[tauri::command]` on the Rust side.
 * This is the ONLY place that calls `invoke()`.
 */

import { invoke } from "./invoke";
import type {
  AppDirectoriesResponse,
  DirectoryEntry,
  HealthResponse,
  LocalDriveInfo,
  OperationResult,
  PlatformResponse,
  VersionResponse,
} from "./types";

/** Check that the Rust backend is alive and responsive. */
export function health(): Promise<HealthResponse> {
  return invoke<HealthResponse>("health");
}

/** Get the app and Tauri framework versions. */
export function version(): Promise<VersionResponse> {
  return invoke<VersionResponse>("version");
}

/** Get the current platform information. */
export function platform(): Promise<PlatformResponse> {
  return invoke<PlatformResponse>("platform");
}

/** Get application-specific directories (data, config, cache, log). */
export function appDirectories(): Promise<AppDirectoriesResponse> {
  return invoke<AppDirectoriesResponse>("app_directories");
}

/** List all detected local drives on the system. */
export function listDrives(): Promise<LocalDriveInfo[]> {
  return invoke<LocalDriveInfo[]>("list_drives");
}

/** List contents of a directory. */
export function listDirectory(path: string): Promise<DirectoryEntry[]> {
  return invoke<DirectoryEntry[]>("list_dir", { path });
}

/** Create a new folder inside `parent` with the given `name`. */
export function createFolder(parent: string, name: string): Promise<OperationResult> {
  return invoke<OperationResult>("create_folder", { parent, name });
}

/** Rename a file or folder at `path` to `newName`. */
export function renameItem(path: string, newName: string): Promise<OperationResult> {
  return invoke<OperationResult>("rename_item", { path, newName });
}

/** Delete a file or folder at `path`. Permanent deletion. */
export function deleteItem(path: string): Promise<OperationResult> {
  return invoke<OperationResult>("delete_item", { path });
}
