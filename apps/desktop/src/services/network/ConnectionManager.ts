import type {
  DeviceEndpoint,
  ConnectionInfo,
  ConnectionState,
  ConnectionQuality,
  TransportKind,
  EndpointHealth,
} from "./types";
import { TRANSPORT_PRIORITY } from "./types";
import { selectBestEndpoint, computeQuality, getAvailableTransports } from "./TransportSelector";

type Listener = () => void;

const connections = new Map<string, ConnectionInfo>();
let listeners: Listener[] = [];

function notify(): void {
  for (const fn of listeners) fn();
}

function defaultHealth(): EndpointHealth {
  return {
    latencyMs: null,
    failureCount: 0,
    lastFailure: null,
    successCount: 0,
    lastSuccess: null,
  };
}

function getOrCreate(deviceId: string): ConnectionInfo {
  let info = connections.get(deviceId);
  if (!info) {
    info = {
      deviceId,
      endpoints: [],
      activeTransport: "lan",
      state: "disconnected",
      connectedAt: null,
    };
    connections.set(deviceId, info);
  }
  return info;
}

function parseHostPort(address: string): { host: string; port: number } {
  const lastColon = address.lastIndexOf(":");
  if (lastColon > 0) {
    const port = parseInt(address.substring(lastColon + 1), 10);
    if (!isNaN(port)) {
      return { host: address.substring(0, lastColon), port };
    }
  }
  return { host: address, port: 19742 };
}

function updateActiveTransport(info: ConnectionInfo): void {
  const best = selectBestEndpoint(info.endpoints);
  if (best) {
    info.activeTransport = best.transport;
    if (best.reachable) {
      info.state = "connected";
      info.connectedAt = info.connectedAt ?? Date.now();
    }
  } else if (info.endpoints.length > 0) {
    info.state = "disconnected";
  }
}

export const ConnectionManager = {
  subscribe(listener: Listener): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  registerEndpoint(
    deviceId: string,
    address: string,
    lastSeen?: number,
    transport: TransportKind = "lan",
  ): void {
    const info = getOrCreate(deviceId);
    const { host, port } = parseHostPort(address);

    const existing = info.endpoints.find((e) => e.transport === transport);
    if (existing) {
      existing.host = host;
      existing.port = port;
      existing.lastSeen = lastSeen ?? null;
      existing.reachable = true;
    } else {
      info.endpoints.push({
        deviceId,
        transport,
        host,
        port,
        priority: TRANSPORT_PRIORITY[transport] ?? 50,
        reachable: true,
        lastSeen: lastSeen ?? null,
        lastSuccessful: lastSeen ?? null,
        health: defaultHealth(),
      });
    }

    updateActiveTransport(info);
    notify();
  },

  registerEndpoints(deviceId: string, endpoints: DeviceEndpoint[]): void {
    const info = getOrCreate(deviceId);
    for (const ep of endpoints) {
      if (!ep.health) {
        ep.health = defaultHealth();
      }
      const existing = info.endpoints.find((e) => e.transport === ep.transport);
      if (existing) {
        ep.health = existing.health;
      }
    }
    info.endpoints = endpoints;

    updateActiveTransport(info);
    notify();
  },

  removeEndpoint(deviceId: string, transport?: TransportKind): void {
    if (!transport) {
      connections.delete(deviceId);
    } else {
      const info = connections.get(deviceId);
      if (info) {
        info.endpoints = info.endpoints.filter((e) => e.transport !== transport);
        if (info.endpoints.length === 0) {
          connections.delete(deviceId);
        } else {
          updateActiveTransport(info);
        }
      }
    }
    notify();
  },

  updateAddress(deviceId: string, address: string): void {
    const info = connections.get(deviceId);
    if (info) {
      const { host, port } = parseHostPort(address);
      const lanEp = info.endpoints.find((e) => e.transport === "lan");
      if (lanEp) {
        lanEp.host = host;
        lanEp.port = port;
      }
      notify();
    }
  },

  connect(deviceId: string): void {
    const info = getOrCreate(deviceId);
    info.state = "connected";
    info.connectedAt = Date.now();
    notify();
  },

  disconnect(deviceId: string): void {
    const info = connections.get(deviceId);
    if (info) {
      info.state = "disconnected";
      info.connectedAt = null;
      notify();
    }
  },

  recordSuccess(deviceId: string, transport: TransportKind, latencyMs: number): void {
    const info = connections.get(deviceId);
    if (!info) return;

    const ep = info.endpoints.find((e) => e.transport === transport);
    if (!ep) return;

    ep.reachable = true;
    ep.health.latencyMs = latencyMs;
    ep.health.successCount++;
    ep.health.lastSuccess = Date.now();
    ep.lastSuccessful = Date.now();

    if (ep.health.failureCount > 0) {
      ep.health.failureCount = Math.max(0, ep.health.failureCount - 1);
    }

    updateActiveTransport(info);
    notify();
  },

  recordFailure(deviceId: string, transport: TransportKind): void {
    const info = connections.get(deviceId);
    if (!info) return;

    const ep = info.endpoints.find((e) => e.transport === transport);
    if (!ep) return;

    ep.health.failureCount++;
    ep.health.lastFailure = Date.now();

    if (ep.health.failureCount >= 3) {
      ep.reachable = false;
    }

    updateActiveTransport(info);

    const anyReachable = info.endpoints.some((e) => e.reachable);
    if (!anyReachable) {
      info.state = "failed";
    }

    notify();
  },

  resolve(deviceId: string): DeviceEndpoint | null {
    const info = connections.get(deviceId);
    if (!info) return null;
    return selectBestEndpoint(info.endpoints);
  },

  resolveAll(deviceId: string): DeviceEndpoint[] {
    const info = connections.get(deviceId);
    return info?.endpoints ?? [];
  },

  getAddress(deviceId: string): string | null {
    const info = connections.get(deviceId);
    if (!info) return null;
    const ep = selectBestEndpoint(info.endpoints);
    if (!ep) return null;
    return `${ep.host}:${ep.port}`;
  },

  buildUrl(deviceId: string, path: string): string | null {
    const address = this.getAddress(deviceId);
    if (!address) return null;
    const base = `http://${address}`;
    if (path.startsWith("/")) return `${base}${path}`;
    return `${base}/${path}`;
  },

  getState(deviceId: string): ConnectionState {
    return connections.get(deviceId)?.state ?? "disconnected";
  },

  getConnection(deviceId: string): ConnectionInfo | null {
    return connections.get(deviceId) ?? null;
  },

  getBestConnection(deviceId: string): ConnectionInfo | null {
    return connections.get(deviceId) ?? null;
  },

  getActiveTransport(deviceId: string): TransportKind | null {
    return connections.get(deviceId)?.activeTransport ?? null;
  },

  getAvailableTransports(deviceId: string): DeviceEndpoint[] {
    const info = connections.get(deviceId);
    if (!info) return [];
    return getAvailableTransports(info.endpoints);
  },

  getConnectionQuality(deviceId: string): ConnectionQuality {
    const info = connections.get(deviceId);
    if (!info) return "offline";
    const best = selectBestEndpoint(info.endpoints);
    return computeQuality(best);
  },

  getEndpointHealth(deviceId: string, transport: TransportKind): EndpointHealth | null {
    const info = connections.get(deviceId);
    if (!info) return null;
    const ep = info.endpoints.find((e) => e.transport === transport);
    return ep?.health ?? null;
  },

  switchTransport(deviceId: string, transport: TransportKind): boolean {
    const info = connections.get(deviceId);
    if (!info) return false;
    const ep = info.endpoints.find((e) => e.transport === transport && e.reachable);
    if (!ep) return false;
    info.activeTransport = transport;
    notify();
    return true;
  },

  getEndpointCount(deviceId: string): number {
    return connections.get(deviceId)?.endpoints.length ?? 0;
  },

  getReachableCount(deviceId: string): number {
    const info = connections.get(deviceId);
    return info?.endpoints.filter((e) => e.reachable).length ?? 0;
  },

  refresh(deviceId: string): void {
    const info = connections.get(deviceId);
    if (info) {
      for (const ep of info.endpoints) {
        ep.lastSeen = Date.now();
      }
      updateActiveTransport(info);
      notify();
    }
  },

  invalidate(deviceId: string): void {
    const info = connections.get(deviceId);
    if (info) {
      info.state = "failed";
      for (const ep of info.endpoints) {
        ep.reachable = false;
      }
      notify();
    }
  },

  allConnections(): ConnectionInfo[] {
    return [...connections.values()];
  },

  transportPriority(): TransportKind[] {
    return ["lan", "usb", "vpn", "bluetooth", "relay"];
  },
};
