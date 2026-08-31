import { NavLink } from "react-router-dom";
import { useSidebarStore } from "../stores/sidebar";
import type { NavItem } from "../types";

const navItems: NavItem[] = [
  {
    label: "Explorer",
    path: "/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 4.5C2 3.67 2.67 3 3.5 3H7l1.5 1.5H14.5c.83 0 1.5.67 1.5 1.5V13.5c0 .83-.67 1.5-1.5 1.5H3.5c-.83 0-1.5-.67-1.5-1.5V4.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Transfers",
    path: "/transfers",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 7l3-3 3 3M7 4v8M14 11l-3 3-3-3M11 14V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Devices",
    path: "/devices",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="3" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 15h6M9 12v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Settings",
    path: "/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4.05 4.05l1.06 1.06M12.89 12.89l1.06 1.06M4.05 13.95l1.06-1.06M12.89 5.11l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <aside
      className={`flex flex-col border-r border-border bg-sidebar transition-[width] duration-[250ms] [transition-timing-function:cubic-bezier(0,0,0,1)] ${
        collapsed ? "w-[48px]" : "w-[220px]"
      }`}
    >
      {/* Logo */}
      <div className="flex h-11 items-center gap-2.5 px-3 border-b border-border">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-accent text-white">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4.5C2 3.12 3.12 2 4.5 2h5C10.88 2 12 3.12 12 4.5v5c0 1.38-1.12 2.5-2.5 2.5h-5C3.12 12 2 10.88 2 9.5v-5Z" fill="currentColor" fillOpacity="0.3" />
            <path d="M5 5.5h4M5 7.5h4M5 9.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        {!collapsed && (
          <span className="text-[13px] font-semibold text-text-primary tracking-[-0.01em] overflow-hidden whitespace-nowrap">
            StorageOS
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-1.5 py-1.5 space-y-px" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            className={({ isActive }) =>
              `group relative flex items-center gap-2.5 rounded-[4px] px-2.5 py-[6px] text-[13px] font-medium transition-all duration-[167ms] [transition-timing-function:cubic-bezier(0,0,0,1)] ${
                isActive
                  ? "bg-sidebar-active text-accent-text"
                  : "text-text-secondary hover:bg-sidebar-hover hover:text-text-primary"
              } ${collapsed ? "justify-center px-0" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-[3px] bg-accent transition-[height] duration-[167ms] [transition-timing-function:cubic-bezier(0,0,0,1)] group-active:h-2.5" />
                )}
                <span className={`shrink-0 transition-colors duration-[167ms] ${
                  isActive ? "text-accent" : "text-text-tertiary group-hover:text-text-secondary"
                }`}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="overflow-hidden whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-2">
        {!collapsed ? (
          <span className="text-[11px] text-text-tertiary">v0.1.0</span>
        ) : (
          <span className="flex justify-center text-[10px] text-text-tertiary">0.1</span>
        )}
      </div>
    </aside>
  );
}
