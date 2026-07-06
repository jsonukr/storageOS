import { listDirectory, listDrives, createFolder, renameItem, deleteItem, copyItem, moveItem, searchDirectory, remoteDownload, remoteUploadFile, startTransfer } from "@/lib/tauri";
import type { DirectoryEntry, LocalDriveInfo, OperationResult } from "@/lib/tauri";
import { getAgentClient } from "@/services/agent";
import { remoteFetch, buildRemoteUrl, recordTransferResult } from "@/services/network";
import { TransferService } from "@/services/transfer";

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

  async remoteCreateFolder(deviceId: string, parent: string, name: string): Promise<OperationResult> {
    const r = await remoteFetch({
      deviceId,
      path: "/mkdir",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent, name }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ message: "Failed to create folder" }));
      throw new Error(err.message);
    }
    return r.json();
  },

  async remoteRename(deviceId: string, path: string, newName: string): Promise<OperationResult> {
    const r = await remoteFetch({
      deviceId,
      path: "/rename",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, new_name: newName }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ message: "Failed to rename" }));
      throw new Error(err.message);
    }
    return r.json();
  },

  async remoteDelete(deviceId: string, path: string): Promise<OperationResult> {
    const r = await remoteFetch({
      deviceId,
      path: `/entry?path=${encodeURIComponent(path)}`,
      method: "DELETE",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ message: "Failed to delete" }));
      throw new Error(err.message);
    }
    return r.json();
  },

  async remoteUpload(deviceId: string, destPath: string, file: File): Promise<OperationResult> {
    const form = new FormData();
    form.append("file", file);
    const r = await remoteFetch({
      deviceId,
      path: `/upload?path=${encodeURIComponent(destPath)}&filename=${encodeURIComponent(file.name)}`,
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(300000),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ message: "Failed to upload" }));
      throw new Error(err.message);
    }
    return r.json();
  },

  async remoteDownloadUrl(deviceId: string, path: string): Promise<string> {
    const url = buildRemoteUrl(deviceId, `/download?path=${encodeURIComponent(path)}`);
    if (!url) throw new Error(`No connection for device ${deviceId}`);
    return url;
  },

  remoteDownloadFile(deviceId: string, remotePath: string, localDestDir: string, fileName: string, size: number): void {
    const url = buildRemoteUrl(deviceId, `/download?path=${encodeURIComponent(remotePath)}`);
    if (!url) return;
    const destPath = `${localDestDir.replace(/[\\/]+$/, "")}\\${fileName}`;
    const job = TransferService.addJob("copy", fileName, remotePath, localDestDir, size);
    TransferService.setStatus(job.id, "running");
    const start = performance.now();
    remoteDownload(job.id, url, destPath)
      .then(() => recordTransferResult(deviceId, true, performance.now() - start))
      .catch(() => {
        recordTransferResult(deviceId, false);
        TransferService.setStatus(job.id, "failed", "Failed to start download");
      });
  },

  remoteUploadToDevice(deviceId: string, localPath: string, remoteDestDir: string, fileName: string, size: number): void {
    const uploadUrl = buildRemoteUrl(deviceId, `/upload?path=${encodeURIComponent(remoteDestDir)}&filename=${encodeURIComponent(fileName)}`);
    if (!uploadUrl) return;
    const job = TransferService.addJob("copy", fileName, localPath, remoteDestDir, size);
    TransferService.setStatus(job.id, "running");
    const start = performance.now();
    remoteUploadFile(job.id, localPath, uploadUrl)
      .then(() => recordTransferResult(deviceId, true, performance.now() - start))
      .catch(() => {
        recordTransferResult(deviceId, false);
        TransferService.setStatus(job.id, "failed", "Failed to start upload");
      });
  },

  remoteCopyOnDevice(deviceId: string, sourcePath: string, destDir: string, fileName: string, size: number): void {
    const job = TransferService.addJob("copy", fileName, sourcePath, destDir, size);
    TransferService.setStatus(job.id, "running");
    const start = performance.now();
    remoteFetch({
      deviceId,
      path: `/download?path=${encodeURIComponent(sourcePath)}`,
      retry: false,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Download failed");
        return r.blob();
      })
      .then((blob) => {
        const file = new File([blob], fileName);
        const form = new FormData();
        form.append("file", file);
        return remoteFetch({
          deviceId,
          path: `/upload?path=${encodeURIComponent(destDir)}&filename=${encodeURIComponent(fileName)}`,
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(300000),
          retry: false,
        });
      })
      .then((r) => {
        if (!r.ok) throw new Error("Upload failed");
        recordTransferResult(deviceId, true, performance.now() - start);
        TransferService.setStatus(job.id, "completed");
      })
      .catch(() => {
        recordTransferResult(deviceId, false);
        TransferService.setStatus(job.id, "failed", "Failed to copy on device");
      });
  },

  uploadToLocal(sourcePath: string, destDir: string, fileName: string, size: number): void {
    const job = TransferService.addJob("copy", fileName, sourcePath, destDir, size);
    TransferService.setStatus(job.id, "running");
    startTransfer(job.id, sourcePath, destDir, "copy").catch(() =>
      TransferService.setStatus(job.id, "failed", "Failed to start copy"),
    );
  },

  async listRemoteRoots(deviceId: string): Promise<LocalDriveInfo[]> {
    const r = await remoteFetch({
      deviceId,
      path: "/roots",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error("Failed to load remote drives");
    return r.json();
  },

  async listRemoteDirectory(deviceId: string, path: string): Promise<DirectoryEntry[]> {
    const r = await remoteFetch({
      deviceId,
      path: `/directory?path=${encodeURIComponent(path)}`,
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error("Failed to load remote directory");
    return r.json();
  },
};
