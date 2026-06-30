/**
 * StorageBridge — Public API for the Tauri IPC layer.
 *
 * Import from `@/lib/tauri` to access all bridge functionality.
 * Never call `@tauri-apps/api` directly from application code.
 */

export { health, version, platform, appDirectories } from "./commands";

export { onBridgeEvent } from "./events";
export type { BridgeEventName, BridgeReadyPayload, BridgeErrorEventPayload } from "./events";

export { BridgeError } from "./errors";

export type {
  HealthResponse,
  VersionResponse,
  PlatformResponse,
  AppDirectoriesResponse,
  BridgeErrorPayload,
  BridgeErrorCode,
} from "./types";
