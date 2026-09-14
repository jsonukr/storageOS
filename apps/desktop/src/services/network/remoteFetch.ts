import { ConnectionManager } from "./ConnectionManager";
import type { TransportKind } from "./types";

const DEBUG = import.meta.env.DEV;
const LOCAL_AGENT = "http://127.0.0.1:19742";

// This PC's own device id, sent as X-StorageOS-Device on direct LAN requests so
// the peer can verify we're an approved device before serving files. Cached
// after the first lookup from the local agent's /health.
let localDeviceId: string | null = null;
async function getLocalDeviceId(): Promise<string> {
  if (localDeviceId !== null) return localDeviceId;
  try {
    const r = await fetch(`${LOCAL_AGENT}/health`);
    localDeviceId = r.ok ? ((await r.json()).device_id ?? "") : "";
  } catch {
    localDeviceId = "";
  }
  return localDeviceId ?? "";
}

async function withDeviceHeader(init: RequestInit): Promise<RequestInit> {
  const did = await getLocalDeviceId();
  if (!did) return init;
  const headers = new Headers(init.headers ?? {});
  headers.set("X-StorageOS-Device", did);
  return { ...init, headers };
}

function debugLog(msg: string, data?: Record<string, unknown>): void {
  if (!DEBUG) return;
  const parts = [`[transport] ${msg}`];
  if (data) {
    for (const [k, v] of Object.entries(data)) parts.push(`${k}=${v}`);
  }
  // eslint-disable-next-line no-console
  console.debug(parts.join(" | "));
}

interface RemoteFetchOptions extends RequestInit {
  deviceId: string;
  path: string;
  retry?: boolean;
}

export async function remoteFetch(opts: RemoteFetchOptions): Promise<Response> {
  const { deviceId, path, retry = true, ...fetchInit } = opts;

  const transport = ConnectionManager.getActiveTransport(deviceId);

  if (transport === "relay") {
    return relayFetch(deviceId, path, fetchInit);
  }

  const address = ConnectionManager.getAddress(deviceId);
  if (!address) throw new Error(`No connection for device ${deviceId}`);

  const url = `http://${address}${path.startsWith("/") ? path : `/${path}`}`;
  const start = performance.now();

  debugLog("request", {
    transport: transport ?? "unknown",
    url,
    method: fetchInit.method ?? "GET",
  });

  try {
    const response = await fetch(url, await withDeviceHeader(fetchInit));
    const latency = performance.now() - start;

    if (response.ok) {
      if (transport) {
        ConnectionManager.recordSuccess(deviceId, transport, latency);
        debugLog("success", {
          transport,
          latency: `${Math.round(latency)}ms`,
          status: response.status,
        });
      }
      return response;
    }

    if (transport) {
      ConnectionManager.recordFailure(deviceId, transport);
      debugLog("http-error", {
        transport,
        status: response.status,
        latency: `${Math.round(latency)}ms`,
      });
    }

    if (retry && response.status >= 500) {
      return retryOnFailover(deviceId, path, fetchInit, transport);
    }

    return response;
  } catch (err) {
    if (transport) {
      ConnectionManager.recordFailure(deviceId, transport);
      debugLog("network-error", {
        transport,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (retry) {
      return retryOnFailover(deviceId, path, fetchInit, transport);
    }

    throw err;
  }
}

async function retryOnFailover(
  deviceId: string,
  path: string,
  fetchInit: RequestInit,
  previousTransport: TransportKind | null,
): Promise<Response> {
  const newTransport = ConnectionManager.getActiveTransport(deviceId);
  const newAddress = ConnectionManager.getAddress(deviceId);

  // No alternative *direct* transport available. Fall back to the relay, which
  // routes by device id through the local agent — it needs no reachable LAN
  // endpoint. This is what lets remote browsing work when the peer's LAN
  // address is unreachable (different network) or simply wrong (VPN / virtual
  // adapter picked up by the peer's LAN-IP detection).
  if (!newAddress || newTransport === previousTransport || newTransport === "relay") {
    if (previousTransport !== "relay") {
      debugLog("failover", { from: previousTransport ?? "unknown", to: "relay" });
      return relayFetch(deviceId, path, fetchInit);
    }
    debugLog("failover-skip", { reason: "relay-exhausted" });
    throw new Error(`No connection for device ${deviceId}`);
  }

  debugLog("failover", {
    from: previousTransport ?? "unknown",
    to: newTransport ?? "unknown",
    address: newAddress,
  });

  const url = `http://${newAddress}${path.startsWith("/") ? path : `/${path}`}`;
  const start = performance.now();

  try {
    const response = await fetch(url, await withDeviceHeader(fetchInit));
    const latency = performance.now() - start;

    if (response.ok && newTransport) {
      ConnectionManager.recordSuccess(deviceId, newTransport, latency);
      debugLog("failover-success", {
        transport: newTransport,
        latency: `${Math.round(latency)}ms`,
      });
    } else if (!response.ok && newTransport) {
      ConnectionManager.recordFailure(deviceId, newTransport);
    }

    return response;
  } catch (err) {
    if (newTransport) {
      ConnectionManager.recordFailure(deviceId, newTransport);
    }
    throw err;
  }
}

async function relayFetch(
  deviceId: string,
  path: string,
  fetchInit: RequestInit,
): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const separator = normalizedPath.includes("?") ? "&" : "?";
  const relayUrl = `${LOCAL_AGENT}/relay${normalizedPath}${separator}device=${encodeURIComponent(deviceId)}`;
  const start = performance.now();

  debugLog("relay-request", {
    transport: "relay",
    url: relayUrl,
    method: fetchInit.method ?? "GET",
  });

  try {
    const response = await fetch(relayUrl, fetchInit);
    const latency = performance.now() - start;

    if (response.ok) {
      ConnectionManager.recordSuccess(deviceId, "relay", latency);
      debugLog("relay-success", {
        latency: `${Math.round(latency)}ms`,
        status: response.status,
      });
    } else {
      ConnectionManager.recordFailure(deviceId, "relay");
      debugLog("relay-error", {
        status: response.status,
        latency: `${Math.round(latency)}ms`,
      });
    }

    return response;
  } catch (err) {
    ConnectionManager.recordFailure(deviceId, "relay");
    debugLog("relay-network-error", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export function buildRemoteUrl(deviceId: string, path: string): string | null {
  const transport = ConnectionManager.getActiveTransport(deviceId);

  if (transport === "relay") {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const separator = normalizedPath.includes("?") ? "&" : "?";
    return `${LOCAL_AGENT}/relay${normalizedPath}${separator}device=${encodeURIComponent(deviceId)}`;
  }

  const address = ConnectionManager.getAddress(deviceId);
  if (!address) return null;
  const p = path.startsWith("/") ? path : `/${path}`;
  // Native downloader/uploader URLs (Tauri, <video src>) can't set a header, so
  // carry our device id as a query param for the peer's LAN authorization.
  const did = localDeviceId ?? "";
  if (!did) return `http://${address}${p}`;
  const sep = p.includes("?") ? "&" : "?";
  return `http://${address}${p}${sep}dev=${encodeURIComponent(did)}`;
}

// Warm the cached device id at startup so buildRemoteUrl has it synchronously.
void getLocalDeviceId();

export function recordTransferResult(
  deviceId: string,
  success: boolean,
  latencyMs?: number,
): void {
  const transport = ConnectionManager.getActiveTransport(deviceId);
  if (!transport) return;

  if (success && latencyMs !== undefined) {
    ConnectionManager.recordSuccess(deviceId, transport, latencyMs);
  } else if (!success) {
    ConnectionManager.recordFailure(deviceId, transport);
  }
}
