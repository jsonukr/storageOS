import { useEffect, useRef } from "react";
import { AgentClient, setAgentClientInstance } from "@/services/agent";
import { useAgentStore } from "@/stores/agent";
import { launchAgent, agentPort } from "@/lib/tauri";

export function useAgentConnection(): void {
  const initialize = useAgentStore((s) => s.initialize);
  const initialized = useAgentStore((s) => s.initialized);
  const clientRef = useRef<AgentClient | null>(null);

  useEffect(() => {
    if (initialized) return;

    let stopped = false;

    async function boot() {
      const port = await agentPort().catch(() => 19742);

      if (stopped) return;

      const client = new AgentClient(port);
      clientRef.current = client;
      setAgentClientInstance(client);

      client.setLauncher(async () => {
        await launchAgent();
      });

      initialize(client);
      client.start();
    }

    boot();

    return () => {
      stopped = true;
      clientRef.current?.stop();
    };
  }, [initialize, initialized]);
}
