import { useState } from "react";

type ViewMode = "grid" | "list";

export default function Explorer() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border bg-toolbar px-2 py-1.5">
        {/* Navigation buttons */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton label="Back" disabled>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Forward" disabled>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Refresh">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11.5 7A4.5 4.5 0 112.5 7M2.5 3v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton label="New Folder">
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
        </div>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1 transition-colors ${
              viewMode === "list"
                ? "bg-accent/10 text-accent"
                : "text-text-tertiary hover:text-text-secondary hover:bg-surface-hover"
            }`}
            aria-label="List view"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M2 7h10M2 10h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1 transition-colors ${
              viewMode === "grid"
                ? "bg-accent/10 text-accent"
                : "text-text-tertiary hover:text-text-secondary hover:bg-surface-hover"
            }`}
            aria-label="Grid view"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Address Bar */}
      <div className="flex items-center gap-1.5 border-b border-border bg-toolbar px-2 py-1">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-text-tertiary shrink-0">
          <path d="M1.5 3.5C1.5 2.95 1.95 2.5 2.5 2.5H5.5l1 1H11.5c.55 0 1 .45 1 1V10.5c0 .55-.45 1-1 1H2.5c-.55 0-1-.45-1-1V3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
        <div className="flex items-center flex-1 h-6 rounded border border-border bg-surface px-2 text-xs text-text-secondary">
          <span className="text-text-tertiary">This PC</span>
        </div>
      </div>

      {/* Content area — empty state */}
      <div className="flex-1 flex items-center justify-center overflow-auto">
        <div className="flex flex-col items-center text-center px-6 py-12 max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-subtle mb-4">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-accent">
              <path d="M3 7.5C3 5.84 4.34 4.5 6 4.5h5.5L14 7h8c1.66 0 3 1.34 3 3v11c0 1.66-1.34 3-3 3H6c-1.66 0-3-1.34-3-3V7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10 16h8M14 12v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-text-primary mb-1">
            No storage connected
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-5">
            Connect a storage provider to start browsing your files. StorageOS supports local drives, Google Drive, OneDrive, SharePoint, and Dropbox.
          </p>
          <button className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Connect Storage
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  disabled = false,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="rounded p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none transition-colors"
      aria-label={label}
      disabled={disabled}
      title={label}
    >
      {children}
    </button>
  );
}
