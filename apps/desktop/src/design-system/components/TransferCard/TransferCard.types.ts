import type { HTMLAttributes, ReactNode } from "react";

export type TransferStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "paused";

export type TransferDirection = "upload" | "download" | "copy" | "move";

export interface TransferCardProps extends HTMLAttributes<HTMLDivElement> {
  fileName: string;
  fileIcon?: ReactNode;
  status: TransferStatus;
  direction: TransferDirection;
  progress?: number;
  source?: string;
  destination?: string;
  size?: string;
  speed?: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}
