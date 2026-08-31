import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentStore } from "@/stores/agent";
import { useExplorerStore } from "@/stores/explorer";
import { ConnectionManager, TRANSPORT_LABELS } from "@/services/network";
import type { TransportKind, ConnectionQuality } from "@/services/network";
import { PairDeviceDialog } from "@/components/PairDeviceDialog";
import { PairCodeEntryDialog } from "@/components/PairCodeEntryDialog";

interface PairInfo {
  v?: number;
  id: string;
  name: string;
  fp?: string;
  hint?: { lan: string };
}

interface EndpointInfo {
  transport: string;
  host: string;
  port: number;
  priority: number;
  reachable: boolean;
  last_seen: number;
  last_successful: number;
}

interface DeviceRecord {
  device_id: string;
  system_name: string;
  friendly_name: string;
  device_type: string;
  platform: string;
  version: string;
  address: string;
  last_seen: number;
  paired_at: number;
  status: string;
  endpoints?: EndpointInfo[];
  preferred_transport?: string;
  connection_state?: string;
}

const AGENT_BASE = "http://127.0.0.1:19742";

export default function Devices() {
  const navigate = useNavigate();
  const agentState = useAgentStore((s) => s.state);
  const agentVersion = useAgentStore((s) => s.agentVersion);
  const [pairInfo, setPairInfo] = useState<PairInfo | null>(null);
  const [showPairDialog, setShowPairDialog] = useState(false);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [renameTarget, setRenameTarget] = useState<DeviceRecord | null>(null);
  const [renameName, setRenameName] = useState("");
  const [forgetTarget, setForgetTarget] = useState<DeviceRecord | null>(null);
  const [showCodeEntry, setShowCodeEntry] = useState(false);

  const refreshDevices = useCallback(() => {
    fetch(`${AGENT_BASE}/devices`)
      .then((r) => (r.ok ? r.json() : []))
      .then((devices: DeviceRecord[]) => {
        for (const d of devices) {
          if (d.endpoints && d.endpoints.length > 0) {
            ConnectionManager.registerEndpoints(
              d.device_id,
              d.endpoints.map((ep) => ({
                deviceId: d.device_id,
                transport: ep.transport as TransportKind,
                host: ep.host,
                port: ep.port,
                priority: ep.priority,
                reachable: ep.reachable,
                lastSeen: ep.last_seen || null,
                lastSuccessful: ep.last_successful || null,
                health: { latencyMs: null, failureCount: 0, lastFailure: null, successCount: 0, lastSuccess: null },
              })),
            );
          } else if (d.address) {
            ConnectionManager.registerEndpoint(d.device_id, d.address, d.last_seen);
          }
        }
        setDevices(devices);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (agentState !== "connected") return;
    fetch(`${AGENT_BASE}/pair`)
      .then((r) => {
        if (!r.ok) throw new Error("Agent error");
        return r.json();
      })
      .then(setPairInfo)
      .catch(() => {});
  }, [agentState]);

  useEffect(() => {
    if (agentState !== "connected") return;
    refreshDevices();
    const interval = setInterval(refreshDevices, 8_000);
    return () => clearInterval(interval);
  }, [agentState, refreshDevices]);

  function handleRename() {
    if (!renameTarget || !renameName.trim()) return;
    fetch(`${AGENT_BASE}/devices/${encodeURIComponent(renameTarget.device_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendly_name: renameName.trim() }),
    })
      .then(() => {
        setRenameTarget(null);
        refreshDevices();
      })
      .catch(() => {});
  }

  function handleForget() {
    if (!forgetTarget) return;
    fetch(`${AGENT_BASE}/devices/${encodeURIComponent(forgetTarget.device_id)}`, {
      method: "DELETE",
    })
      .then(() => {
        setForgetTarget(null);
        refreshDevices();
      })
      .catch(() => {});
  }

  function openBrowse(device: DeviceRecord) {
    if (device.status !== "online" || !device.address) return;
    ConnectionManager.registerEndpoint(device.device_id, device.address, device.last_seen);
    useExplorerStore.getState().browseRemoteDevice(device.device_id, device.friendly_name);
    navigate("/");
  }

  function formatDate(epoch: number): string {
    if (!epoch) return "Unknown";
    return new Date(epoch * 1000).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  function formatLastSeen(epoch: number): string {
    if (!epoch) return "Never";
    const diff = Math.floor(Date.now() / 1000) - epoch;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return formatDate(epoch);
  }

  function qualityDotColor(q: ConnectionQuality): string {
    switch (q) {
      case "excellent": return "bg-success";
      case "good": return "bg-success";
      case "fair": return "bg-warning";
      case "poor": return "bg-danger";
      case "offline": return "bg-text-tertiary";
    }
  }

  function formatLatency(device: DeviceRecord): string {
    const transport = ConnectionManager.getActiveTransport(device.device_id);
    if (!transport) return "-";
    const health = ConnectionManager.getEndpointHealth(device.device_id, transport);
    if (!health || health.latencyMs === null) return "-";
    return `${Math.round(health.latencyMs)}ms`;
  }

  function DeviceDetails({ device }: { device: DeviceRecord }) {
    const activeTransport = ConnectionManager.getActiveTransport(device.device_id);
    const quality = ConnectionManager.getConnectionQuality(device.device_id);
    const available = ConnectionManager.getAvailableTransports(device.device_id);
    const reachableCount = ConnectionManager.getReachableCount(device.device_id);
    const totalCount = ConnectionManager.getEndpointCount(device.device_id);
    const latencyText = formatLatency(device);

    return (
      <div className="grid grid-cols-5 gap-3 text-[11px] text-text-tertiary">
        <div>
          <div className="text-text-secondary font-medium mb-0.5">Transport</div>
          <div className="flex items-center gap-1">
            <span className={`inline-block h-[5px] w-[5px] rounded-full ${qualityDotColor(quality)}`} />
            {TRANSPORT_LABELS[(activeTransport || "lan") as TransportKind] || "LAN"}
          </div>
        </div>
        <div>
          <div className="text-text-secondary font-medium mb-0.5">Available</div>
          {available.length > 0
            ? available.map((ep) => TRANSPORT_LABELS[ep.transport]).join(", ")
            : `${reachableCount}/${totalCount}`}
        </div>
        <div>
          <div className="text-text-secondary font-medium mb-0.5">Latency</div>
          {latencyText}
        </div>
        <div>
          <div className="text-text-secondary font-medium mb-0.5">Paired</div>
          {formatDate(device.paired_at)}
        </div>
        <div>
          <div className="text-text-secondary font-medium mb-0.5">Version</div>
          {device.version || "Unknown"}
        </div>
      </div>
    );
  }

  const deviceIcon = (type_: string) => {
    if (type_ === "phone" || type_ === "android") {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="5" y="1" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 16h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 16h6M10 14v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[700px] mx-auto py-6 px-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-semibold text-text-primary leading-[28px]">Devices</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCodeEntry(true)}
              disabled={agentState !== "connected"}
              className="px-3 py-1.5 rounded-[4px] text-[12px] font-medium border border-border bg-surface-card text-text-primary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-[167ms]"
            >
              Enter Code
            </button>
            <button
              onClick={() => setShowPairDialog(true)}
              disabled={agentState !== "connected"}
              className="px-3 py-1.5 rounded-[4px] text-[12px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-[167ms]"
            >
              Pair Device
            </button>
          </div>
        </div>

        {/* This PC */}
        <div className="bg-surface-card rounded-[8px] border border-border-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-accent/10 flex items-center justify-center text-accent">
              {deviceIcon("desktop")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-text-primary">
                {pairInfo?.name ?? "This PC"} <span className="text-[11px] text-text-tertiary font-normal ml-1">(this device)</span>
              </div>
              <div className="text-[11px] text-text-tertiary mt-0.5">
                {pairInfo?.hint?.lan ? pairInfo.hint.lan : (pairInfo ? "Agent online" : "Agent offline")}
                {agentVersion && ` · v${agentVersion}`}
              </div>
            </div>
            <span className={`inline-block h-2 w-2 rounded-full ${
              agentState === "connected" ? "bg-success" : "bg-text-tertiary"
            }`} />
          </div>
        </div>

        {/* Paired Devices */}
        {devices.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider">
              Paired Devices
            </h2>
            {devices.map((device) => (
              <div key={device.device_id} className="bg-surface-card rounded-[8px] border border-border-card p-4 space-y-3 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-[8px] flex items-center justify-center ${
                    device.status === "online" ? "bg-success/10 text-success" : "bg-text-tertiary/10 text-text-tertiary"
                  }`}>
                    {deviceIcon(device.device_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-text-primary truncate">
                      {device.friendly_name}
                    </div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">
                      {device.platform || device.device_type} · {device.status === "online"
                        ? `${TRANSPORT_LABELS[(device.preferred_transport || "lan") as TransportKind] || "LAN"} · ${device.endpoints?.length || 1} endpoint${(device.endpoints?.length || 1) !== 1 ? "s" : ""}`
                        : `Last seen ${formatLastSeen(device.last_seen)}`}
                    </div>
                  </div>
                  <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                    device.status === "online" ? "bg-success" : "bg-text-tertiary"
                  }`} />
                </div>

                <DeviceDetails device={device} />

                <div className="flex gap-1.5 pt-2.5 border-t border-border">
                  <button
                    onClick={() => openBrowse(device)}
                    disabled={device.status !== "online"}
                    className="px-2.5 py-1 rounded-[4px] text-[11px] font-medium bg-accent/10 text-accent hover:bg-accent/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-[167ms]"
                  >
                    Browse
                  </button>
                  <button
                    onClick={() => {
                      setRenameTarget(device);
                      setRenameName(device.friendly_name);
                    }}
                    className="px-2.5 py-1 rounded-[4px] text-[11px] font-medium text-text-secondary hover:bg-surface-hover transition-all duration-[167ms] border border-border"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => setForgetTarget(device)}
                    className="px-2.5 py-1 rounded-[4px] text-[11px] font-medium text-danger hover:bg-danger/10 transition-all duration-[167ms]"
                  >
                    Forget
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {devices.length === 0 && (
          <div className="text-center py-10 text-text-tertiary">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-3 opacity-30">
              <rect x="14" y="4" width="20" height="40" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M20 38h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p className="text-[13px] font-medium text-text-secondary">No devices paired yet</p>
            <p className="text-[12px] mt-1 text-text-tertiary">Click "Pair Device" to connect a device.</p>
          </div>
        )}
      </div>

      {showPairDialog && <PairDeviceDialog onClose={() => { setShowPairDialog(false); refreshDevices(); }} />}
      {showCodeEntry && <PairCodeEntryDialog onClose={() => setShowCodeEntry(false)} onPaired={() => { refreshDevices(); }} />}

      {/* Rename Dialog */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-surface-smoke)]" onClick={() => setRenameTarget(null)}>
          <div className="bg-surface-dialog rounded-[8px] border border-border shadow-[var(--shadow-dialog)] p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-semibold text-text-primary mb-3">Rename Device</h3>
            <p className="text-[12px] text-text-tertiary mb-3">
              System name: {renameTarget.system_name}
            </p>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
              className="w-full h-8 px-3 rounded-[4px] border border-border bg-surface-input text-[13px] text-text-primary outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent)] mb-4 transition-all duration-[167ms]"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenameTarget(null)} className="h-8 px-4 rounded-[4px] text-[12px] font-medium border border-border bg-surface-card text-text-primary hover:bg-surface-hover transition-all duration-[167ms]">
                Cancel
              </button>
              <button onClick={handleRename} disabled={!renameName.trim()} className="h-8 px-4 rounded-[4px] text-[12px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:pointer-events-none transition-all duration-[167ms]">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forget Confirmation */}
      {forgetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-surface-smoke)]" onClick={() => setForgetTarget(null)}>
          <div className="bg-surface-dialog rounded-[8px] border border-border shadow-[var(--shadow-dialog)] p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-semibold text-text-primary mb-2">Forget Device</h3>
            <p className="text-[12px] text-text-secondary leading-relaxed mb-4">
              Are you sure you want to forget <strong className="text-text-primary">{forgetTarget.friendly_name}</strong>? You'll need to pair again to connect.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setForgetTarget(null)} className="h-8 px-4 rounded-[4px] text-[12px] font-medium border border-border bg-surface-card text-text-primary hover:bg-surface-hover transition-all duration-[167ms]">
                Cancel
              </button>
              <button onClick={handleForget} className="h-8 px-4 rounded-[4px] text-[12px] font-medium bg-danger text-white hover:bg-danger/90 transition-all duration-[167ms]">
                Forget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
