import type { DeviceStatus } from "./DeviceCard.types";

export const deviceCardClasses = {
  container:
    "flex items-center gap-4 p-4 rounded-lg border border-border bg-surface-secondary transition-colors duration-200 hover:bg-surface-tertiary",
  icon: "shrink-0 text-text-secondary",
  content: "flex flex-col gap-0.5 min-w-0",
  name: "text-sm font-medium text-text-primary truncate",
  meta: "text-xs text-text-secondary",
  statusContainer: "ml-auto shrink-0 flex items-center gap-2",
} as const;

export const statusConfig: Record<
  DeviceStatus,
  { dot: string; label: string }
> = {
  online: { dot: "bg-emerald-500", label: "Online" },
  offline: { dot: "bg-gray-400 dark:bg-gray-600", label: "Offline" },
  syncing: { dot: "bg-blue-500 animate-pulse", label: "Syncing" },
};
