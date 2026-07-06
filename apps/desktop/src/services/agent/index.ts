import { AgentClient } from "./AgentClient";

export { AgentClient } from "./AgentClient";
export type {
  AgentConnectionState,
  AgentHealthResponse,
  AgentVersionResponse,
  AgentConnectionInfo,
  RelayStatus,
} from "./types";

let _instance: AgentClient | null = null;

export function setAgentClientInstance(client: AgentClient): void {
  _instance = client;
}

export function getAgentClient(): AgentClient | null {
  return _instance;
}
