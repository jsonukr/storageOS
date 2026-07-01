import { create } from "zustand";
import { TransferService } from "@/services/transfer";
import { startTransfer } from "@/lib/tauri";
import type { TransferJob, TransferType } from "@/services/transfer";

interface TransferState {
  jobs: readonly TransferJob[];
  addJob: (type: TransferType, name: string, source: string, destination: string, totalBytes: number) => TransferJob;
  cancelJob: (id: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  removeJob: (id: string) => void;
  retryJob: (id: string) => void;
  clearCompleted: () => void;
}

function syncJobs(): { jobs: readonly TransferJob[] } {
  return { jobs: TransferService.getJobs() };
}

export const useTransferStore = create<TransferState>((set) => {
  TransferService.subscribe(() => {
    set(syncJobs());
  });

  return {
    jobs: TransferService.getJobs(),

    addJob: (type, name, source, destination, totalBytes) => {
      const job = TransferService.addJob(type, name, source, destination, totalBytes);
      return job;
    },

    cancelJob: (id) => {
      TransferService.cancelJob(id);
    },

    pauseJob: (id) => {
      TransferService.pauseJob(id);
    },

    resumeJob: (id) => {
      TransferService.resumeJob(id);
    },

    removeJob: (id) => {
      TransferService.removeJob(id);
    },

    retryJob: (id) => {
      const old = TransferService.getJob(id);
      if (!old || old.status !== "failed") return;
      TransferService.removeJob(id);
      const job = TransferService.addJob(old.type, old.name, old.source, old.destination, 0);
      TransferService.setStatus(job.id, "running");
      startTransfer(job.id, old.source, old.destination, old.type).catch(() =>
        TransferService.setStatus(job.id, "failed", "Failed to start transfer"),
      );
    },

    clearCompleted: () => {
      TransferService.clearCompleted();
    },
  };
});
