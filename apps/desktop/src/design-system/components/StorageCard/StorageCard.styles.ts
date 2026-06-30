import type { StorageStatus } from "./StorageCard.types";

export const storageCardClasses = {
  container:
    "flex flex-col gap-3 p-4 rounded-lg border border-border bg-surface-secondary transition-colors duration-200 hover:bg-surface-tertiary",
  header: "flex items-center justify-between",
  titleRow: "flex items-center gap-3",
  icon: "shrink-0 text-text-secondary",
  name: "text-sm font-medium text-text-primary truncate",
  usage: "text-xs text-text-secondary",
} as const;

export const statusColors: Record<StorageStatus, string> = {
  connected: "bg-emerald-500",
  disconnected: "bg-gray-400 dark:bg-gray-600",
  syncing: "bg-blue-500 animate-pulse",
  error: "bg-red-500",
};
