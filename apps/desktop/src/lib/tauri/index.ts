/**
 * StorageBridge — Public API for the Tauri IPC layer.
 *
 * Import from `@/lib/tauri` to access all bridge functionality.
 * Never call `@tauri-apps/api` directly from application code.
 */

export { health, version, platform, appDirectories, listDrives, listDirectory, createFolder, renameItem, deleteItem, copyItem, moveItem, searchDirectory, startTransfer, pauseTransfer, resumeTransfer, cancelTransfer, getAttributes, setHidden, setReadonly, getThumbnail, launchAgent, agentPort, remoteDownload, remoteUploadFile, pickFiles, openUrl } from "./commands";

export { onBridgeEvent } from "./events";
export type { BridgeEventName, BridgeReadyPayload, BridgeErrorEventPayload, SearchProgressPayload } from "./events";

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
  FileAttributes,
  AgentLaunchResult,
  PickedFile,
  TransferProgressPayload,
} from "./types";
