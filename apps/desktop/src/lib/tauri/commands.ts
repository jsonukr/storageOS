/**
 * Typed command definitions for the Tauri IPC bridge.
 *
 * Each function maps 1:1 to a `#[tauri::command]` on the Rust side.
 * This is the ONLY place that calls `invoke()`.
 */

import { invoke } from "./invoke";
import type {
  AppDirectoriesResponse,
  HealthResponse,
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
