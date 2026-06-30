/**
 * Central invoke wrapper for Tauri IPC.
 *
 * All Rust command calls go through this module — no direct
 * `invoke()` calls anywhere else in the frontend.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { BridgeError } from "./errors";

/**
 * Invoke a Tauri command with typed arguments and response.
 *
 * @param command - The Rust command name (must match `#[tauri::command]`).
 * @param args - Command arguments (omit for commands with no args).
 * @returns The typed response from Rust.
 * @throws {BridgeError} If the Rust command returns an error.
 */
export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error: unknown) {
    throw BridgeError.fromPayload(error);
  }
}
