import { useState, useEffect } from "react";
import { useExplorerStore } from "@/stores/explorer";
import { useAgentStore } from "@/stores/agent";
import type { AgentConnectionState, RelayStatus } from "@/services/agent";
import { ConnectionManager, TRANSPORT_LABELS } from "@/services/network";
import type { ConnectionQuality, TransportKind } from "@/services/network";
import { PairDeviceDialog } from "@/components/PairDeviceDialog";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function agentDotColor(state: AgentConnectionState): string {
  switch (state) {
    case "connected":
      return "bg-success";
    case "connecting":
    case "starting":
      return "bg-warning animate-pulse";
    case "error":
      return "bg-danger";
    case "offline":
      return "bg-text-tertiary";
  }
}

function agentLabel(state: AgentConnectionState): string {
  switch (state) {
    case "connected":
      return "Agent";
    case "connecting":
      return "Connecting";
    case "starting":
      return "Starting";
    case "error":
      return "Error";
    case "offline":
      return "Offline";
  }
}

function relayDotColor(status: RelayStatus): string {
  switch (status) {
    case "connected":
      return "bg-success";
    case "connecting":
      return "bg-warning animate-pulse";
    case "disconnected":
    case "failed":
      return "bg-text-tertiary";
    case "disabled":
      return "bg-text-tertiary";
  }
}

function relayLabel(status: RelayStatus): string {
  switch (status) {
    case "connected":
      return "Relay";
    case "connecting":
      return "Relay…";
    case "disconnected":
      return "Relay Off";
    case "failed":
      return "Relay Failed";
    case "disabled":
      return "Relay Off";
  }
}

function qualityDotColor(q: ConnectionQuality): string {
  switch (q) {
    case "excellent":
    case "good":
      return "bg-success";
    case "fair":
      return "bg-warning";
    case "poor":
      return "bg-danger";
    case "offline":
      return "bg-text-tertiary";
  }
}

function qualityLabel(q: ConnectionQuality): string {
  switch (q) {
    case "excellent": return "Excellent";
    case "good": return "Good";
    case "fair": return "Fair";
    case "poor": return "Poor";
    case "offline": return "Offline";
  }
}

function useConnectionUpdates(): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    return ConnectionManager.subscribe(() => setTick((t) => t + 1));
  }, []);
  return 0;
}

function getRemoteTransportLabel(): { transport: TransportKind | null; quality: ConnectionQuality } {
  const remoteDevice = useExplorerStore.getState().remoteDevice;
  if (!remoteDevice) return { transport: null, quality: "offline" };
  const transport = ConnectionManager.getActiveTransport(remoteDevice.deviceId);
  const quality = ConnectionManager.getConnectionQuality(remoteDevice.deviceId);
  return { transport, quality };
}

export function StatusBar() {
  const entries = useExplorerStore((s) => s.entries);
  const selectedEntries = useExplorerStore((s) => s.selectedEntries);
  const loading = useExplorerStore((s) => s.loading);
  const searchQuery = useExplorerStore((s) => s.searchQuery);
  const searchResults = useExplorerStore((s) => s.searchResults);
  const searchLoading = useExplorerStore((s) => s.searchLoading);
  const searchProgress = useExplorerStore((s) => s.searchProgress);
  const searchDurationMs = useExplorerStore((s) => s.searchDurationMs);
  const clipboardCount = useExplorerStore((s) => s.clipboardCount);
  const clipboardOperation = useExplorerStore((s) => s.clipboardOperation);
  const remoteDevice = useExplorerStore((s) => s.remoteDevice);
  const agentState = useAgentStore((s) => s.state);
  const agentVersion = useAgentStore((s) => s.agentVersion);
  const relayStatus = useAgentStore((s) => s.relayStatus);
  const [showPairDialog, setShowPairDialog] = useState(false);

  useConnectionUpdates();

  const { transport: remoteTransport, quality: remoteQuality } = remoteDevice
    ? getRemoteTransportLabel()
    : { transport: null, quality: "offline" as ConnectionQuality };

  const isSearchActive = searchQuery.length > 0;
  let itemText: string;
  let progressText: string | null = null;
  let durationText: string | null = null;

  if (isSearchActive) {
    if (searchLoading) {
      itemText = "Searching…";
      if (searchProgress) {
        progressText = `${formatCount(searchProgress.directories_scanned)} folders · ${formatCount(searchProgress.files_scanned)} files · ${formatCount(searchProgress.matches_found)} matches`;
      }
    } else if (searchResults !== null) {
      const count = searchResults.length;
      itemText = `${count} result${count !== 1 ? "s" : ""}`;
      if (searchDurationMs !== null) {
        durationText = formatDuration(searchDurationMs);
      }
    } else {
      itemText = "Searching…";
    }
  } else {
    const itemCount = entries.length;
    itemText = loading ? "Loading…" : `${itemCount} item${itemCount !== 1 ? "s" : ""}`;
  }
  const selectionText = selectedEntries.length === 1
    ? `"${selectedEntries[0].name}"`
    : selectedEntries.length > 1
      ? `${selectedEntries.length} selected`
      : null;
  const clipboardText = clipboardCount > 0
    ? `${clipboardCount} ${clipboardOperation === "cut" ? "cut" : "copied"}`
    : null;

  const transportLabel = remoteDevice && remoteTransport
    ? TRANSPORT_LABELS[remoteTransport]
    : agentState === "connected"
      ? "LAN"
      : "";

  return (
    <footer className="flex h-[22px] items-center border-t border-border bg-statusbar px-2.5 text-[11px] text-text-secondary select-none" role="status">
      <div className="flex items-center gap-2.5">
        <StatusItem>
          <span className={`inline-block h-[5px] w-[5px] rounded-full ${agentDotColor(agentState)}`} title={agentLabel(agentState)} />
          {agentLabel(agentState)}
          {agentState === "connected" && agentVersion && (
            <span className="text-text-tertiary">v{agentVersion}</span>
          )}
        </StatusItem>
        {transportLabel && (
          <>
            <StatusDivider />
            <StatusItem>
              {transportLabel}
              {remoteDevice && remoteQuality !== "offline" && (
                <span
                  className={`inline-block h-[5px] w-[5px] rounded-full ${qualityDotColor(remoteQuality)}`}
                  title={qualityLabel(remoteQuality)}
                />
              )}
            </StatusItem>
          </>
        )}
        {relayStatus !== "disabled" && (
          <>
            <StatusDivider />
            <StatusItem>
              <span className={`inline-block h-[5px] w-[5px] rounded-full ${relayDotColor(relayStatus)}`} title={relayLabel(relayStatus)} />
              {relayLabel(relayStatus)}
            </StatusItem>
          </>
        )}
        <StatusDivider />
        <StatusItem>{itemText}</StatusItem>
        {progressText && (
          <>
            <StatusDivider />
            <StatusItem>{progressText}</StatusItem>
          </>
        )}
        {durationText && (
          <>
            <StatusDivider />
            <StatusItem>{durationText}</StatusItem>
          </>
        )}
        {selectionText && (
          <>
            <StatusDivider />
            <StatusItem>{selectionText}</StatusItem>
          </>
        )}
        {clipboardText && (
          <>
            <StatusDivider />
            <StatusItem>
              <span className="inline-block h-[5px] w-[5px] rounded-full bg-accent" />
              {clipboardText}
            </StatusItem>
          </>
        )}
      </div>
      <div className="flex-1" />
      {agentState === "connected" && (
        <button
          onClick={() => setShowPairDialog(true)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[11px] text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all duration-[83ms] mr-1.5"
          title="Pair mobile device"
          aria-label="Pair mobile device"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="3" y="0.5" width="6" height="11" rx="1" stroke="currentColor" strokeWidth="0.9" />
            <path d="M5 9.5h2" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
          </svg>
          Pair
        </button>
      )}
      <StatusItem>100%</StatusItem>
      {showPairDialog && <PairDeviceDialog onClose={() => setShowPairDialog(false)} />}
    </footer>
  );
}

function StatusItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">{children}</span>
  );
}

function StatusDivider() {
  return <span className="w-px h-2.5 bg-border" aria-hidden="true" />;
}
