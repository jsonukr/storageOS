import { useState, useEffect, useCallback } from "react";
import { listDrives, onBridgeEvent } from "@/lib/tauri";
import type { LocalDriveInfo } from "@/lib/tauri";
import { useExplorerStore } from "@/stores/explorer";

interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavSectionItem[];
}

interface NavSectionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const staticSections: NavSection[] = [
  {
    id: "quick-access",
    label: "Quick Access",
    icon: <StarIcon />,
    items: [
      { id: "desktop", label: "Desktop", icon: <DesktopItemIcon /> },
      { id: "downloads", label: "Downloads", icon: <DownloadIcon /> },
      { id: "documents", label: "Documents", icon: <DocumentIcon /> },
    ],
  },
  {
    id: "favorites",
    label: "Favorites",
    icon: <HeartIcon />,
    items: [],
  },
];

const tailSections: NavSection[] = [
  {
    id: "cloud-storage",
    label: "Cloud Storage",
    icon: <CloudIcon />,
    items: [],
  },
  {
    id: "network",
    label: "Network",
    icon: <NetworkIcon />,
    items: [],
  },
  {
    id: "trash",
    label: "Trash",
    icon: <TrashIcon />,
    items: [],
  },
];

export function NavigationPanel() {
  const [drives, setDrives] = useState<LocalDriveInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDrives = useCallback(() => {
    listDrives()
      .then(setDrives)
      .catch(() => setDrives([]));
  }, []);

  useEffect(() => {
    refreshDrives();
    setLoading(false);
  }, [refreshDrives]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    onBridgeEvent("transfer:progress", (payload) => {
      if (payload.status === "completed") refreshDrives();
    }).then((fn) => { unsubscribe = fn; });

    const onInvalidate = () => refreshDrives();
    window.addEventListener("drives:invalidate", onInvalidate);

    return () => {
      unsubscribe?.();
      window.removeEventListener("drives:invalidate", onInvalidate);
    };
  }, [refreshDrives]);

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden py-1.5 select-none">
      {staticSections.map((section) => (
        <CollapsibleSection key={section.id} section={section} />
      ))}
      <DriveSection drives={drives} loading={loading} />
      {tailSections.map((section) => (
        <CollapsibleSection key={section.id} section={section} />
      ))}
    </div>
  );
}

function DriveSection({
  drives,
  loading,
}: {
  drives: LocalDriveInfo[];
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-3 py-[5px] text-[12px] font-semibold text-text-secondary uppercase tracking-wider hover:bg-surface-hover transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`shrink-0 text-text-tertiary transition-transform duration-150 ${
            expanded ? "rotate-90" : ""
          }`}
        >
          <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <span className="shrink-0 text-text-tertiary"><DriveIcon /></span>
        <span className="truncate">Local Storage</span>
      </button>
      {expanded && (
        <div className="mt-0.5">
          {loading ? (
            <div className="pl-7 pr-3 py-1 text-[11px] text-text-tertiary italic">
              Detecting drives...
            </div>
          ) : drives.length > 0 ? (
            drives.map((drive) => <DriveItem key={drive.letter} drive={drive} />)
          ) : (
            <div className="pl-7 pr-3 py-1 text-[11px] text-text-tertiary italic">
              No drives detected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DriveItem({ drive }: { drive: LocalDriveInfo }) {
  const navigateTo = useExplorerStore((s) => s.navigateTo);
  const currentPath = useExplorerStore((s) => s.currentPath);
  const drivePath = `${drive.letter}:\\`;
  const isActive = currentPath === drivePath;
  const usedPercent = drive.total_bytes > 0
    ? Math.round((drive.used_bytes / drive.total_bytes) * 100)
    : 0;
  const label = drive.label || "Local Disk";
  const displayName = `${label} (${drive.letter}:)`;
  const freeText = formatBytes(drive.free_bytes);
  const totalText = formatBytes(drive.total_bytes);

  return (
    <button
      onClick={() => navigateTo(drivePath)}
      className={`flex w-full items-center gap-2 pl-7 pr-3 py-[5px] text-[12px] transition-colors rounded-sm group ${
        isActive
          ? "bg-accent/10 text-accent"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      }`}
    >
      <span className="shrink-0 text-text-tertiary">
        {drive.is_removable ? <UsbDriveIcon /> : <FixedDriveIcon />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="truncate font-medium">{displayName}</span>
          <span className="text-[10px] text-text-tertiary ml-1 shrink-0">{drive.file_system}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="flex-1 h-[3px] rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usedPercent > 90
                  ? "bg-danger"
                  : usedPercent > 75
                    ? "bg-warning"
                    : "bg-accent"
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <span className="text-[9px] text-text-tertiary shrink-0">
            {freeText} free / {totalText}
          </span>
        </div>
      </div>
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function CollapsibleSection({ section }: { section: NavSection }) {
  const [expanded, setExpanded] = useState(
    section.id === "quick-access",
  );

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-3 py-[5px] text-[12px] font-semibold text-text-secondary uppercase tracking-wider hover:bg-surface-hover transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`shrink-0 text-text-tertiary transition-transform duration-150 ${
            expanded ? "rotate-90" : ""
          }`}
        >
          <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <span className="shrink-0 text-text-tertiary">{section.icon}</span>
        <span className="truncate">{section.label}</span>
      </button>
      {expanded && (
        <div className="mt-0.5">
          {section.items.length > 0 ? (
            section.items.map((item) => (
              <button
                key={item.id}
                className="flex w-full items-center gap-2 pl-7 pr-3 py-[4px] text-[12px] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors rounded-sm"
              >
                <span className="shrink-0 text-text-tertiary">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))
          ) : (
            <div className="pl-7 pr-3 py-1 text-[11px] text-text-tertiary italic">
              No items
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Inline SVG Icons (12x12) ---

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1.5l1.35 2.74 3.02.44-2.18 2.13.52 3.01L6 8.38 3.29 9.82l.52-3.01L1.63 4.68l3.02-.44L6 1.5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 10.5S1 7.5 1 4.5a2.5 2.5 0 015 0 2.5 2.5 0 015 0c0 3-5 6-5 6z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function DriveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1.5" y="3" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
      <circle cx="8.5" cy="6" r="0.75" fill="currentColor" />
      <path d="M3 6h3.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

function FixedDriveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1.5" y="3" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
      <circle cx="8.5" cy="6" r="0.75" fill="currentColor" />
      <path d="M3 6h3.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

function UsbDriveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="1.5" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M4 8.5v2h4v-2" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="0.6" fill="currentColor" />
      <circle cx="7" cy="5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 9.5a2.5 2.5 0 01-.5-4.95A3.5 3.5 0 019.3 3.2 2.5 2.5 0 019.5 8H9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="3" r="1.5" stroke="currentColor" strokeWidth="1" />
      <circle cx="2.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1" />
      <circle cx="9.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1" />
      <path d="M6 4.5v2L2.5 7.5M6 6.5l3.5 1" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 3h8M4.5 3V2h3v1M3 3l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DesktopItemIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1.5" y="2" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="0.9" />
      <path d="M4.5 10.5h3M6 8v2.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 2v6M3.5 5.5L6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 1.5h4l2.5 2.5V10a1 1 0 01-1 1H3a1 1 0 01-1-1V2.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M7 1.5V4h2.5" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  );
}
