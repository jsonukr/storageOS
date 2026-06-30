import { NavLink } from "react-router-dom";
import { useSidebarStore } from "../stores/sidebar";
import type { NavItem } from "../types";

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/" },
  { label: "Explorer", path: "/explorer" },
  { label: "Transfers", path: "/transfers" },
  { label: "Devices", path: "/devices" },
  { label: "Settings", path: "/settings" },
];

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <aside
      className={`flex flex-col border-r border-border bg-sidebar transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex h-12 items-center px-4 font-semibold">
        {!collapsed && <span>StorageOS</span>}
      </div>
      <nav className="flex-1 space-y-1 px-2 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
              }`
            }
          >
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
