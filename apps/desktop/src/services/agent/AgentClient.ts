/**
 * AgentClient — manages the connection lifecycle between Desktop and Agent.
 *
 * Responsibilities:
 * - Health polling at a configurable interval
 * - Auto-launch agent if not running
 * - Reconnect logic with backoff
 * - Connection state management via callbacks
 *
 * The UI never makes HTTP requests directly — it subscribes to this service.
 */

import type {
  AgentConnectionState,
  AgentHealthResponse,
  AgentConnectionInfo,
} from "./types";
import type { LocalDriveInfo, DirectoryEntry } from "@/lib/tauri";

const DEFAULT_AGENT_PORT = 19742;
const HEALTH_POLL_INTERVAL_MS = 15_000;
const STARTUP_RETRY_DELAY_MS = 1_500;
const STARTUP_MAX_RETRIES = 6;
const CONNECT_TIMEOUT_MS = 3_000;

type StateListener = (info: AgentConnectionInfo) => void;

export class AgentClient {
  private baseUrl: string;
  private state: AgentConnectionState = "offline";
  private agentVersion: string | null = null;
  private agentUptime: number | null = null;
  private lastError: string | null = null;
  private lastHealthCheck: number | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<StateListener> = new Set();
  private launchAgent: (() => Promise<void>) | null = null;
  private startupInProgress = false;

  constructor(port?: number) {
    this.baseUrl = `http://127.0.0.1:${port ?? DEFAULT_AGENT_PORT}`;
  }

  setLauncher(launcher: () => Promise<void>): void {
    this.launchAgent = launcher;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getInfo());
    return () => this.listeners.delete(listener);
  }

  getInfo(): AgentConnectionInfo {
    return {
      state: this.state,
      agentVersion: this.agentVersion,
      agentUptime: this.agentUptime,
      lastError: this.lastError,
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  async start(): Promise<void> {
    this.setState("connecting");

    const healthy = await this.checkHealth();
    if (healthy) {
      this.setState("connected");
      this.startPolling();
      return;
    }

    if (this.launchAgent && !this.startupInProgress) {
      await this.tryLaunchAndConnect();
    } else {
      this.setState("offline");
      this.startPolling();
    }
  }

  stop(): void {
    this.stopPolling();
    this.setState("offline");
    this.agentVersion = null;
    this.agentUptime = null;
  }

  private async tryLaunchAndConnect(): Promise<void> {
    if (!this.launchAgent || this.startupInProgress) return;

    this.startupInProgress = true;
    this.setState("starting");

    try {
      await this.launchAgent();
    } catch {
      this.lastError = "Failed to launch agent process";
      this.setState("error");
      this.startupInProgress = false;
      this.startPolling();
      return;
    }

    for (let i = 0; i < STARTUP_MAX_RETRIES; i++) {
      await sleep(STARTUP_RETRY_DELAY_MS);
      this.setState("connecting");
      const healthy = await this.checkHealth();
      if (healthy) {
        this.setState("connected");
        this.startupInProgress = false;
        this.startPolling();
        return;
      }
    }

    this.lastError = "Agent started but did not become healthy";
    this.setState("offline");
    this.startupInProgress = false;
    this.startPolling();
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return false;

      const data: AgentHealthResponse = await response.json();
      if (data.status === "ok") {
        this.agentVersion = data.version;
        this.agentUptime = data.uptime_secs;
        this.lastHealthCheck = Date.now();
        this.lastError = null;
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      const healthy = await this.checkHealth();
      const wasConnected = this.state === "connected";

      if (healthy && !wasConnected) {
        this.setState("connected");
      } else if (!healthy && wasConnected) {
        this.setState("offline");
        this.agentVersion = null;
        this.agentUptime = null;
      }
    }, HEALTH_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  isConnected(): boolean {
    return this.state === "connected";
  }

  async fetchRoots(): Promise<LocalDriveInfo[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    const response = await fetch(`${this.baseUrl}/roots`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }
    return response.json();
  }

  async fetchDirectory(path: string): Promise<DirectoryEntry[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    const response = await fetch(
      `${this.baseUrl}/directory?path=${encodeURIComponent(path)}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`Agent returned ${response.status}`);
    }
    return response.json();
  }

  private setState(newState: AgentConnectionState): void {
    if (this.state === newState) return;
    this.state = newState;
    const info = this.getInfo();
    for (const listener of this.listeners) {
      listener(info);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
