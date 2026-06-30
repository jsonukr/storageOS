import { useLocation } from "react-router-dom";
import { useSidebarStore } from "../stores/sidebar";
import { useThemeStore } from "../stores/theme";

const routeLabels: Record<string, string> = {
  "/": "Explorer",
  "/transfers": "Transfers",
  "/devices": "Devices",
  "/settings": "Settings",
};

export function TopNav() {
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const isDark = useThemeStore((s) => s.isDark);
  const location = useLocation();
  const currentLabel = routeLabels[location.pathname] ?? "StorageOS";

  return (
    <header className="flex h-11 items-center border-b border-border bg-surface px-2 gap-2">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-[13px]" aria-label="Breadcrumb">
        <span className="text-text-tertiary">StorageOS</span>
        <svg width="12" height="12" viewBox="0 0 12 12" className="text-text-tertiary">
          <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-medium text-text-primary">{currentLabel}</span>
      </nav>

      {/* Search box (center) */}
      <div className="flex-1 flex justify-center px-8 max-w-xl mx-auto">
        <div className="relative w-full">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
          >
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search files and folders..."
            className="w-full h-7 rounded-md border border-border bg-surface-secondary pl-8 pr-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
            readOnly
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
              <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M4.11 4.11l1.06 1.06M10.83 10.83l1.06 1.06M4.11 11.89l1.06-1.06M10.83 5.17l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.835 10.835A6.5 6.5 0 015.165 2.165 6.501 6.501 0 1013.835 10.835z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Notifications placeholder */}
        <button
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          aria-label="Notifications"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6a4 4 0 118 0c0 2.667 1 4 1 4H3s1-1.333 1-4ZM6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Profile placeholder */}
        <button
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
          aria-label="Profile"
        >
          U
        </button>
      </div>
    </header>
  );
}
