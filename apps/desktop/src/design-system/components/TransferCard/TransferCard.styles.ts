import type { TransferStatus } from "./TransferCard.types";
import type { ProgressColor } from "../Progress";

export const transferCardClasses = {
  container:
    "flex flex-col gap-2 p-4 rounded-lg border border-border bg-surface-secondary",
  header: "flex items-center gap-3",
  fileIcon: "shrink-0 text-text-secondary",
  content: "flex flex-col gap-0.5 min-w-0 flex-1",
  fileName: "text-sm font-medium text-text-primary truncate",
  meta: "text-xs text-text-secondary",
  actions: "flex items-center gap-1 shrink-0",
} as const;

export const statusProgressColor: Record<TransferStatus, ProgressColor> = {
  pending: "accent",
  in_progress: "accent",
  completed: "success",
  failed: "error",
  paused: "warning",
};
