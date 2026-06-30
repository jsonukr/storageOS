export type TransferStatus =
  | "queued"
  | "preparing"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export type TransferType = "copy" | "move";

export interface TransferJob {
  readonly id: string;
  readonly type: TransferType;
  readonly name: string;
  readonly source: string;
  readonly destination: string;
  status: TransferStatus;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  speed: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
}
