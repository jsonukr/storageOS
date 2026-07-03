import { create } from "zustand";
import { TransferService, FolderTransferService } from "@/services/transfer";
import { startTransfer } from "@/lib/tauri";
import type { TransferJob, TransferType, FolderTransfer } from "@/services/transfer";

interface TransferState {
  jobs: readonly TransferJob[];
  folderTransfers: readonly FolderTransfer[];
  addJob: (type: TransferType, name: string, source: string, destination: string, totalBytes: number) => TransferJob;
  cancelJob: (id: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  removeJob: (id: string) => void;
  retryJob: (id: string) => void;
  cancelFolderTransfer: (id: string) => void;
  removeFolderTransfer: (id: string) => void;
  clearCompleted: () => void;
  isChildJob: (id: string) => boolean;
}

function syncState(): { jobs: readonly TransferJob[]; folderTransfers: readonly FolderTransfer[] } {
  return {
    jobs: TransferService.getJobs(),
    folderTransfers: FolderTransferService.getTransfers(),
  };
}

export const useTransferStore = create<TransferState>((set) => {
  TransferService.subscribe(() => {
    set(syncState());
  });

  FolderTransferService.subscribe(() => {
    set(syncState());
  });

  return {
    ...syncState(),

    addJob: (type, name, source, destination, totalBytes) => {
      return TransferService.addJob(type, name, source, destination, totalBytes);
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

    cancelFolderTransfer: (id) => {
      FolderTransferService.cancelFolderTransfer(id);
    },

    removeFolderTransfer: (id) => {
      FolderTransferService.removeFolderTransfer(id);
    },

    clearCompleted: () => {
      TransferService.clearCompleted();
      FolderTransferService.clearCompleted();
    },

    isChildJob: (id) => {
      return FolderTransferService.isChildJob(id);
    },
  };
});
