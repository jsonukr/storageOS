import type { StorageStatus } from "./StorageCard.types";

export const storageCardClasses = {
  container:
    "flex flex-col gap-3 p-4 rounded-[8px] border border-border-card bg-surface-card transition-all duration-[167ms] [transition-timing-function:cubic-bezier(0,0,0,1)] hover:bg-surface-card-hover hover:shadow-[var(--shadow-card)]",
  header: "flex items-center justify-between",
  titleRow: "flex items-center gap-3",
  icon: "shrink-0 text-text-secondary",
  name: "text-[13px] font-semibold text-text-primary truncate",
  usage: "text-[12px] text-text-secondary",
} as const;

export const statusColors: Record<StorageStatus, string> = {
  connected: "bg-success",
  disconnected: "bg-text-tertiary",
  syncing: "bg-accent animate-pulse",
  error: "bg-danger",
};
