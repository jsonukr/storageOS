import type { DeviceStatus } from "./DeviceCard.types";

export const deviceCardClasses = {
  container:
    "flex items-center gap-3 p-4 rounded-[8px] border border-border-card bg-surface-card transition-all duration-[167ms] [transition-timing-function:cubic-bezier(0,0,0,1)] hover:bg-surface-card-hover hover:shadow-[var(--shadow-card)]",
  icon: "shrink-0 text-text-secondary",
  content: "flex flex-col gap-0.5 min-w-0",
  name: "text-[13px] font-semibold text-text-primary truncate",
  meta: "text-[12px] text-text-secondary",
  statusContainer: "ml-auto shrink-0 flex items-center gap-2",
} as const;

export const statusConfig: Record<
  DeviceStatus,
  { dot: string; label: string }
> = {
  online: { dot: "bg-success", label: "Online" },
  offline: { dot: "bg-text-tertiary", label: "Offline" },
  syncing: { dot: "bg-accent animate-pulse", label: "Syncing" },
};
