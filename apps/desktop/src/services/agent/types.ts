/**
 * Types for the Agent connection layer.
 */

export type AgentConnectionState =
  | "offline"
  | "starting"
  | "connecting"
  | "connected"
  | "error";

export type RelayStatus =
  | "disabled"
  | "disconnected"
  | "connecting"
  | "connected"
  | "failed";

export interface AgentHealthResponse {
  readonly status: "ok";
  readonly uptime_secs: number;
  readonly version: string;
  readonly platform: string;
  readonly relay_status?: RelayStatus;
}

export interface AgentVersionResponse {
  readonly agent: string;
  readonly core: string;
  readonly platform: string;
}

export interface AgentConnectionInfo {
  readonly state: AgentConnectionState;
  readonly agentVersion: string | null;
  readonly agentUptime: number | null;
  readonly lastError: string | null;
  readonly lastHealthCheck: number | null;
  readonly relayStatus: RelayStatus;
}
