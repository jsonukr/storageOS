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

export type ConflictPolicy = "replace_all" | "skip_all" | "keep_both_all";

export interface FolderTransfer {
  readonly id: string;
  readonly type: TransferType;
  readonly name: string;
  readonly source: string;
  readonly destination: string;
  status: TransferStatus;
  childJobIds: string[];
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  totalFolders: number;
  createdFolders: number;
  totalBytes: number;
  bytesTransferred: number;
  speed: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  currentFile: string | null;
  currentFolder: string | null;
  conflictPolicy: ConflictPolicy | null;
  cancelled: boolean;
}
