import { listDirectory, listDrives, createFolder, renameItem, deleteItem, copyItem, moveItem, searchDirectory } from "@/lib/tauri";
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

  copyTo(source: string, destinationDir: string, overwrite?: boolean, newName?: string): Promise<OperationResult> {
    return copyItem(source, destinationDir, overwrite, newName);
  },

  moveTo(source: string, destinationDir: string, overwrite?: boolean, newName?: string): Promise<OperationResult> {
    return moveItem(source, destinationDir, overwrite, newName);
  },

  searchDirectory(path: string, query: string, recursive?: boolean): Promise<DirectoryEntry[]> {
    return searchDirectory(path, query, recursive);
  },
};
