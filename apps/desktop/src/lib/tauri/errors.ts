/**
 * Error handling for the Tauri IPC bridge.
 *
 * Maps raw Rust error payloads into typed TypeScript errors.
 */

import type { BridgeErrorCode, BridgeErrorPayload } from "./types";

/**
 * Typed error class for bridge communication failures.
 * Wraps the error payload returned by Rust commands.
 */
export class BridgeError extends Error {
  readonly code: BridgeErrorCode;

  constructor(code: BridgeErrorCode, message: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }

  /**
   * Create a BridgeError from a raw Rust error payload.
   * Falls back to INTERNAL if the payload shape is unexpected.
   */
  static fromPayload(payload: unknown): BridgeError {
    if (isBridgeErrorPayload(payload)) {
      return new BridgeError(payload.code, payload.message);
    }

    if (payload instanceof Error) {
      return new BridgeError("INTERNAL", payload.message);
    }

    return new BridgeError(
      "INTERNAL",
      typeof payload === "string" ? payload : "Unknown bridge error",
    );
  }
}

function isBridgeErrorPayload(value: unknown): value is BridgeErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as BridgeErrorPayload).code === "string" &&
    typeof (value as BridgeErrorPayload).message === "string"
  );
}
