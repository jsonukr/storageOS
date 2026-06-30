import type { HTMLAttributes, ReactNode } from "react";

export type StorageStatus = "connected" | "disconnected" | "syncing" | "error";

export interface StorageCardProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  icon?: ReactNode;
  status: StorageStatus;
  usedSpace?: string;
  totalSpace?: string;
  usagePercent?: number;
}
