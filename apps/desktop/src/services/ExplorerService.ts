import { listDirectory, listDrives, createFolder, renameItem, deleteItem } from "@/lib/tauri";
import type { DirectoryEntry, LocalDriveInfo, OperationResult } from "@/lib/tauri";

export type { DirectoryEntry, LocalDriveInfo, OperationResult };

export const ExplorerService = {
  listDrives(): Promise<LocalDriveInfo[]> {
    return listDrives();
  },

  listDirectory(path: string): Promise<DirectoryEntry[]> {
    return listDirectory(path);
  },

  createFolder(parent: string, name: string): Promise<OperationResult> {
    return createFolder(parent, name);
  },

  rename(path: string, newName: string): Promise<OperationResult> {
    return renameItem(path, newName);
  },

  delete(path: string): Promise<OperationResult> {
    return deleteItem(path);
  },
};
