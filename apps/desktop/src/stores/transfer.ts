import { create } from "zustand";
import { TransferService } from "@/services/transfer";
import type { TransferJob, TransferType } from "@/services/transfer";

interface TransferState {
  jobs: readonly TransferJob[];
  addJob: (type: TransferType, name: string, source: string, destination: string, totalBytes: number) => TransferJob;
  cancelJob: (id: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  removeJob: (id: string) => void;
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

    clearCompleted: () => {
      TransferService.clearCompleted();
    },
  };
});
