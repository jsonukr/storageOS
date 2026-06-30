/**
 * Tauri event handling for the IPC bridge.
 *
 * Wraps Tauri's event system with typed listeners.
 * Events flow from Rust → TypeScript (backend-initiated).
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SearchProgressPayload, TransferProgressPayload } from "./types";

/**
 * Known event names emitted by the Rust backend.
 * Extend this union as new events are added.
 */
export type BridgeEventName = "bridge:ready" | "bridge:error" | "search:progress" | "transfer:progress";

/** Payload for bridge:ready event. */
export interface BridgeReadyPayload {
  readonly timestamp: number;
}

/** Payload for bridge:error event. */
export interface BridgeErrorEventPayload {
  readonly code: string;
  readonly message: string;
}

export type { SearchProgressPayload, TransferProgressPayload };

/** Map event names to their payload types. */
interface BridgeEventMap {
  "bridge:ready": BridgeReadyPayload;
  "bridge:error": BridgeErrorEventPayload;
  "search:progress": SearchProgressPayload;
  "transfer:progress": TransferProgressPayload;
}

/**
 * Listen for a typed event from the Rust backend.
 *
 * @param event - The event name to listen for.
 * @param handler - Callback invoked with the typed payload.
 * @returns A function to stop listening.
 */
export async function onBridgeEvent<E extends BridgeEventName>(
  event: E,
  handler: (payload: BridgeEventMap[E]) => void,
): Promise<UnlistenFn> {
  return listen<BridgeEventMap[E]>(event, (e) => {
    handler(e.payload);
  });
}
