import { create } from "zustand";
import { AgentClient } from "@/services/agent";
import type { AgentConnectionState } from "@/services/agent";

interface AgentStore {
  state: AgentConnectionState;
  agentVersion: string | null;
  agentUptime: number | null;
  lastError: string | null;
  lastHealthCheck: number | null;
  initialized: boolean;

  initialize: (client: AgentClient) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  state: "offline",
  agentVersion: null,
  agentUptime: null,
  lastError: null,
  lastHealthCheck: null,
  initialized: false,

  initialize: (client: AgentClient) => {
    client.subscribe((info) => {
      set({
        state: info.state,
        agentVersion: info.agentVersion,
        agentUptime: info.agentUptime,
        lastError: info.lastError,
        lastHealthCheck: info.lastHealthCheck,
      });
    });
    set({ initialized: true });
  },
}));
