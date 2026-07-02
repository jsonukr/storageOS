import { useState } from "react";
import { useExplorerStore } from "@/stores/explorer";
import { useAgentStore } from "@/stores/agent";
import type { AgentConnectionState } from "@/services/agent";
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
      return "Agent Connected";
    case "connecting":
      return "Connecting...";
    case "starting":
      return "Starting Agent...";
    case "error":
      return "Agent Error";
    case "offline":
      return "Agent Offline";
  }
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
  const agentState = useAgentStore((s) => s.state);
  const agentVersion = useAgentStore((s) => s.agentVersion);
  const [showPairDialog, setShowPairDialog] = useState(false);

  const isSearchActive = searchQuery.length > 0;
  let itemText: string;
  let progressText: string | null = null;
  let durationText: string | null = null;

  if (isSearchActive) {
    if (searchLoading) {
      itemText = "Searching...";
      if (searchProgress) {
        progressText = `${formatCount(searchProgress.directories_scanned)} folders · ${formatCount(searchProgress.files_scanned)} files · ${formatCount(searchProgress.matches_found)} matches`;
      }
    } else if (searchResults !== null) {
      const count = searchResults.length;
      itemText = `${count} result${count !== 1 ? "s" : ""}`;
      if (searchDurationMs !== null) {
        durationText = `Search completed in ${formatDuration(searchDurationMs)}`;
      }
    } else {
      itemText = "Searching...";
    }
  } else {
    const itemCount = entries.length;
    itemText = loading ? "Loading..." : `${itemCount} item${itemCount !== 1 ? "s" : ""}`;
  }
  const selectionText = selectedEntries.length === 1
    ? `"${selectedEntries[0].name}" selected`
    : selectedEntries.length > 1
      ? `${selectedEntries.length} items selected`
      : null;
  const clipboardText = clipboardCount > 0
    ? `${clipboardCount} item${clipboardCount !== 1 ? "s" : ""} ${clipboardOperation === "cut" ? "cut" : "copied"}`
    : null;

  return (
    <footer className="flex h-6 items-center border-t border-border bg-statusbar px-3 text-[11px] text-text-secondary select-none">
      <div className="flex items-center gap-3">
        <StatusItem>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${agentDotColor(agentState)}`} />
          {agentLabel(agentState)}
          {agentState === "connected" && agentVersion && (
            <span className="text-text-tertiary ml-0.5">v{agentVersion}</span>
          )}
        </StatusItem>
        <StatusDivider />
        <StatusItem>Local Storage</StatusItem>
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
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              {clipboardText}
            </StatusItem>
          </>
        )}
      </div>
      <div className="flex-1" />
      {agentState === "connected" && (
        <button
          onClick={() => setShowPairDialog(true)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors mr-2"
          title="Pair mobile device"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
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
    <span className="flex items-center gap-1.5">{children}</span>
  );
}

function StatusDivider() {
  return <span className="w-px h-3 bg-border" />;
}
