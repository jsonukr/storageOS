/**
 * StorageBridge — Public API for the Tauri IPC layer.
 *
 * Import from `@/lib/tauri` to access all bridge functionality.
 * Never call `@tauri-apps/api` directly from application code.
 */

export { health, version, platform, appDirectories, listDrives, listDirectory, createFolder, renameItem, deleteItem } from "./commands";

export { onBridgeEvent } from "./events";
export type { BridgeEventName, BridgeReadyPayload, BridgeErrorEventPayload } from "./events";

export { BridgeError } from "./errors";

export type {
  HealthResponse,
  VersionResponse,
  PlatformResponse,
  AppDirectoriesResponse,
  LocalDriveInfo,
  DirectoryEntry,
  OperationResult,
  DriveType,
  BridgeErrorPayload,
  BridgeErrorCode,
} from "./types";
