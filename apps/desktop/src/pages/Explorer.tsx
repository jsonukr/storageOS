import { useCallback, useState, useRef, useEffect } from "react";
import { useExplorerStore, getParentPath, isImageFile } from "../stores/explorer";
import { useTransferStore } from "../stores/transfer";
import { NavigationPanel } from "../components/NavigationPanel";
import { PropertiesPanel } from "../components/PropertiesPanel";
import { ResizeHandle } from "../components/ResizeHandle";
import type { DirectoryEntry } from "@/lib/tauri";
import type { SortField } from "@/services/ExplorerSortService";
import { convertFileSrc } from "@tauri-apps/api/core";
import { downloadDir } from "@tauri-apps/api/path";
import { getThumbnail, pickFiles } from "@/lib/tauri";
import { ExplorerService } from "@/services/ExplorerService";

// ── Thumbnail cache + load queue ──

const thumbCache = new Map<string, string>();
const THUMB_MAX_CONCURRENT = 3;
let thumbActive = 0;
const thumbQueue: (() => void)[] = [];

function thumbAcquire(): Promise<void> {
  if (thumbActive < THUMB_MAX_CONCURRENT) { thumbActive++; return Promise.resolve(); }
  return new Promise(r => thumbQueue.push(r));
}

function thumbRelease() {
  thumbActive--;
  const next = thumbQueue.shift();
  if (next) { thumbActive++; next(); }
}

async function loadThumb(filePath: string, size: number): Promise<string | null> {
  const cached = thumbCache.get(filePath);
  if (cached) return cached;
  await thumbAcquire();
  try {
    const maxPx = Math.min(size * 2, 200);
    const dataUrl = await getThumbnail(filePath, maxPx);
    thumbCache.set(filePath, dataUrl);
    return dataUrl;
  } catch {
    return null;
  } finally {
    thumbRelease();
  }
}

// ── File type detection ──

const IMAGE_EXTS = new Set(["jpg","jpeg","png","gif","bmp","webp","svg","ico","tiff","tif","avif","jfif"]);
const VIDEO_EXTS = new Set(["mp4","webm","avi","mkv","mov","wmv","flv","m4v","mpg","mpeg"]);
const AUDIO_EXTS = new Set(["mp3","wav","ogg","flac","aac","wma","m4a"]);
const ARCHIVE_EXTS = new Set(["zip","rar","7z","tar","gz","bz2","xz"]);

type FileCategory = "folder"|"image"|"video"|"audio"|"pdf"|"word"|"excel"|"powerpoint"|"archive"|"code"|"text"|"executable"|"other";

function getFileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  if (IMAGE_EXTS.has(e)) return "image";
  if (VIDEO_EXTS.has(e)) return "video";
  if (AUDIO_EXTS.has(e)) return "audio";
  if (e === "pdf") return "pdf";
  if (["doc","docx","odt","rtf"].includes(e)) return "word";
  if (["xls","xlsx","ods","csv"].includes(e)) return "excel";
  if (["ppt","pptx","odp"].includes(e)) return "powerpoint";
  if (ARCHIVE_EXTS.has(e)) return "archive";
  if (["js","ts","jsx","tsx","py","rs","java","c","cpp","h","cs","go","rb","php","swift","kt"].includes(e)) return "code";
  if (["txt","md","json","xml","html","css","yml","yaml","toml","ini","cfg","log"].includes(e)) return "text";
  if (["exe","msi","bat","cmd","com"].includes(e)) return "executable";
  return "other";
}

const FILE_COLORS: Record<FileCategory, string> = {
  folder: "#dcb44c",
  image: "#26A69A",
  video: "#7B1FA2",
  audio: "#F57C00",
  pdf: "#E2574C",
  word: "#2B579A",
  excel: "#217346",
  powerpoint: "#D24726",
  archive: "#FFA000",
  code: "#5C6BC0",
  text: "#78909C",
  executable: "#546E7A",
  other: "#78909C",
};

const NAV_MIN = 180;
const NAV_MAX = 360;
const PROP_MIN = 200;
const PROP_MAX = 400;

export default function Explorer() {
  const viewMode = useExplorerStore((s) => s.viewMode);
  const navPanelWidth = useExplorerStore((s) => s.navPanelWidth);
  const setNavPanelWidth = useExplorerStore((s) => s.setNavPanelWidth);
  const propertiesOpen = useExplorerStore((s) => s.propertiesOpen);
  const toggleProperties = useExplorerStore((s) => s.toggleProperties);
  const propertiesWidth = useExplorerStore((s) => s.propertiesWidth);
  const setPropertiesWidth = useExplorerStore((s) => s.setPropertiesWidth);
  const remoteDevice = useExplorerStore((s) => s.remoteDevice);
  const exitRemoteBrowse = useExplorerStore((s) => s.exitRemoteBrowse);

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

  const handleUpload = useCallback(async () => {
    const dest = useExplorerStore.getState().currentPath;
    const remote = useExplorerStore.getState().remoteDevice;
    if (!dest) return;

    const files = await pickFiles();
    if (files.length === 0) return;

    if (remote) {
      for (const file of files) {
        ExplorerService.remoteUploadToDevice(remote.address, file.path, dest, file.name, file.size);
      }
    } else {
      for (const file of files) {
        ExplorerService.uploadToLocal(file.path, dest, file.name, file.size);
      }
    }
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
          <ToolbarButton label="Upload" disabled={currentPath === null} onClick={handleUpload}>
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

        {/* Sort & View Dropdowns */}
        <SortDropdown />
        <ViewDropdown />

        <ToolbarDivider />

        {/* More */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton label="Properties" onClick={toggleProperties}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </ToolbarButton>
        </div>
      </div>

      {/* ── Remote device banner ── */}
      {remoteDevice && (
        <div className="flex items-center gap-2 border-b border-border bg-accent/10 px-3 py-1.5 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <span className="font-medium text-text-primary">Browsing: {remoteDevice.name}</span>
          <span className="text-text-secondary">({remoteDevice.address})</span>
          <button
            onClick={exitRemoteBrowse}
            className="ml-auto rounded px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            Disconnect
          </button>
        </div>
      )}

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
      <ImagePreview />
    </div>
  );
}

// ── Address Bar ──

function parseBreadcrumbs(path: string): { label: string; path: string }[] {
  const isUnixAbs = path.startsWith("/");
  const sep = isUnixAbs ? "/" : "\\";
  const normalized = isUnixAbs ? path : path.replace(/\//g, "\\");
  const parts = normalized.split(sep).filter(Boolean);
  const crumbs: { label: string; path: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i];
    if (i === 0 && !isUnixAbs && /^[A-Za-z0-9]:$/.test(segment)) {
      crumbs.push({ label: segment + "\\", path: segment + "\\" });
    } else {
      const prev = crumbs.length > 0 ? crumbs[crumbs.length - 1].path.replace(/[\\/]$/, "") : (isUnixAbs ? "" : "");
      crumbs.push({ label: segment, path: prev + sep + segment });
    }
  }
  return crumbs;
}

function AddressBar() {
  const currentPath = useExplorerStore((s) => s.currentPath);
  const navigateTo = useExplorerStore((s) => s.navigateTo);
  const refresh = useExplorerStore((s) => s.refresh);
  const rd = useExplorerStore((s) => s.remoteDevice);

  const crumbs = currentPath !== null ? parseBreadcrumbs(currentPath) : [];

  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-toolbar px-2 py-1">
      <div className="flex items-center flex-1 h-7 rounded-md border border-border bg-surface px-1.5 gap-0.5 text-[12px] overflow-hidden">
        <BreadcrumbItem
          label={rd ? rd.name : "This PC"}
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
  const areaRef = useRef<HTMLDivElement>(null);

  const searchQuery = useExplorerStore((s) => s.searchQuery);
  const searchResults = useExplorerStore((s) => s.searchResults);
  const searchError = useExplorerStore((s) => s.searchError);

  const showHidden = useExplorerStore((s) => s.showHiddenItems);
  const isSearchActive = searchQuery.length > 0;

  useEffect(() => {
    if (currentPath && areaRef.current) areaRef.current.focus();
  }, [currentPath]);

  const filterHidden = (items: DirectoryEntry[]) =>
    showHidden ? items : items.filter((e) => !e.hidden);

  const renderView = (items: DirectoryEntry[]) => {
    const filtered = filterHidden(items);
    if (viewMode === "details") return <DetailsView entries={filtered} areaRef={areaRef} />;
    if (viewMode === "list") return <ListView entries={filtered} areaRef={areaRef} />;
    return <GridView entries={filtered} viewMode={viewMode} areaRef={areaRef} />;
  };

  const handleBackgroundContext = (e: React.MouseEvent) => {
    e.preventDefault();
    selectEntry(null);
    showContextMenu(e.clientX, e.clientY, null);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const s = useExplorerStore.getState();
    const sel = s.selectedEntries;
    const ctrl = e.ctrlKey || e.metaKey;

    if (e.key === "Delete" && sel.length > 0) {
      e.preventDefault();
      s.confirmDelete(sel);
    } else if (e.key === "F2" && sel.length === 1) {
      e.preventDefault();
      s.startRename(sel[0]);
    } else if (ctrl && e.key === "c" && sel.length > 0) {
      e.preventDefault();
      s.copyEntries(sel);
    } else if (ctrl && e.key === "x" && sel.length > 0) {
      e.preventDefault();
      s.cutEntries(sel);
    } else if (ctrl && e.key === "v") {
      e.preventDefault();
      s.pasteEntries();
    } else if (ctrl && e.key === "h") {
      e.preventDefault();
      s.toggleShowHiddenItems();
    } else if (ctrl && e.key === "a") {
      e.preventDefault();
      const visible = s.searchQuery ? (s.searchResults ?? []) : s.entries;
      const filtered = s.showHiddenItems ? visible : visible.filter((en) => !en.hidden);
      if (filtered.length > 0) {
        s.selectEntry(filtered[0]);
        if (filtered.length > 1) s.selectEntry(filtered[filtered.length - 1], false, true);
      }
    } else if (e.key === "Enter" && sel.length === 1) {
      e.preventDefault();
      s.openEntry(sel[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (s.searchQuery) {
        s.clearSearch();
      } else {
        s.selectEntry(null);
      }
    } else if (e.key === "F5") {
      e.preventDefault();
      s.refresh();
    } else if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      s.goBack();
    } else if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      s.goForward();
    } else if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      s.goUp();
    }
  }, []);

  const renderContent = () => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} />;
    if (currentPath === null) return <WelcomeState />;

    if (isSearchActive) {
      if (searchError) return <ErrorState message={searchError} />;
      if (searchResults !== null && searchResults.length === 0) return <NoResultsState query={searchQuery} />;
      if (searchResults !== null) return renderView(searchResults);
    }

    if (entries.length === 0) return <EmptyState />;
    return renderView(entries);
  };

  return (
    <div
      ref={areaRef}
      tabIndex={-1}
      className="flex-1 flex flex-col overflow-hidden bg-surface min-w-0 outline-none"
      onClick={() => { selectEntry(null); hideContextMenu(); }}
      onContextMenu={handleBackgroundContext}
      onKeyDown={handleKeyDown}
    >
      {viewMode === "details" && <DetailsHeader />}

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

function SortArrow({ field }: { field: SortField }) {
  const sortField = useExplorerStore((s) => s.sortField);
  const sortDirection = useExplorerStore((s) => s.sortDirection);
  if (sortField !== field) return null;
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="ml-0.5 shrink-0">
      {sortDirection === "asc" ? (
        <path d="M4 2L1.5 5.5h5L4 2z" fill="currentColor" />
      ) : (
        <path d="M4 6L1.5 2.5h5L4 6z" fill="currentColor" />
      )}
    </svg>
  );
}

function DetailsHeader() {
  const setSortField = useExplorerStore((s) => s.setSortField);
  const setSortDirection = useExplorerStore((s) => s.setSortDirection);
  const sortField = useExplorerStore((s) => s.sortField);
  const sortDirection = useExplorerStore((s) => s.sortDirection);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
    }
  };

  const colClass = "flex items-center gap-0.5 cursor-pointer hover:text-text-secondary transition-colors";

  return (
    <div className="flex items-center h-7 border-b border-border-subtle px-3 text-[11px] font-medium text-text-tertiary select-none bg-surface-secondary">
      <span className={`flex-1 min-w-0 ${colClass}`} onClick={(e) => { e.stopPropagation(); handleSort("name"); }}>
        Name <SortArrow field="name" />
      </span>
      <span className={`w-32 justify-end shrink-0 ${colClass}`} onClick={(e) => { e.stopPropagation(); handleSort("date_modified"); }}>
        Date Modified <SortArrow field="date_modified" />
      </span>
      <span className={`w-20 justify-end shrink-0 ${colClass}`} onClick={(e) => { e.stopPropagation(); handleSort("type"); }}>
        Type <SortArrow field="type" />
      </span>
      <span className={`w-20 justify-end shrink-0 ${colClass}`} onClick={(e) => { e.stopPropagation(); handleSort("size"); }}>
        Size <SortArrow field="size" />
      </span>
    </div>
  );
}

function DetailsView({ entries, areaRef }: { entries: DirectoryEntry[]; areaRef: React.RefObject<HTMLDivElement | null> }) {
  const selectedEntries = useExplorerStore((s) => s.selectedEntries);
  const selectEntry = useExplorerStore((s) => s.selectEntry);
  const openEntry = useExplorerStore((s) => s.openEntry);
  const showContextMenu = useExplorerStore((s) => s.showContextMenu);
  const showExt = useExplorerStore((s) => s.showFileExtensions);
  const selectedPaths = new Set(selectedEntries.map((e) => e.full_path));

  return (
    <div className="text-[12px]">
      {entries.map((entry) => {
        const isSelected = selectedPaths.has(entry.full_path);
        return (
          <div
            key={entry.full_path}
            onClick={(e) => { e.stopPropagation(); selectEntry(entry, e.ctrlKey || e.metaKey, e.shiftKey); areaRef.current?.focus(); }}
            onDoubleClick={() => openEntry(entry)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!isSelected) selectEntry(entry); showContextMenu(e.clientX, e.clientY, entry); }}
            className={`flex items-center h-[26px] px-3 transition-colors cursor-default select-none border-b border-transparent ${
              isSelected
                ? "bg-accent/10 border-accent/20"
                : "hover:bg-surface-hover hover:border-border-subtle"
            }`}
          >
            <span className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="relative shrink-0">
                <FileIcon entry={entry} />
                {entry.readonly && <LockBadge size={8} />}
              </span>
              <span className={`truncate ${entry.hidden ? "opacity-50" : ""}`}>
                {entry.is_directory || showExt ? entry.name : stripExtension(entry.name, entry.extension)}
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

const GRID_SIZES = {
  extra_large: { min: 180, icon: 96, text: 12, gap: 4, pad: 4 },
  large:       { min: 130, icon: 64, text: 12, gap: 2, pad: 3 },
  medium:      { min: 90,  icon: 32, text: 11, gap: 1, pad: 2 },
  small:       { min: 70,  icon: 16, text: 11, gap: 1, pad: 1.5 },
} as const;

function GridView({ entries, viewMode, areaRef }: { entries: DirectoryEntry[]; viewMode: string; areaRef: React.RefObject<HTMLDivElement | null> }) {
  const selectedEntries = useExplorerStore((s) => s.selectedEntries);
  const selectEntry = useExplorerStore((s) => s.selectEntry);
  const openEntry = useExplorerStore((s) => s.openEntry);
  const showContextMenu = useExplorerStore((s) => s.showContextMenu);
  const showExt = useExplorerStore((s) => s.showFileExtensions);
  const selectedPaths = new Set(selectedEntries.map((e) => e.full_path));
  const sz = GRID_SIZES[viewMode as keyof typeof GRID_SIZES] ?? GRID_SIZES.medium;

  return (
    <div className="gap-1 p-2" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${sz.min}px, 1fr))`, gap: `${sz.gap * 4}px` }}>
      {entries.map((entry) => {
        const isSelected = selectedPaths.has(entry.full_path);
        return (
          <div
            key={entry.full_path}
            onClick={(e) => { e.stopPropagation(); selectEntry(entry, e.ctrlKey || e.metaKey, e.shiftKey); areaRef.current?.focus(); }}
            onDoubleClick={() => openEntry(entry)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!isSelected) selectEntry(entry); showContextMenu(e.clientX, e.clientY, entry); }}
            className={`flex flex-col items-center gap-1 rounded-md transition-colors cursor-default select-none ${
              entry.hidden ? "opacity-50" : ""
            } ${
              isSelected
                ? "bg-accent/10 ring-1 ring-accent/30"
                : "hover:bg-surface-hover"
            }`}
            style={{ padding: `${sz.pad * 4}px`, contentVisibility: "auto", containIntrinsicSize: `${sz.min}px ${sz.min + 30}px` }}
          >
            <span className="relative">
              <FileThumbnail entry={entry} size={sz.icon} />
              {entry.readonly && <LockBadge size={Math.max(10, sz.icon * 0.25)} />}
            </span>
            <span className="text-text-primary text-center leading-tight line-clamp-2 w-full break-all" style={{ fontSize: `${sz.text}px` }}>
              {entry.is_directory || showExt ? entry.name : stripExtension(entry.name, entry.extension)}
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
        <path d="M1.5 3.5C1.5 2.95 1.95 2.5 2.5 2.5H5.5l1 1H11.5c.55 0 1 .45 1 1V10.5c0 .55-.45 1-1 1H2.5c-.55 0-1-.45-1-1V3.5Z" fill="currentColor" opacity="0.55" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
      </svg>
    );
  }
  const cat = getFileCategory(entry.extension);
  const color = FILE_COLORS[cat];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path d="M3.5 1.5h5l3 3V11.5a1 1 0 01-1 1h-7a1 1 0 01-1-1v-9a1 1 0 011-1z" fill={color} opacity="0.15" stroke={color} strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M8.5 1.5V4.5h3" stroke={color} strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}

function LockBadge({ size = 8 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      className="absolute -bottom-0.5 -right-0.5 text-text-tertiary drop-shadow-sm"
    >
      <rect x="1.5" y="4.5" width="7" height="5" rx="0.8" fill="currentColor" opacity="0.85" />
      <path d="M3.2 4.5V3a1.8 1.8 0 013.6 0v1.5" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

function ListView({ entries, areaRef }: { entries: DirectoryEntry[]; areaRef: React.RefObject<HTMLDivElement | null> }) {
  const selectedEntries = useExplorerStore((s) => s.selectedEntries);
  const selectEntry = useExplorerStore((s) => s.selectEntry);
  const openEntry = useExplorerStore((s) => s.openEntry);
  const showContextMenu = useExplorerStore((s) => s.showContextMenu);
  const showExt = useExplorerStore((s) => s.showFileExtensions);
  const selectedPaths = new Set(selectedEntries.map((e) => e.full_path));

  return (
    <div className="flex flex-wrap content-start gap-0 p-1">
      {entries.map((entry) => {
        const isSelected = selectedPaths.has(entry.full_path);
        return (
          <div
            key={entry.full_path}
            onClick={(e) => { e.stopPropagation(); selectEntry(entry, e.ctrlKey || e.metaKey, e.shiftKey); areaRef.current?.focus(); }}
            onDoubleClick={() => openEntry(entry)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!isSelected) selectEntry(entry); showContextMenu(e.clientX, e.clientY, entry); }}
            className={`flex items-center gap-1.5 px-2 py-0.5 w-52 rounded transition-colors cursor-default select-none ${
              entry.hidden ? "opacity-50" : ""
            } ${isSelected ? "bg-accent/10" : "hover:bg-surface-hover"}`}
          >
            <span className="relative shrink-0">
              <FileIcon entry={entry} />
              {entry.readonly && <LockBadge size={8} />}
            </span>
            <span className="text-[11px] text-text-primary truncate">{entry.is_directory || showExt ? entry.name : stripExtension(entry.name, entry.extension)}</span>
          </div>
        );
      })}
    </div>
  );
}

function FileThumbnail({ entry, size = 32 }: { entry: DirectoryEntry; size?: number }) {
  const [src, setSrc] = useState<string | null>(() => thumbCache.get(entry.full_path) ?? null);
  const [loadError, setLoadError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (entry.is_directory || getFileCategory(entry.extension) !== "image" || size < 32) return;
    if (thumbCache.has(entry.full_path)) { setSrc(thumbCache.get(entry.full_path)!); return; }
    const observer = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        observer.disconnect();
        loadThumb(entry.full_path, size).then(url => {
          if (!cancelled.current) { if (url) setSrc(url); else setLoadError(true); }
        });
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [entry.full_path, entry.is_directory, entry.extension, size]);

  if (entry.is_directory) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="text-warning">
        <path d="M3 8C3 6.9 3.9 6 5 6h7l2 2h11c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V8z" fill="currentColor" opacity="0.55" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    );
  }

  const cat = getFileCategory(entry.extension);

  if (cat === "image" && size >= 32 && !loadError) {
    return (
      <div
        ref={ref}
        className="rounded overflow-hidden bg-surface-secondary flex items-center justify-center"
        style={{ width: size, height: size, contain: "strict" }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : null}
      </div>
    );
  }

  if (cat === "video" && size >= 48) {
    const color = FILE_COLORS.video;
    return (
      <div
        className="rounded overflow-hidden bg-surface-secondary flex items-center justify-center relative"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 32 32" fill="none">
          <rect x="2" y="6" width="28" height="20" rx="2" fill={color} opacity="0.2" stroke={color} strokeWidth="1" />
          <path d="M13 11v10l8-5-8-5z" fill={color} opacity="0.7" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full bg-black/50 flex items-center justify-center"
            style={{ width: size * 0.3, height: size * 0.3 }}
          >
            <svg width={size * 0.15} height={size * 0.15} viewBox="0 0 12 12" fill="white">
              <path d="M3 1.5v9l7.5-4.5L3 1.5z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  const color = FILE_COLORS[cat];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M8 4h10l6 6v16a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z"
        fill={color}
        opacity="0.15"
        stroke={color}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M18 4v6h6" stroke={color} strokeWidth="1" strokeLinejoin="round" />
      <CategorySymbol category={cat} color={color} />
    </svg>
  );
}

function CategorySymbol({ category, color }: { category: FileCategory; color: string }) {
  switch (category) {
    case "image":
      return (
        <>
          <circle cx="12" cy="17" r="2" fill={color} opacity="0.5" />
          <path d="M8 23l4-5 3 3 3-4 4 6H8z" fill={color} opacity="0.35" />
        </>
      );
    case "video":
      return <path d="M12 15v6l5-3-5-3z" fill={color} opacity="0.6" />;
    case "audio":
      return (
        <>
          <path d="M14 14v7" stroke={color} strokeWidth="1.5" opacity="0.5" />
          <circle cx="12" cy="21" r="2" fill={color} opacity="0.5" />
        </>
      );
    case "pdf":
      return (
        <text x="16" y="22" textAnchor="middle" fill={color} fontSize="7" fontWeight="bold" opacity="0.7">
          PDF
        </text>
      );
    case "word":
      return (
        <text x="16" y="22" textAnchor="middle" fill={color} fontSize="9" fontWeight="bold" opacity="0.7">
          W
        </text>
      );
    case "excel":
      return (
        <text x="16" y="22" textAnchor="middle" fill={color} fontSize="9" fontWeight="bold" opacity="0.7">
          X
        </text>
      );
    case "powerpoint":
      return (
        <text x="16" y="22" textAnchor="middle" fill={color} fontSize="9" fontWeight="bold" opacity="0.7">
          P
        </text>
      );
    case "archive":
      return (
        <path d="M14 14h4v2h-4v2h4v2h-4v2h4" stroke={color} strokeWidth="0.8" opacity="0.5" />
      );
    case "code":
      return (
        <path
          d="M11 17l-2 2 2 2M21 17l2 2-2 2M14 23l4-10"
          stroke={color}
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.5"
        />
      );
    case "executable":
      return (
        <path d="M11 16h10M11 19h10M11 22h6" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      );
    default:
      return (
        <path d="M10 16h12M10 19h12M10 22h8" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      );
  }
}

function stripExtension(name: string, extension: string): string {
  if (!extension) return name;
  const suffix = `.${extension}`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
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
  const targets = useExplorerStore((s) => s.deleteTargets);
  const cancel = useExplorerStore((s) => s.cancelDelete);
  const doDelete = useExplorerStore((s) => s.deleteEntry);
  const operationLoading = useExplorerStore((s) => s.operationLoading);
  const operationError = useExplorerStore((s) => s.operationError);

  if (targets.length === 0) return null;

  const isSingle = targets.length === 1;
  const hasFolder = targets.some((t) => t.is_directory);

  return (
    <DialogOverlay onClose={cancel}>
      <div className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-text-primary">Delete</h3>
        <p className="text-[12px] text-text-secondary leading-relaxed" style={{ overflowWrap: "anywhere" }}>
          {isSingle ? (
            <>Are you sure you want to permanently delete <strong className="text-text-primary">"{targets[0].name}"</strong>?
            {targets[0].is_directory && " This will delete all contents inside the folder."}</>
          ) : (
            <>Are you sure you want to permanently delete <strong className="text-text-primary">{targets.length} items</strong>?
            {hasFolder && " This includes folders with all their contents."}</>
          )}
          {" "}This action cannot be undone.
        </p>
        {operationError && (
          <p className="text-[11px] text-danger">{operationError}</p>
        )}
        <div className="flex justify-end gap-2">
          <DialogButton onClick={cancel} disabled={operationLoading}>Cancel</DialogButton>
          <DialogButton danger onClick={() => doDelete()} disabled={operationLoading}>
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
          <p className="text-[14px] font-semibold text-text-primary leading-snug" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", overflowWrap: "anywhere" }}>
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
  const pauseJob = useTransferStore((s) => s.pauseJob);
  const resumeJob = useTransferStore((s) => s.resumeJob);
  const cancelJob = useTransferStore((s) => s.cancelJob);
  const clearCompleted = useTransferStore((s) => s.clearCompleted);
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  const activeJobs = jobs.filter(
    (j) => j.status === "running" || j.status === "preparing" || j.status === "paused",
  );

  const hasActive = activeJobs.length > 0;
  const isPaused = activeJobs.length > 0 && activeJobs.every((j) => j.status === "paused");

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
  const etaText = isPaused
    ? "Paused"
    : totalSpeed <= 0
      ? "Calculating..."
      : etaSeconds < 60
        ? `About ${Math.ceil(etaSeconds)} seconds remaining`
        : etaSeconds < 3600
          ? `About ${Math.ceil(etaSeconds / 60)} minutes remaining`
          : `About ${Math.floor(etaSeconds / 3600)}h ${Math.ceil((etaSeconds % 3600) / 60)}m remaining`;

  const currentJob = activeJobs[0];
  const operationType = isPaused ? "Paused" : currentJob.type === "move" ? "Moving" : "Copying";
  const sourceName = getLastSegment(currentJob.source);
  const destName = getLastSegment(currentJob.destination);
  const itemsRemaining = activeJobs.length;
  const remainingBytes = activeJobs.reduce((sum, j) => sum + (j.totalBytes - j.bytesTransferred), 0);

  const handlePauseResume = () => {
    for (const job of activeJobs) {
      if (job.status === "paused") {
        resumeJob(job.id);
      } else if (job.status === "running") {
        pauseJob(job.id);
      }
    }
  };

  const handleCancel = () => {
    for (const job of activeJobs) {
      cancelJob(job.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto w-[480px] rounded-lg overflow-hidden shadow-2xl border border-[#5a1520]"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>

        {/* ── Maroon title bar ── */}
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#6b1a2a" }}>
          <span className="text-[11px] text-white/90 font-normal">
            {isPaused ? "Paused" : `${progressPct}% complete`}
          </span>
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
              <p className="text-[13px] text-text-primary mt-0.5">
                {isPaused ? "Paused" : `${progressPct}% complete`}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-3 shrink-0">
              <button
                onClick={handlePauseResume}
                className="p-1.5 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
                aria-label={isPaused ? "Resume" : "Pause"}
                title={isPaused ? "Resume" : "Pause"}
              >
                {isPaused ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M5 3v10l8-5-8-5Z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M5 3h2v10H5zM9 3h2v10H9z" fill="currentColor" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleCancel}
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
                className={`h-full transition-all duration-300 ${isPaused ? "bg-[#d4a017]" : "bg-[#0078d4]"}`}
                style={{ width: `${Math.min(overallProgress, 100)}%` }}
              />
            </div>

            {/* Speed (right aligned) */}
            <div className="flex justify-end mt-1.5">
              <span className="text-[12px] text-text-secondary">
                Speed: {isPaused ? "Paused" : totalSpeed > 0 ? `${formatProgressBytes(totalSpeed)}/s` : "—"}
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
  const selectedEntries = useExplorerStore((s) => s.selectedEntries);
  const setEntryHidden = useExplorerStore((s) => s.setEntryHidden);
  const setEntryReadonly = useExplorerStore((s) => s.setEntryReadonly);
  const remoteDevice = useExplorerStore((s) => s.remoteDevice);
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
  const targets = entry ? (selectedEntries.length > 0 ? selectedEntries : [entry]) : [];
  const allHidden = targets.length > 0 && targets.every((e) => e.hidden);
  const allReadonly = targets.length > 0 && targets.every((e) => e.readonly);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-surface shadow-lg py-1 text-[12px]"
      style={{ left: x, top: y }}
    >
      {entry ? (
        <>
          {entry.is_directory && (
            <ContextMenuItem
              label="Open"
              shortcut="Enter"
              onAction={() => { openEntry(entry); hide(); }}
            />
          )}
          {isImageFile(entry) && (
            <ContextMenuItem
              label="Preview"
              shortcut="Enter"
              onAction={() => { openEntry(entry); hide(); }}
            />
          )}
          {remoteDevice && !entry.is_directory && (
            <ContextMenuItem
              label="Download"
              onAction={() => {
                downloadDir().then((dir) => {
                  ExplorerService.remoteDownloadFile(remoteDevice.address, entry.full_path, dir, entry.name, entry.size);
                });
                hide();
              }}
            />
          )}
          <ContextMenuDivider />
          <ContextMenuItem
            label="Copy"
            shortcut="Ctrl+C"
            onAction={() => { copyEntries(targets); hide(); }}
          />
          <ContextMenuItem
            label="Cut"
            shortcut="Ctrl+X"
            onAction={() => { cutEntries(targets); hide(); }}
          />
          <ContextMenuItem
            label="Paste"
            shortcut="Ctrl+V"
            disabled={!canPaste}
            onAction={() => { pasteEntries(); hide(); }}
          />
          <ContextMenuDivider />
          <ContextMenuItem
            label="Rename"
            shortcut="F2"
            onAction={() => { startRename(entry); hide(); }}
          />
          <ContextMenuDivider />
          <ContextMenuItem
            label={allHidden ? "Unhide" : "Hide"}
            shortcut="Ctrl+H"
            onAction={() => { setEntryHidden(targets, !allHidden); hide(); }}
          />
          <ContextMenuItem
            label={allReadonly ? "Remove read-only" : "Set read-only"}
            onAction={() => { setEntryReadonly(targets, !allReadonly); hide(); }}
          />
          <ContextMenuDivider />
          <ContextMenuItem
            label="Delete"
            shortcut="Del"
            danger
            onAction={() => { confirmDelete(targets); hide(); }}
          />
        </>
      ) : (
        <>
          <ContextMenuItem
            label="New Folder"
            onAction={() => { openNewFolderDialog(); hide(); }}
          />
          <ContextMenuItem
            label="Upload files"
            onAction={() => {
              hide();
              const dest = useExplorerStore.getState().currentPath;
              const remote = useExplorerStore.getState().remoteDevice;
              if (!dest) return;
              pickFiles().then((files) => {
                for (const file of files) {
                  if (remote) {
                    ExplorerService.remoteUploadToDevice(remote.address, file.path, dest, file.name, file.size);
                  } else {
                    ExplorerService.uploadToLocal(file.path, dest, file.name, file.size);
                  }
                }
              });
            }}
          />
          <ContextMenuDivider />
          <ContextMenuItem
            label="Paste"
            shortcut="Ctrl+V"
            disabled={!canPaste}
            onAction={() => { pasteEntries(); hide(); }}
          />
        </>
      )}
    </div>
  );
}

function ContextMenuItem({ label, shortcut, onAction, danger = false, disabled = false }: { label: string; shortcut?: string; onAction: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      role="menuitem"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) onAction(); }}
      disabled={disabled}
      className={`flex items-center justify-between w-full text-left px-3 py-1.5 transition-colors disabled:opacity-35 disabled:pointer-events-none ${
        danger
          ? "text-danger hover:bg-danger/10"
          : "text-text-primary hover:bg-surface-hover"
      }`}
    >
      <span>{label}</span>
      {shortcut && <span className="text-[11px] text-text-tertiary ml-6">{shortcut}</span>}
    </button>
  );
}

function ContextMenuDivider() {
  return <div className="h-px bg-border my-1 mx-2" />;
}

// ── Image Preview ──

function ImagePreview() {
  const images = useExplorerStore((s) => s.previewImages);
  const index = useExplorerStore((s) => s.previewIndex);
  const close = useExplorerStore((s) => s.closeImagePreview);
  const next = useExplorerStore((s) => s.previewNext);
  const prev = useExplorerStore((s) => s.previewPrev);
  const remoteDevice = useExplorerStore((s) => s.remoteDevice);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const active = images.length > 0 && index >= 0;
  const entry = active ? images[index] : null;

  const getImageSrc = useCallback((e: { full_path: string }): string => {
    if (remoteDevice) {
      return `http://${remoteDevice.address}/download?path=${encodeURIComponent(e.full_path)}`;
    }
    return convertFileSrc(e.full_path);
  }, [remoteDevice]);

  const src = entry ? getImageSrc(entry) : "";

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    setError(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src, active]);

  useEffect(() => {
    if (!active) return;
    const preload = (i: number) => {
      if (i >= 0 && i < images.length) {
        const img = new Image();
        img.src = getImageSrc(images[i]);
      }
    };
    preload(index + 1);
    preload(index - 1);
  }, [index, images, getImageSrc, active]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !active) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => {
        const n = Math.min(Math.max(s * delta, 0.25), 10);
        if (n <= 1.05 && n >= 0.95) {
          setOffset({ x: 0, y: 0 });
          return 1;
        }
        return n;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [active]);

  if (!active || !entry) return null;

  const resetTransform = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const goNext = () => { resetTransform(); next(); };
  const goPrev = () => { resetTransform(); prev(); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowRight") { goNext(); return; }
    if (e.key === "ArrowLeft") { goPrev(); return; }
    if (e.key === "+" || e.key === "=") { setScale((s) => Math.min(s * 1.25, 10)); return; }
    if (e.key === "-") { setScale((s) => Math.max(s / 1.25, 0.25)); return; }
    if (e.key === "0") { resetTransform(); return; }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || scale <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  const handleDoubleClick = () => {
    if (scale > 1.05) {
      resetTransform();
    } else {
      setScale(3);
    }
  };

  const handleImageLoad = () => { setLoading(false); setError(false); };
  const handleImageError = () => { setLoading(false); setError(true); };

  const hasNext = index < images.length - 1;
  const hasPrev = index > 0;

  return (
    <div
      ref={(el) => { (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el; if (el) el.focus(); }}
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 select-none outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top bar */}
      <div className="flex items-center h-10 px-3 bg-black/60 shrink-0">
        <span className="text-[13px] text-white/90 truncate flex-1" style={{ overflowWrap: "anywhere" }}>
          {entry.name}
        </span>
        <span className="text-[12px] text-white/50 mx-3 shrink-0">
          {index + 1} / {images.length}
        </span>
        <span className="text-[12px] text-white/50 mr-3 shrink-0">
          {scale !== 1 ? `${Math.round(scale * 100)}%` : "Fit"}
        </span>
        <button
          onClick={close}
          className="flex items-center justify-center w-8 h-8 rounded text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Image area */}
      <div
        className="flex-1 overflow-hidden relative"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
      >
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
              <line x1="4" y1="4" x2="20" y2="20" />
            </svg>
            <span className="text-white/40 text-[13px]">Failed to load image</span>
          </div>
        )}

        <img
          key={entry.full_path}
          src={src}
          alt={entry.name}
          draggable={false}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className="absolute top-1/2 left-1/2 max-w-full max-h-full object-contain transition-opacity duration-200"
          style={{
            transform: `translate(-50%, -50%) scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            opacity: loading || error ? 0 : 1,
            maxWidth: scale <= 1 ? "100%" : "none",
            maxHeight: scale <= 1 ? "100%" : "none",
          }}
        />

        {/* Previous button */}
        {hasPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-black/40 text-white/70 hover:bg-black/60 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polyline points="12,4 6,10 12,16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* Next button */}
        {hasNext && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-black/40 text-white/70 hover:bg-black/60 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polyline points="8,4 14,10 8,16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function DialogOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[360px] rounded-lg border border-border bg-surface p-5 shadow-xl"
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

// ── Sort & View Dropdowns (Windows 11 style) ──

function DropdownMenu({ open, onClose, anchorRef, children }: { open: boolean; onClose: () => void; anchorRef: React.RefObject<HTMLButtonElement | null>; children: React.ReactNode }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-surface py-1 shadow-lg"
      style={{ top: pos.top, left: pos.left, boxShadow: "0 4px 16px rgba(0,0,0,0.14)" }}
    >
      {children}
    </div>
  );
}

function DropdownItem({ label, checked, onClick }: { label: string; checked?: boolean; onClick: () => void }) {
  return (
    <button
      className="flex items-center w-full h-7 px-3 gap-2 text-[12px] text-text-primary hover:bg-surface-hover transition-colors text-left"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <span className="w-4 shrink-0 text-accent">
        {checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

function DropdownSeparator() {
  return <div className="h-px bg-border my-1 mx-2" />;
}

const SORT_FIELDS: { key: SortField; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "date_modified", label: "Date modified" },
  { key: "date_created", label: "Date created" },
  { key: "type", label: "Type" },
  { key: "size", label: "Size" },
];

function SortDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const sortField = useExplorerStore((s) => s.sortField);
  const sortDirection = useExplorerStore((s) => s.sortDirection);
  const foldersFirst = useExplorerStore((s) => s.foldersFirst);
  const setSortField = useExplorerStore((s) => s.setSortField);
  const setSortDirection = useExplorerStore((s) => s.setSortDirection);
  const toggleFoldersFirst = useExplorerStore((s) => s.toggleFoldersFirst);
  const close = useCallback(() => setOpen(false), []);

  const handleField = useCallback((field: SortField) => {
    const state = useExplorerStore.getState();
    if (state.sortField === field) {
      state.setSortDirection(state.sortDirection === "asc" ? "desc" : "asc");
    } else {
      state.setSortField(field);
    }
    setOpen(false);
  }, []);

  return (
    <div className="relative">
      <button
        ref={ref}
        className={`flex items-center gap-1 rounded px-1.5 py-1 text-[12px] transition-colors ${
          open ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        }`}
        onClick={() => setOpen(!open)}
        title="Sort"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4h10M4 7h6M6 10h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span>Sort</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="ml-0.5">
          <path d="M2 3l2 2.5L6 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <DropdownMenu open={open} onClose={close} anchorRef={ref}>
        {SORT_FIELDS.map((f) => (
          <DropdownItem
            key={f.key}
            label={f.label}
            checked={sortField === f.key}
            onClick={() => handleField(f.key)}
          />
        ))}
        <DropdownSeparator />
        <DropdownItem label="Ascending" checked={sortDirection === "asc"} onClick={() => { setSortDirection("asc"); setOpen(false); }} />
        <DropdownItem label="Descending" checked={sortDirection === "desc"} onClick={() => { setSortDirection("desc"); setOpen(false); }} />
        <DropdownSeparator />
        <DropdownItem label="Folders first" checked={foldersFirst} onClick={() => { toggleFoldersFirst(); setOpen(false); }} />
      </DropdownMenu>
    </div>
  );
}

type ViewModeType = "extra_large" | "large" | "medium" | "small" | "list" | "details";

const VIEW_MODES: { key: ViewModeType; label: string }[] = [
  { key: "extra_large", label: "Extra large icons" },
  { key: "large", label: "Large icons" },
  { key: "medium", label: "Medium icons" },
  { key: "small", label: "Small icons" },
  { key: "list", label: "List" },
  { key: "details", label: "Details" },
];

function ViewDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const viewMode = useExplorerStore((s) => s.viewMode);
  const setViewMode = useExplorerStore((s) => s.setViewMode);
  const showHidden = useExplorerStore((s) => s.showHiddenItems);
  const toggleHidden = useExplorerStore((s) => s.toggleShowHiddenItems);
  const showExt = useExplorerStore((s) => s.showFileExtensions);
  const toggleExt = useExplorerStore((s) => s.toggleShowFileExtensions);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="relative">
      <button
        ref={ref}
        className={`flex items-center gap-1 rounded px-1.5 py-1 text-[12px] transition-colors ${
          open ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        }`}
        onClick={() => setOpen(!open)}
        title="View"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
          <rect x="8" y="1.5" width="4.5" height="4.5" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
          <rect x="1.5" y="8" width="4.5" height="4.5" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
          <rect x="8" y="8" width="4.5" height="4.5" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
        </svg>
        <span>View</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="ml-0.5">
          <path d="M2 3l2 2.5L6 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <DropdownMenu open={open} onClose={close} anchorRef={ref}>
        {VIEW_MODES.map((v) => (
          <DropdownItem
            key={v.key}
            label={v.label}
            checked={viewMode === v.key}
            onClick={() => { setViewMode(v.key); setOpen(false); }}
          />
        ))}
        <DropdownSeparator />
        <DropdownItem label="Hidden items" checked={showHidden} onClick={toggleHidden} />
        <DropdownItem label="File name extensions" checked={showExt} onClick={toggleExt} />
      </DropdownMenu>
    </div>
  );
}

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
      className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-35 disabled:pointer-events-none transition-colors"
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
  return <div className="w-px h-4 bg-border mx-1 shrink-0" />;
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
