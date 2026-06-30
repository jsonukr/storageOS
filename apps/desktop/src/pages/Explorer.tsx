import { useCallback } from "react";
import { useExplorerStore } from "../stores/explorer";
import { NavigationPanel } from "../components/NavigationPanel";
import { PropertiesPanel } from "../components/PropertiesPanel";
import { ResizeHandle } from "../components/ResizeHandle";

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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 border-b border-border bg-toolbar px-2 py-1">
        {/* Navigation */}
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
          <ToolbarButton label="Up" disabled>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Refresh">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M11.5 7A4.5 4.5 0 112.5 7M2.5 3v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Actions */}
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
      <div className="flex items-center gap-1.5 border-b border-border bg-toolbar px-2 py-1">
        <div className="flex items-center flex-1 h-7 rounded-md border border-border bg-surface px-1.5 gap-0.5 text-[12px]">
          <BreadcrumbItem label="Home" first />
          <BreadcrumbSep />
          <BreadcrumbItem label="This PC" />
          <BreadcrumbSep />
          <BreadcrumbItem label="Local Drives" active />
        </div>
        <button
          className="rounded-md p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
          aria-label="Refresh"
          title="Refresh"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M11.5 7A4.5 4.5 0 112.5 7M2.5 3v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

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
        <div className="flex-1 flex flex-col overflow-hidden bg-surface min-w-0">
          {/* Column headers (details view) */}
          {viewMode === "details" && (
            <div className="flex items-center h-7 border-b border-border-subtle px-3 text-[11px] font-medium text-text-tertiary select-none gap-4 bg-surface-secondary">
              <span className="flex-1">Name</span>
              <span className="w-28 text-right">Date Modified</span>
              <span className="w-16 text-right">Type</span>
              <span className="w-20 text-right">Size</span>
            </div>
          )}

          {/* Empty state */}
          <div className="flex-1 flex items-center justify-center overflow-auto">
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
                Connect a storage provider or navigate to a directory to see files here.
              </p>
            </div>
          </div>
        </div>

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
    </div>
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
}: {
  label: string;
  first?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors ${
        active ? "text-text-primary font-medium" : "text-text-secondary"
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
