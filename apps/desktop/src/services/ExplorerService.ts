import { listDirectory, listDrives, createFolder, renameItem, deleteItem, copyItem, moveItem, searchDirectory } from "@/lib/tauri";
import type { DirectoryEntry, LocalDriveInfo, OperationResult } from "@/lib/tauri";
import { getAgentClient } from "@/services/agent";

export type { DirectoryEntry, LocalDriveInfo, OperationResult };

export const ExplorerService = {
  async listDrives(): Promise<LocalDriveInfo[]> {
    const client = getAgentClient();
    if (client?.isConnected()) {
      try {
        return await client.fetchRoots();
      } catch {
        // Agent request failed — fall back to Tauri IPC
      }
    }
    return listDrives();
  },

  async listDirectory(path: string): Promise<DirectoryEntry[]> {
    const client = getAgentClient();
    if (client?.isConnected()) {
      try {
        return await client.fetchDirectory(path);
      } catch {
        // Agent request failed — fall back to Tauri IPC
      }
    }
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
