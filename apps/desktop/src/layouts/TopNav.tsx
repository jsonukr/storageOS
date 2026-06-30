import { useSidebarStore } from "../stores/sidebar";
import { useThemeStore } from "../stores/theme";

export function TopNav() {
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
      <button
        onClick={toggleSidebar}
        className="rounded p-1.5 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
        aria-label="Toggle sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        onClick={toggleTheme}
        className="rounded p-1.5 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
        aria-label="Toggle theme"
      >
        {isDark ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </header>
  );
}
