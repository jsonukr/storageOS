import { TransferQueue } from "./TransferQueue";
import type { TransferJob, TransferType } from "./types";
import { onBridgeEvent, pauseTransfer, resumeTransfer, cancelTransfer } from "@/lib/tauri";

const queue = new TransferQueue();

export const TransferService = {
  addJob(
    type: TransferType,
    name: string,
    source: string,
    destination: string,
    totalBytes: number,
  ): TransferJob {
    return queue.enqueue(type, name, source, destination, totalBytes);
  },

  cancelJob(id: string): void {
    cancelTransfer(id).catch(() => {});
  },

  pauseJob(id: string): void {
    pauseTransfer(id).catch(() => {});
  },

  resumeJob(id: string): void {
    resumeTransfer(id).catch(() => {});
  },

  removeJob(id: string): boolean {
    return queue.dequeue(id);
  },

  clearCompleted(): void {
    queue.clearCompleted();
  },

  getJobs(): readonly TransferJob[] {
    return queue.getJobs();
  },

  getJob(id: string): TransferJob | undefined {
    return queue.getJob(id);
  },

  subscribe(listener: (jobs: readonly TransferJob[]) => void): () => void {
    return queue.subscribe(listener);
  },

  updateProgress(id: string, bytesTransferred: number, totalBytes: number, speed: number): boolean {
    return queue.updateProgress(id, bytesTransferred, totalBytes, speed);
  },

  setStatus(id: string, status: TransferJob["status"], error?: string): boolean {
    return queue.setStatus(id, status, error);
  },
};

onBridgeEvent("transfer:progress", (payload) => {
  const { transferId, status, bytesTransferred, totalBytes, speedBytesPerSecond, error } = payload;

  if (status === "completed") {
    TransferService.setStatus(transferId, "completed");
  } else if (status === "failed") {
    TransferService.setStatus(transferId, "failed", error ?? "Transfer failed");
  } else if (status === "cancelled") {
    TransferService.setStatus(transferId, "cancelled");
  } else if (status === "paused") {
    TransferService.setStatus(transferId, "paused");
  } else {
    TransferService.updateProgress(transferId, bytesTransferred, totalBytes, speedBytesPerSecond);
  }
});
