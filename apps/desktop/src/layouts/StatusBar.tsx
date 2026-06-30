import { useExplorerStore } from "@/stores/explorer";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function StatusBar() {
  const entries = useExplorerStore((s) => s.entries);
  const selectedEntry = useExplorerStore((s) => s.selectedEntry);
  const loading = useExplorerStore((s) => s.loading);
  const searchQuery = useExplorerStore((s) => s.searchQuery);
  const searchResults = useExplorerStore((s) => s.searchResults);
  const searchLoading = useExplorerStore((s) => s.searchLoading);
  const searchProgress = useExplorerStore((s) => s.searchProgress);
  const searchDurationMs = useExplorerStore((s) => s.searchDurationMs);
  const clipboardCount = useExplorerStore((s) => s.clipboardCount);
  const clipboardOperation = useExplorerStore((s) => s.clipboardOperation);

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
  const selectionText = selectedEntry ? `"${selectedEntry.name}" selected` : null;
  const clipboardText = clipboardCount > 0
    ? `${clipboardCount} item${clipboardCount !== 1 ? "s" : ""} ${clipboardOperation === "cut" ? "cut" : "copied"}`
    : null;

  return (
    <footer className="flex h-6 items-center border-t border-border bg-statusbar px-3 text-[11px] text-text-secondary select-none">
      <div className="flex items-center gap-3">
        <StatusItem>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
          Ready
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
      <StatusItem>100%</StatusItem>
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
