import type { HTMLAttributes, ReactNode } from "react";

export type DeviceStatus = "online" | "offline" | "syncing";

export interface DeviceCardProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  icon?: ReactNode;
  status: DeviceStatus;
  type?: string;
  lastSeen?: string;
}
