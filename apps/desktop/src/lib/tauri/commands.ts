/**
 * Typed command definitions for the Tauri IPC bridge.
 *
 * Each function maps 1:1 to a `#[tauri::command]` on the Rust side.
 * This is the ONLY place that calls `invoke()`.
 */

import { invoke } from "./invoke";
import type {
  AgentLaunchResult,
  AppDirectoriesResponse,
  DirectoryEntry,
  FileAttributes,
  HealthResponse,
  LocalDriveInfo,
  OperationResult,
  PickedFile,
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

/** Open an http(s) URL in the user's default browser. */
export function openUrl(url: string): Promise<void> {
  return invoke<void>("open_url", { url });
}

/** Download the given installer URL, launch it, and quit the app to update. */
export function installUpdate(url: string): Promise<void> {
  return invoke<void>("install_update", { url });
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

/** Copy a file or folder to a destination directory. */
export function copyItem(source: string, destinationDir: string, overwrite?: boolean, newName?: string): Promise<OperationResult> {
  return invoke<OperationResult>("copy_item", { source, destinationDir, overwrite, newName });
}

/** Move a file or folder to a destination directory. */
export function moveItem(source: string, destinationDir: string, overwrite?: boolean, newName?: string): Promise<OperationResult> {
  return invoke<OperationResult>("move_item", { source, destinationDir, overwrite, newName });
}

/** Search filenames within a directory. */
export function searchDirectory(
  path: string,
  query: string,
  recursive?: boolean,
): Promise<DirectoryEntry[]> {
  return invoke<DirectoryEntry[]>("search_directory", { path, query, recursive });
}

/** Start a background file transfer with chunked progress reporting. */
export function startTransfer(
  transferId: string,
  source: string,
  destinationDir: string,
  transferType: string,
  overwrite?: boolean,
  newName?: string,
): Promise<void> {
  return invoke<void>("start_transfer", {
    transferId,
    source,
    destinationDir,
    transferType,
    overwrite,
    newName,
  });
}

/** Pause an active transfer (waits between chunk writes). */
export function pauseTransfer(transferId: string): Promise<boolean> {
  return invoke<boolean>("pause_transfer", { transferId });
}

/** Resume a paused transfer. */
export function resumeTransfer(transferId: string): Promise<boolean> {
  return invoke<boolean>("resume_transfer", { transferId });
}

/** Cancel an active or paused transfer (deletes partial file). */
export function cancelTransfer(transferId: string): Promise<boolean> {
  return invoke<boolean>("cancel_transfer", { transferId });
}

/** Get file attributes (hidden, readonly, system, archive). */
export function getAttributes(path: string): Promise<FileAttributes> {
  return invoke<FileAttributes>("get_attributes", { path });
}

/** Set or clear the hidden attribute on a file or folder. */
export function setHidden(path: string, hidden: boolean): Promise<FileAttributes> {
  return invoke<FileAttributes>("set_hidden", { path, hidden });
}

/** Set or clear the readonly attribute on a file or folder. */
export function setReadonly(path: string, readonly: boolean): Promise<FileAttributes> {
  return invoke<FileAttributes>("set_readonly", { path, readonly });
}

/** Generate a JPEG thumbnail for an image file. Returns a data URL. */
export function getThumbnail(path: string, maxSize: number): Promise<string> {
  return invoke<string>("get_thumbnail", { path, maxSize });
}

/** Launch the StorageOS Agent background process. */
export function launchAgent(): Promise<AgentLaunchResult> {
  return invoke<AgentLaunchResult>("launch_agent");
}

/** Get the configured agent port from storageos-core constants. */
export function agentPort(): Promise<number> {
  return invoke<number>("agent_port");
}

/** Download a file from a remote device to a local path with progress tracking. */
export function remoteDownload(
  transferId: string,
  url: string,
  destPath: string,
): Promise<void> {
  return invoke<void>("remote_download", { transferId, url, destPath });
}

/** Upload a local file to a remote device with progress tracking. */
export function remoteUploadFile(
  transferId: string,
  sourcePath: string,
  remoteUploadUrl: string,
): Promise<void> {
  return invoke<void>("remote_upload", { transferId, sourcePath, remoteUploadUrl });
}

/** Open a native file picker dialog and return selected file paths. */
export function pickFiles(): Promise<PickedFile[]> {
  return invoke<PickedFile[]>("pick_files");
}
