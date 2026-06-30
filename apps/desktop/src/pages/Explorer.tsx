import { useCallback, useState, useRef, useEffect } from "react";
import { useExplorerStore, getParentPath } from "../stores/explorer";
import { useTransferStore } from "../stores/transfer";
import { NavigationPanel } from "../components/NavigationPanel";
import { PropertiesPanel } from "../components/PropertiesPanel";
import { ResizeHandle } from "../components/ResizeHandle";
import type { DirectoryEntry } from "@/lib/tauri";


const NAV_MIN = 180;
const NAV_MAX = 360;
const PROP_MIN = 200;
const PROP_MAX = 400;

export default function Explorer() {
  const viewMode = useExplorerStore((s) => s.viewMode);
  const setViewMode = useExplorerStore((s) => s.setViewMode);
  const navPanelWidth = useExplorerStore((s) => s.navPanelWidth);
  const setNavPanelWidth = useExplorerStore((s) => s.setNavPanelWidth);
  const propertiesOpen = useExplorerStore((s) => s.propertiesOpen);
  const toggleProperties = useExplorerStore((s) => s.toggleProperties);
  const propertiesWidth = useExplorerStore((s) => s.propertiesWidth);
  const setPropertiesWidth = useExplorerStore((s) => s.setPropertiesWidth);

  const onNavResize = useCallback(
    (delta: number) => {
      setNavPanelWidth(Math.min(NAV_MAX, Math.max(NAV_MIN, navPanelWidth + delta)));
    },
    [navPanelWidth, setNavPanelWidth],
  );

  const onPropResize = useCallback(
    (delta: number) => {
      setPropertiesWidth(Math.min(PROP_MAX, Math.max(PROP_MIN, propertiesWidth + delta)));
    },
    [propertiesWidth, setPropertiesWidth],
  );

  const goBack = useExplorerStore((s) => s.goBack);
  const goForward = useExplorerStore((s) => s.goForward);
  const goUp = useExplorerStore((s) => s.goUp);
  const refresh = useExplorerStore((s) => s.refresh);
  const currentPath = useExplorerStore((s) => s.currentPath);
  const historyStack = useExplorerStore((s) => s.historyStack);
  const forwardStack = useExplorerStore((s) => s.forwardStack);

  const canGoBack = historyStack.length > 0;
  const canGoForward = forwardStack.length > 0;
  const canGoUp = currentPath !== null && getParentPath(currentPath) !== null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const state = useExplorerStore.getState();

      if (e.key === "Delete") {
        if (state.selectedEntry && !state.deleteTarget) {
          e.preventDefault();
          state.confirmDelete(state.selectedEntry);
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "c") {
        if (state.selectedEntry) {
          e.preventDefault();
          state.copyEntries([state.selectedEntry]);
        }
      } else if (e.key === "x") {
        if (state.selectedEntry) {
          e.preventDefault();
          state.cutEntries([state.selectedEntry]);
        }
      } else if (e.key === "v") {
        if (state.currentPath) {
          e.preventDefault();
          state.pasteEntries();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <Notification />
      <TransferProgressOverlay />
      <InsufficientSpaceDialog />
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 border-b border-border bg-toolbar px-2 py-1">
        {/* Navigation */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton label="Back" disabled={!canGoBack} onClick={goBack}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Forward" disabled={!canGoForward} onClick={goForward}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Up" disabled={!canGoUp} onClick={goUp}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Refresh" disabled={currentPath === null} onClick={refresh}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11.5 7A4.5 4.5 0 112.5 7M2.5 3v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton label="New Folder" disabled={currentPath === null} onClick={() => useExplorerStore.getState().openNewFolderDialog()}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 3.5C1.5 2.95 1.95 2.5 2.5 2.5H5.5l1 1H11.5c.55 0 1 .45 1 1V10.5c0 .55-.45 1-1 1H2.5c-.55 0-1-.45-1-1V3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M7 6v4M5 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Upload">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 9V3M4.5 5.5L7 3l2.5 2.5M2.5 10v1.5h9V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Download" disabled>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 3v6M4.5 6.5L7 9l2.5-2.5M2.5 10v1.5h9V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* View */}
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <ViewToggle active={viewMode === "grid"} label="Grid view" onClick={() => setViewMode("grid")}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1.5" y="1.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
              <rect x="7.5" y="1.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
              <rect x="1.5" y="7.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
              <rect x="7.5" y="7.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </ViewToggle>
          <ViewToggle active={viewMode === "list"} label="List view" onClick={() => setViewMode("list")}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1.5 3.5h10M1.5 6.5h10M1.5 9.5h10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </ViewToggle>
          <ViewToggle active={viewMode === "details"} label="Details view" onClick={() => setViewMode("details")}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1.5 3.5h4M1.5 6.5h4M1.5 9.5h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M7.5 3.5h4M7.5 6.5h4M7.5 9.5h4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
            </svg>
          </ViewToggle>
        </div>

        <ToolbarDivider />

        {/* More */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton label="Sort">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M4 7h6M6 10h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Filter">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 2.5h11l-4 5v3.5l-3 1.5V7.5l-4-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Properties" onClick={toggleProperties}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </ToolbarButton>
        </div>
      </div>

      {/* ── Address Bar ── */}
      <AddressBar />

      {/* ── Three-panel content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Navigation Panel */}
        <div
          className="flex-shrink-0 border-r border-border bg-surface-secondary overflow-hidden"
          style={{ width: navPanelWidth }}
        >
          <NavigationPanel />
        </div>
        <ResizeHandle onResize={onNavResize} direction="right" />

        {/* Center: File Area */}
        <FileArea viewMode={viewMode} />

        {/* Right: Properties Panel */}
        {propertiesOpen && (
          <>
            <ResizeHandle onResize={onPropResize} direction="left" />
            <div
              className="flex-shrink-0 border-l border-border bg-surface-secondary overflow-hidden"
              style={{ width: propertiesWidth }}
            >
              <PropertiesPanel />
            </div>
          </>
        )}
      </div>

      {/* Overlays */}
      <NewFolderDialog />
      <RenameDialog />
      <DeleteConfirmDialog />
      <PasteConflictDialog />
      <ContextMenu />
    </div>
  );
}

// ── Address Bar ──

function parseBreadcrumbs(path: string): { label: string; path: string }[] {
  const normalized = path.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  const crumbs: { label: string; path: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i];
    if (i === 0 && /^[A-Za-z]:$/.test(segment)) {
      crumbs.push({ label: segment + "\\", path: segment + "\\" });
    } else {
      const fullPath = crumbs.length > 0
        ? crumbs[crumbs.length - 1].path.replace(/\\$/, "") + "\\" + segment
        : segment;
      crumbs.push({ label: segment, path: fullPath });
    }
  }
  return crumbs;
}

function AddressBar() {
  const currentPath = useExplorerStore((s) => s.currentPath);
  const navigateTo = useExplorerStore((s) => s.navigateTo);
  const refresh = useExplorerStore((s) => s.refresh);

  const crumbs = currentPath !== null ? parseBreadcrumbs(currentPath) : [];

  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-toolbar px-2 py-1">
      <div className="flex items-center flex-1 h-7 rounded-md border border-border bg-surface px-1.5 gap-0.5 text-[12px] overflow-hidden">
        <BreadcrumbItem
          label="This PC"
          first
          active={currentPath === null}
        />
        {crumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-0.5 shrink-0">
            <BreadcrumbSep />
            <BreadcrumbItem
              label={crumb.label}
              active={i === crumbs.length - 1}
              onClick={i < crumbs.length - 1 ? () => navigateTo(crumb.path) : undefined}
            />
          </span>
        ))}
      </div>
      <button
        className="rounded-md p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors disabled:opacity-35 disabled:pointer-events-none"
        aria-label="Refresh"
        title="Refresh"
        disabled={currentPath === null}
        onClick={refresh}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M11.5 7A4.5 4.5 0 112.5 7M2.5 3v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// ── File Area ──

function FileArea({ viewMode }: { viewMode: string }) {
  const entries = useExplorerStore((s) => s.entries);
  const loading = useExplorerStore((s) => s.loading);
  const error = useExplorerStore((s) => s.error);
  const currentPath = useExplorerStore((s) => s.currentPath);
  const selectEntry = useExplorerStore((s) => s.selectEntry);
  const showContextMenu = useExplorerStore((s) => s.showContextMenu);
  const hideContextMenu = useExplorerStore((s) => s.hideContextMenu);

  const searchQuery = useExplorerStore((s) => s.searchQuery);
  const searchResults = useExplorerStore((s) => s.searchResults);
  const searchError = useExplorerStore((s) => s.searchError);

  const isSearchActive = searchQuery.length > 0;

  const handleBackgroundContext = (e: React.MouseEvent) => {
    e.preventDefault();
    selectEntry(null);
    showContextMenu(e.clientX, e.clientY, null);
  };

  const renderContent = () => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} />;
    if (currentPath === null) return <WelcomeState />;

    if (isSearchActive) {
      if (searchError) return <ErrorState message={searchError} />;
      if (searchResults !== null && searchResults.length === 0) return <NoResultsState query={searchQuery} />;
      if (searchResults !== null) {
        return viewMode === "details"
          ? <DetailsView entries={searchResults} />
          : <GridView entries={searchResults} />;
      }
    }

    if (entries.length === 0) return <EmptyState />;
    return viewMode === "details"
      ? <DetailsView entries={entries} />
      : <GridView entries={entries} />;
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-surface min-w-0"
      onClick={() => { selectEntry(null); hideContextMenu(); }}
      onContextMenu={handleBackgroundContext}
    >
      {viewMode === "details" && (
        <div className="flex items-center h-7 border-b border-border-subtle px-3 text-[11px] font-medium text-text-tertiary select-none bg-surface-secondary">
          <span className="flex-1 min-w-0">Name</span>
          <span className="w-32 text-right shrink-0">Date Modified</span>
          <span className="w-20 text-right shrink-0">Type</span>
          <span className="w-20 text-right shrink-0">Size</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-2">
        <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px] text-text-secondary">Loading...</span>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="flex flex-col items-center text-center px-6 max-w-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-danger">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" />
            <path d="M12 8v5M12 15.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-[13px] font-semibold text-text-primary mb-1">
          Cannot access folder
        </h2>
        <p className="text-[12px] text-text-secondary leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}

function WelcomeState() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="flex flex-col items-center text-center px-6 max-w-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
            <path d="M3 6.5C3 5.12 4.12 4 5.5 4H9.5L12 6.5H18.5C19.88 6.5 21 7.62 21 9V18c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 20.5 3 19.38 3 18V6.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-[13px] font-semibold text-text-primary mb-1">
          Select a drive
        </h2>
        <p className="text-[12px] text-text-secondary leading-relaxed">
          Click a drive in the navigation panel to browse its contents.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="flex flex-col items-center text-center px-6 max-w-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
            <path d="M3 6.5C3 5.12 4.12 4 5.5 4H9.5L12 6.5H18.5C19.88 6.5 21 7.62 21 9V18c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 20.5 3 19.38 3 18V6.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-[13px] font-semibold text-text-primary mb-1">
          This folder is empty
        </h2>
        <p className="text-[12px] text-text-secondary leading-relaxed">
          There are no files or folders in this directory.
        </p>
      </div>
    </div>
  );
}

function NoResultsState({ query }: { query: string }) {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="flex flex-col items-center text-center px-6 max-w-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
            <circle cx="10.5" cy="10.5" r="7.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-[13px] font-semibold text-text-primary mb-1">
          No results
        </h2>
        <p className="text-[12px] text-text-secondary leading-relaxed">
          No files or folders matching "{query}" were found.
        </p>
      </div>
    </div>
  );
}

function DetailsView({ entries }: { entries: DirectoryEntry[] }) {
  const selectedEntry = useExplorerStore((s) => s.selectedEntry);
  const selectEntry = useExplorerStore((s) => s.selectEntry);
  const openEntry = useExplorerStore((s) => s.openEntry);
  const showContextMenu = useExplorerStore((s) => s.showContextMenu);

  return (
    <div className="text-[12px]">
      {entries.map((entry) => {
        const isSelected = selectedEntry?.full_path === entry.full_path;
        return (
          <div
            key={entry.full_path}
            onClick={(e) => { e.stopPropagation(); selectEntry(entry); }}
            onDoubleClick={() => openEntry(entry)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); selectEntry(entry); showContextMenu(e.clientX, e.clientY, entry); }}
            className={`flex items-center h-[26px] px-3 transition-colors cursor-default select-none border-b border-transparent ${
              isSelected
                ? "bg-accent/10 border-accent/20"
                : "hover:bg-surface-hover hover:border-border-subtle"
            }`}
          >
            <span className="flex items-center gap-1.5 flex-1 min-w-0">
              <FileIcon entry={entry} />
              <span className={`truncate ${entry.hidden ? "opacity-50" : ""}`}>
                {entry.name}
              </span>
            </span>
            <span className="w-32 text-right text-text-tertiary shrink-0">
              {formatDate(entry.last_modified)}
            </span>
            <span className="w-20 text-right text-text-tertiary shrink-0">
              {entry.is_directory ? "Folder" : formatExtension(entry.extension)}
            </span>
            <span className="w-20 text-right text-text-tertiary shrink-0">
              {entry.is_directory ? "" : formatSize(entry.size)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GridView({ entries }: { entries: DirectoryEntry[] }) {
  const selectedEntry = useExplorerStore((s) => s.selectedEntry);
  const selectEntry = useExplorerStore((s) => s.selectEntry);
  const openEntry = useExplorerStore((s) => s.openEntry);
  const showContextMenu = useExplorerStore((s) => s.showContextMenu);

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-1 p-2">
      {entries.map((entry) => {
        const isSelected = selectedEntry?.full_path === entry.full_path;
        return (
          <div
            key={entry.full_path}
            onClick={(e) => { e.stopPropagation(); selectEntry(entry); }}
            onDoubleClick={() => openEntry(entry)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); selectEntry(entry); showContextMenu(e.clientX, e.clientY, entry); }}
            className={`flex flex-col items-center gap-1 p-2 rounded-md transition-colors cursor-default select-none ${
              entry.hidden ? "opacity-50" : ""
            } ${
              isSelected
                ? "bg-accent/10 ring-1 ring-accent/30"
                : "hover:bg-surface-hover"
            }`}
          >
            <GridFileIcon entry={entry} />
            <span className="text-[11px] text-text-primary text-center leading-tight line-clamp-2 w-full break-all">
              {entry.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FileIcon({ entry }: { entry: DirectoryEntry }) {
  if (entry.is_directory) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-warning">
        <path d="M1.5 3.5C1.5 2.95 1.95 2.5 2.5 2.5H5.5l1 1H11.5c.55 0 1 .45 1 1V10.5c0 .55-.45 1-1 1H2.5c-.55 0-1-.45-1-1V3.5Z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-text-tertiary">
      <path d="M3.5 1.5h5l3 3V11.5a1 1 0 01-1 1h-7a1 1 0 01-1-1v-9a1 1 0 011-1z" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M8.5 1.5V4.5h3" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}

function GridFileIcon({ entry }: { entry: DirectoryEntry }) {
  if (entry.is_directory) {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-warning">
        <path d="M3 8C3 6.9 3.9 6 5 6h7l2 2h11c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V8z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-text-tertiary">
      <path d="M8 4h10l6 6v16a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      <path d="M18 4v6h6" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function formatDate(timestamp: number): string {
  if (timestamp === 0) return "";
  const d = new Date(timestamp * 1000);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day}/${year} ${hours}:${mins}`;
}

function formatExtension(ext: string): string {
  return ext ? `.${ext.toUpperCase()}` : "File";
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

// ── Dialogs & Context Menu ──

function NewFolderDialog() {
  const [name, setName] = useState("New Folder");
  const open = useExplorerStore((s) => s.newFolderDialogOpen);
  const close = useExplorerStore((s) => s.closeNewFolderDialog);
  const create = useExplorerStore((s) => s.createFolder);
  const operationLoading = useExplorerStore((s) => s.operationLoading);
  const operationError = useExplorerStore((s) => s.operationError);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("New Folder");
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) create(name.trim());
  };

  return (
    <DialogOverlay onClose={close}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-text-primary">New Folder</h3>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 rounded-md border border-border bg-surface px-2.5 text-[12px] text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          disabled={operationLoading}
        />
        {operationError && (
          <p className="text-[11px] text-danger">{operationError}</p>
        )}
        <div className="flex justify-end gap-2">
          <DialogButton onClick={close} disabled={operationLoading}>Cancel</DialogButton>
          <DialogButton primary type="submit" disabled={operationLoading || !name.trim()}>
            {operationLoading ? "Creating..." : "Create"}
          </DialogButton>
        </div>
      </form>
    </DialogOverlay>
  );
}

function RenameDialog() {
  const target = useExplorerStore((s) => s.renameTarget);
  const cancel = useExplorerStore((s) => s.cancelRename);
  const rename = useExplorerStore((s) => s.renameEntry);
  const operationLoading = useExplorerStore((s) => s.operationLoading);
  const operationError = useExplorerStore((s) => s.operationError);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (target) {
      setNewName(target.name);
      setTimeout(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        const dotIndex = target.name.lastIndexOf(".");
        if (!target.is_directory && dotIndex > 0) {
          input.setSelectionRange(0, dotIndex);
        } else {
          input.select();
        }
      }, 0);
    }
  }, [target]);

  if (!target) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (trimmed && trimmed !== target.name) rename(target, trimmed);
  };

  return (
    <DialogOverlay onClose={cancel}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-text-primary">Rename</h3>
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-8 rounded-md border border-border bg-surface px-2.5 text-[12px] text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          disabled={operationLoading}
        />
        {operationError && (
          <p className="text-[11px] text-danger">{operationError}</p>
        )}
        <div className="flex justify-end gap-2">
          <DialogButton onClick={cancel} disabled={operationLoading}>Cancel</DialogButton>
          <DialogButton primary type="submit" disabled={operationLoading || !newName.trim() || newName.trim() === target.name}>
            {operationLoading ? "Renaming..." : "Rename"}
          </DialogButton>
        </div>
      </form>
    </DialogOverlay>
  );
}

function DeleteConfirmDialog() {
  const target = useExplorerStore((s) => s.deleteTarget);
  const cancel = useExplorerStore((s) => s.cancelDelete);
  const doDelete = useExplorerStore((s) => s.deleteEntry);
  const operationLoading = useExplorerStore((s) => s.operationLoading);
  const operationError = useExplorerStore((s) => s.operationError);

  if (!target) return null;

  return (
    <DialogOverlay onClose={cancel}>
      <div className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-text-primary">Delete</h3>
        <p className="text-[12px] text-text-secondary leading-relaxed">
          Are you sure you want to permanently delete <strong className="text-text-primary">"{target.name}"</strong>?
          {target.is_directory && " This will delete all contents inside the folder."}
          {" "}This action cannot be undone.
        </p>
        {operationError && (
          <p className="text-[11px] text-danger">{operationError}</p>
        )}
        <div className="flex justify-end gap-2">
          <DialogButton onClick={cancel} disabled={operationLoading}>Cancel</DialogButton>
          <DialogButton danger onClick={() => doDelete(target)} disabled={operationLoading}>
            {operationLoading ? "Deleting..." : "Delete"}
          </DialogButton>
        </div>
      </div>
    </DialogOverlay>
  );
}

function PasteConflictDialog() {
  const conflict = useExplorerStore((s) => s.pasteConflict);
  const resolve = useExplorerStore((s) => s.resolvePasteConflict);
  const [hovered, setHovered] = useState<string | null>(null);

  if (!conflict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-[500px] overflow-hidden rounded-lg"
        style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.35)", border: "1.5px solid #6b1a23" }}
      >
        {/* ── Title bar — maroon to match banner ── */}
        <div className="flex items-center h-[32px]" style={{ background: "#501318" }}>
          <div className="flex items-center gap-2 pl-3 flex-1 min-w-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <circle cx="8" cy="8" r="7" fill="#d4760a" />
              <path d="M5.5 8l2 2.5 3-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11.5px] text-white/90 truncate">Replace or Skip Files</span>
          </div>
          <div className="flex items-center h-full">
            <button className="flex items-center justify-center w-[46px] h-full text-white/50 hover:bg-white/10 transition-colors">
              <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
            </button>
            <button className="flex items-center justify-center w-[46px] h-full text-white/50 hover:bg-white/10 transition-colors">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" /></svg>
            </button>
            <button
              onClick={() => resolve("cancel")}
              className="flex items-center justify-center w-[46px] h-full text-white/50 hover:bg-[#c42b1c] hover:text-white transition-colors rounded-tr-lg"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Info section — light bg, dark text like Windows ── */}
        <div className="px-5 pt-3.5 pb-3 bg-surface">
          <p className="text-[11.5px] text-text-tertiary mb-1" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            Pasting to current folder
          </p>
          <p className="text-[14px] font-semibold text-text-primary leading-snug" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            The destination has a file named "{conflict.fileName}"
          </p>
        </div>

        {/* ── Options — subtle pale blue highlight like Windows ── */}
        <div className="bg-surface pb-1 px-2">
          <button
            onClick={() => resolve("replace")}
            onMouseEnter={() => setHovered("replace")}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-3 w-full text-left px-4 py-[10px] rounded-[3px] transition-colors"
            style={{ background: hovered === null || hovered === "replace" ? "var(--color-accent-subtle, #cce8ff)" : "transparent" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <circle cx="8" cy="8" r="7.5" fill="#16a34a" />
              <path d="M4.5 8l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[13px] font-medium text-text-primary" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              Replace the file in the destination
            </span>
          </button>

          <button
            onClick={() => resolve("cancel")}
            onMouseEnter={() => setHovered("skip")}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-3 w-full text-left px-4 py-[10px] rounded-[3px] transition-colors"
            style={{ background: hovered === "skip" ? "var(--color-accent-subtle, #cce8ff)" : "transparent" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <path d="M4 8.5a5 5 0 014.5-4.5" stroke="#d9a012" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M7 2l2 2-2 2" stroke="#d9a012" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 7.5a5 5 0 01-4.5 4.5" stroke="#d9a012" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M9 14l-2-2 2-2" stroke="#d9a012" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[13px] font-medium text-text-primary" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              Skip this file
            </span>
          </button>

          <button
            onClick={() => resolve("keep_both")}
            onMouseEnter={() => setHovered("keep")}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-3 w-full text-left px-4 py-[10px] rounded-[3px] transition-colors"
            style={{ background: hovered === "keep" ? "var(--color-accent-subtle, #cce8ff)" : "transparent" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <rect x="0.5" y="3" width="9" height="11" rx="1" fill="#3b82f6" stroke="#2563eb" strokeWidth="0.5" />
              <rect x="5.5" y="2" width="9" height="11" rx="1" fill="#60a5fa" stroke="#3b82f6" strokeWidth="0.5" />
            </svg>
            <span className="text-[13px] font-medium text-text-primary" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              Keep both files
            </span>
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center h-[36px] px-5 bg-surface border-t border-border">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="mr-1.5">
            <path d="M1 5l4-4 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary" />
          </svg>
          <span className="text-[11px] text-text-tertiary" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>Fewer details</span>
        </div>
      </div>
    </div>
  );
}

function Notification() {
  const notification = useExplorerStore((s) => s.notification);
  const clearNotification = useExplorerStore((s) => s.clearNotification);

  const isError = notification?.includes("Not enough") || notification?.includes("failed") || notification?.includes("Failed");

  useEffect(() => {
    if (!notification) return;
    if (notification.includes("Copying") || notification.includes("Moving")) {
      clearNotification();
      return;
    }
    if (isError) return;
    const timer = setTimeout(clearNotification, 3000);
    return () => clearTimeout(timer);
  }, [notification, clearNotification, isError]);

  if (!notification || notification.includes("Copying") || notification.includes("Moving")) return null;

  return (
    <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-lg text-[12px] font-medium shadow-lg ${
      isError
        ? "bg-[#442222] border border-danger text-danger"
        : "bg-surface border border-border text-text-primary"
    }`}>
      {notification}
      {isError && (
        <button
          onClick={clearNotification}
          className="p-0.5 rounded hover:bg-white/10 text-danger/70 hover:text-danger transition-colors"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function InsufficientSpaceDialog() {
  const spaceError = useExplorerStore((s) => s.spaceError);
  const dismiss = useExplorerStore((s) => s.dismissSpaceError);
  const retry = useExplorerStore((s) => s.retrySpaceError);
  const [driveInfo, setDriveInfo] = useState<{ label: string; free: number; total: number } | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    if (!spaceError) { setDriveInfo(null); return; }
    import("@/lib/tauri").then(({ listDrives }) =>
      listDrives().then((drives) => {
        const destRoot = spaceError.destination.slice(0, 3);
        const drive = drives.find((d) => destRoot.toUpperCase().startsWith(d.letter.toUpperCase()));
        if (drive) {
          setDriveInfo({
            label: drive.label || "Local Disk",
            free: drive.free_bytes,
            total: drive.total_bytes,
          });
        }
      }),
    );
  }, [spaceError]);

  if (!spaceError) return null;

  const needMatch = spaceError.error.match(/Need ([\d.]+ \w+) but only ([\d.]+ \w+)/);
  const needText = needMatch?.[1] ?? "more space";
  const availText = needMatch?.[2] ?? "unknown";
  const driveLetter = spaceError.destination.slice(0, 2);
  const driveLabel = driveInfo?.label || "Local Disk";
  const displayName = driveLabel === "Local Disk" ? `${driveLabel} (${driveLetter})` : `${driveLabel} (${driveLetter})`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto w-[460px] rounded-lg overflow-hidden shadow-2xl border border-[#5a1520]"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>

        {/* Maroon title bar */}
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#6b1a2a" }}>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-white/80">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] text-white/90 font-normal">1 Interrupted Action</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors" aria-label="Minimize">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" /></svg>
            </button>
            <button onClick={dismiss} className="p-1 rounded hover:bg-red-500 text-white/70 hover:text-white transition-colors" aria-label="Close">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-surface">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[13px] text-text-primary">
              There is not enough space on {displayName}. You need an additional {needText} to copy these files.
            </p>
          </div>

          {showDetails && driveInfo && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-secondary border border-border">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="shrink-0 text-text-tertiary">
                  <rect x="3" y="8" width="26" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="5" y="10" width="18" height="12" rx="1" fill="currentColor" opacity="0.15" />
                  <rect x="24" y="14" width="3" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
                </svg>
                <div>
                  <p className="text-[12px] text-text-primary font-medium">{displayName}</p>
                  <p className="text-[11px] text-text-secondary">Space free: {formatProgressBytes(driveInfo.free)}</p>
                  <p className="text-[11px] text-text-secondary">Total size: {formatProgressBytes(driveInfo.total)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 px-4 pb-3">
            <button
              onClick={retry}
              className="px-5 py-1.5 text-[12px] font-medium rounded bg-surface-secondary border border-border text-text-primary hover:bg-surface-hover transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={dismiss}
              className="px-5 py-1.5 text-[12px] font-medium rounded bg-surface-secondary border border-border text-text-primary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Toggle details */}
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 px-4 py-2 w-full text-[12px] text-text-secondary hover:text-text-primary border-t border-border hover:bg-surface-hover transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`transition-transform duration-150 ${showDetails ? "" : "rotate-180"}`}>
              <path d="M2 6.5L5 3.5 8 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {showDetails ? "Fewer details" : "More details"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatProgressBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getLastSegment(path: string): string {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function TransferProgressOverlay() {
  const jobs = useTransferStore((s) => s.jobs);
  const clearCompleted = useTransferStore((s) => s.clearCompleted);
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  const activeJobs = jobs.filter(
    (j) => j.status === "running" || j.status === "preparing",
  );

  const hasActive = activeJobs.length > 0;

  useEffect(() => {
    if (hasActive) setDismissed(false);
  }, [hasActive]);

  if (activeJobs.length === 0 || dismissed) return null;

  const totalBytes = activeJobs.reduce((sum, j) => sum + j.totalBytes, 0);
  const transferred = activeJobs.reduce((sum, j) => sum + j.bytesTransferred, 0);
  const totalSpeed = activeJobs.reduce((sum, j) => sum + j.speed, 0);
  const overallProgress = totalBytes > 0 ? (transferred / totalBytes) * 100 : 0;
  const progressPct = Math.round(overallProgress);

  const remaining = totalBytes - transferred;
  const etaSeconds = totalSpeed > 0 ? remaining / totalSpeed : 0;
  const etaText =
    totalSpeed <= 0
      ? "Calculating..."
      : etaSeconds < 60
        ? `About ${Math.ceil(etaSeconds)} seconds remaining`
        : etaSeconds < 3600
          ? `About ${Math.ceil(etaSeconds / 60)} minutes remaining`
          : `About ${Math.floor(etaSeconds / 3600)}h ${Math.ceil((etaSeconds % 3600) / 60)}m remaining`;

  const currentJob = activeJobs[0];
  const operationType = currentJob.type === "move" ? "Moving" : "Copying";
  const sourceName = getLastSegment(currentJob.source);
  const destName = getLastSegment(currentJob.destination);
  const itemsRemaining = activeJobs.length;
  const remainingBytes = activeJobs.reduce((sum, j) => sum + (j.totalBytes - j.bytesTransferred), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto w-[480px] rounded-lg overflow-hidden shadow-2xl border border-[#5a1520]"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>

        {/* ── Maroon title bar ── */}
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#6b1a2a" }}>
          <span className="text-[11px] text-white/90 font-normal">{progressPct}% complete</span>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors" aria-label="Minimize">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" /></svg>
            </button>
            <button
              onClick={() => { setDismissed(true); clearCompleted(); }}
              className="p-1 rounded hover:bg-red-500 text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* ── Content area ── */}
        <div className="bg-surface">
          {/* Header: operation description */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-text-primary">
                {operationType} {activeJobs.length} item{activeJobs.length !== 1 ? "s" : ""} from{" "}
                <span className="font-semibold">{sourceName}</span> to{" "}
                <span className="font-semibold">{destName}</span>
              </p>
              <p className="text-[13px] text-text-primary mt-0.5">{progressPct}% complete</p>
            </div>
            <div className="flex items-center gap-1 ml-3 shrink-0">
              {/* Pause button (visual only — not wired yet) */}
              <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors" aria-label="Pause" title="Pause">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M5 3h2v10H5zM9 3h2v10H9z" fill="currentColor" />
                </svg>
              </button>
              {/* Cancel button */}
              <button
                onClick={() => { setDismissed(true); clearCompleted(); }}
                className="p-1.5 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Cancel" title="Cancel"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-4 pb-3">
            <div className="h-[6px] bg-border rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#0078d4] transition-all duration-300"
                style={{ width: `${Math.min(overallProgress, 100)}%` }}
              />
            </div>

            {/* Speed (right aligned) */}
            <div className="flex justify-end mt-1.5">
              <span className="text-[12px] text-text-secondary">
                Speed: {totalSpeed > 0 ? `${formatProgressBytes(totalSpeed)}/s` : "—"}
              </span>
            </div>
          </div>

          {/* Details section */}
          {showDetails && (
            <div className="px-4 pb-3 space-y-0.5">
              <p className="text-[12px] text-text-secondary">
                Name: <span className="text-text-primary">{currentJob.name}</span>
              </p>
              <p className="text-[12px] text-text-secondary">
                Time remaining: <span className="text-text-primary">{etaText}</span>
              </p>
              <p className="text-[12px] text-text-secondary">
                Items remaining: <span className="text-text-primary">{itemsRemaining} ({formatProgressBytes(remainingBytes)})</span>
              </p>
            </div>
          )}

          {/* Toggle details */}
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 px-4 py-2 w-full text-[12px] text-text-secondary hover:text-text-primary border-t border-border hover:bg-surface-hover transition-colors"
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`transition-transform duration-150 ${showDetails ? "" : "rotate-180"}`}
            >
              <path d="M2 6.5L5 3.5 8 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {showDetails ? "Fewer details" : "More details"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextMenu() {
  const ctx = useExplorerStore((s) => s.contextMenu);
  const hide = useExplorerStore((s) => s.hideContextMenu);
  const startRename = useExplorerStore((s) => s.startRename);
  const confirmDelete = useExplorerStore((s) => s.confirmDelete);
  const openNewFolderDialog = useExplorerStore((s) => s.openNewFolderDialog);
  const openEntry = useExplorerStore((s) => s.openEntry);
  const copyEntries = useExplorerStore((s) => s.copyEntries);
  const cutEntries = useExplorerStore((s) => s.cutEntries);
  const pasteEntries = useExplorerStore((s) => s.pasteEntries);
  const clipboardCount = useExplorerStore((s) => s.clipboardCount);
  const currentPath = useExplorerStore((s) => s.currentPath);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctx) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) hide();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctx, hide]);

  if (!ctx) return null;

  const { x, y, entry } = ctx;
  const canPaste = clipboardCount > 0 && currentPath !== null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-surface shadow-lg py-1 text-[12px]"
      style={{ left: x, top: y }}
    >
      {entry ? (
        <>
          {entry.is_directory && (
            <ContextMenuItem
              label="Open"
              onAction={() => { openEntry(entry); hide(); }}
            />
          )}
          <ContextMenuDivider />
          <ContextMenuItem
            label="Copy"
            onAction={() => { copyEntries([entry]); hide(); }}
          />
          <ContextMenuItem
            label="Cut"
            onAction={() => { cutEntries([entry]); hide(); }}
          />
          <ContextMenuItem
            label="Paste"
            disabled={!canPaste}
            onAction={() => { pasteEntries(); hide(); }}
          />
          <ContextMenuDivider />
          <ContextMenuItem
            label="Rename"
            onAction={() => { startRename(entry); hide(); }}
          />
          <ContextMenuDivider />
          <ContextMenuItem
            label="Delete"
            danger
            onAction={() => { confirmDelete(entry); hide(); }}
          />
        </>
      ) : (
        <>
          <ContextMenuItem
            label="New Folder"
            onAction={() => { openNewFolderDialog(); hide(); }}
          />
          <ContextMenuDivider />
          <ContextMenuItem
            label="Paste"
            disabled={!canPaste}
            onAction={() => { pasteEntries(); hide(); }}
          />
        </>
      )}
    </div>
  );
}

function ContextMenuItem({ label, onAction, danger = false, disabled = false }: { label: string; onAction: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) onAction(); }}
      disabled={disabled}
      className={`w-full text-left px-3 py-1.5 transition-colors disabled:opacity-35 disabled:pointer-events-none ${
        danger
          ? "text-danger hover:bg-danger/10"
          : "text-text-primary hover:bg-surface-hover"
      }`}
    >
      {label}
    </button>
  );
}

function ContextMenuDivider() {
  return <div className="h-px bg-border my-1 mx-2" />;
}

function DialogOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[340px] rounded-xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function DialogButton({
  children,
  onClick,
  disabled = false,
  primary = false,
  danger = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  type?: "button" | "submit";
}) {
  let cls = "h-8 px-4 rounded-md text-[12px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ";
  if (danger) {
    cls += "bg-danger text-white hover:bg-danger/90";
  } else if (primary) {
    cls += "bg-accent text-white hover:bg-accent/90";
  } else {
    cls += "border border-border text-text-secondary hover:bg-surface-hover";
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

// ── Shared sub-components ──

function ToolbarButton({
  children,
  label,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="rounded p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-35 disabled:pointer-events-none transition-colors"
      aria-label={label}
      disabled={disabled}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

function ViewToggle({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1 transition-colors ${
        active
          ? "bg-accent/10 text-accent"
          : "text-text-tertiary hover:text-text-secondary hover:bg-surface-hover"
      }`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function BreadcrumbItem({
  label,
  first = false,
  active = false,
  onClick,
}: {
  label: string;
  first?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors shrink-0 ${
        active
          ? "text-text-primary font-medium"
          : "text-text-secondary hover:bg-surface-hover cursor-pointer"
      }`}
    >
      {first && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-text-tertiary shrink-0">
          <path d="M2 5.5l4-3.5 4 3.5V10a1 1 0 01-1 1H3a1 1 0 01-1-1V5.5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      )}
      {!first && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-text-tertiary shrink-0">
          <path d="M1.5 3C1.5 2.45 1.95 2 2.5 2H5l1 1H9.5c.55 0 1 .45 1 1V9c0 .55-.45 1-1 1H2.5c-.55 0-1-.45-1-1V3Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
        </svg>
      )}
      <span className="text-[12px]">{label}</span>
    </button>
  );
}

function BreadcrumbSep() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" className="text-text-tertiary shrink-0">
      <path d="M3 1.5L5.5 4 3 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
