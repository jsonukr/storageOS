import type { DirectoryEntry } from "@/lib/tauri";
import { createFolder, remoteDownload, remoteUploadFile } from "@/lib/tauri";
import { ExplorerService } from "@/services/ExplorerService";
import { TransferService } from "./TransferService";
import type { FolderTransfer, TransferStatus } from "./types";

interface FlatEntry {
  relativePath: string;
  fullPath: string;
  size: number;
  isDirectory: boolean;
}

let nextId = 1;

const transfers = new Map<string, FolderTransfer>();
const childToParent = new Map<string, string>();
let listeners: Array<(transfers: readonly FolderTransfer[]) => void> = [];

function notify(): void {
  const snapshot = [...transfers.values()];
  for (const fn of listeners) fn(snapshot);
}

function genId(): string {
  return `ft-${nextId++}-${Date.now()}`;
}

function pathSep(p: string): string {
  return p.includes("/") ? "/" : "\\";
}

function joinPath(base: string, relativeNormalized: string): string {
  const sep = pathSep(base);
  const converted = relativeNormalized.replace(/\//g, sep);
  return base.replace(/[\\/]+$/, "") + sep + converted;
}

function parentOfRelative(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : "";
}

async function listRecursive(
  basePath: string,
  mode: "local" | "remote",
  address?: string,
): Promise<FlatEntry[]> {
  const result: FlatEntry[] = [];

  async function walk(dirPath: string): Promise<void> {
    const entries: DirectoryEntry[] =
      mode === "remote"
        ? await ExplorerService.listRemoteDirectory(address!, dirPath)
        : await ExplorerService.listDirectory(dirPath);

    for (const entry of entries) {
      const relative = entry.full_path
        .substring(basePath.length)
        .replace(/^[\\/]+/, "");

      if (entry.is_directory) {
        result.push({
          relativePath: relative,
          fullPath: entry.full_path,
          size: 0,
          isDirectory: true,
        });
        await walk(entry.full_path);
      } else {
        result.push({
          relativePath: relative,
          fullPath: entry.full_path,
          size: entry.size,
          isDirectory: false,
        });
      }
    }
  }

  await walk(basePath);
  return result;
}

async function ensureFolder(
  destRoot: string,
  relativeDir: string,
  created: Set<string>,
  mode: "local" | "remote",
  address?: string,
): Promise<number> {
  const normalized = relativeDir.replace(/\\/g, "/");
  if (!normalized || created.has(normalized)) return 0;

  const parts = normalized.split("/");
  let newCount = 0;

  for (let i = 1; i <= parts.length; i++) {
    const ancestorKey = parts.slice(0, i).join("/");
    if (created.has(ancestorKey)) continue;

    const name = parts[i - 1];
    const parentPath =
      i === 1
        ? destRoot
        : joinPath(destRoot, parts.slice(0, i - 1).join("/"));

    try {
      if (mode === "local") {
        await createFolder(parentPath, name);
      } else {
        await ExplorerService.remoteCreateFolder(address!, parentPath, name);
      }
    } catch {
      // Folder may already exist
    }

    created.add(ancestorKey);
    newCount++;
  }

  return newCount;
}

function waitForJob(jobId: string): Promise<TransferStatus> {
  return new Promise((resolve) => {
    const check = (): boolean => {
      const job = TransferService.getJob(jobId);
      if (!job) {
        resolve("failed");
        return true;
      }
      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled"
      ) {
        resolve(job.status);
        return true;
      }
      return false;
    };
    if (check()) return;
    const unsub = TransferService.subscribe(() => {
      if (check()) unsub();
    });
  });
}

function makeFolderTransfer(
  name: string,
  source: string,
  destination: string,
): FolderTransfer {
  return {
    id: genId(),
    type: "copy",
    name,
    source,
    destination,
    status: "preparing",
    childJobIds: [],
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    skippedFiles: 0,
    totalFolders: 0,
    createdFolders: 0,
    totalBytes: 0,
    bytesTransferred: 0,
    speed: 0,
    startedAt: Date.now(),
    completedAt: null,
    error: null,
    currentFile: null,
    currentFolder: null,
    conflictPolicy: null,
    cancelled: false,
  };
}

function finalize(ft: FolderTransfer): void {
  ft.currentFile = null;
  ft.currentFolder = null;
  ft.completedAt = Date.now();
  ft.speed = 0;

  if (ft.cancelled) {
    ft.status = "cancelled";
  } else if (ft.failedFiles > 0 && ft.completedFiles === 0) {
    ft.status = "failed";
    ft.error = `All ${ft.failedFiles} file(s) failed to transfer`;
  } else if (ft.failedFiles > 0) {
    ft.status = "completed";
    ft.error = `${ft.failedFiles} of ${ft.totalFiles} file(s) failed`;
  } else {
    ft.status = "completed";
  }

  notify();
}

async function runRemoteToLocal(
  ft: FolderTransfer,
  address: string,
  destDir: string,
  folderName: string,
): Promise<void> {
  const entries = await listRecursive(ft.source, "remote", address);
  const files = entries.filter((e) => !e.isDirectory);
  const folders = entries.filter((e) => e.isDirectory);

  ft.totalFiles = files.length;
  ft.totalFolders = folders.length + 1;
  ft.totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  ft.status = "running";
  notify();

  const createdFolders = new Set<string>();

  try {
    await createFolder(destDir, folderName);
  } catch {
    // Exists when overwriting
  }
  ft.createdFolders = 1;
  notify();

  for (const file of files) {
    if (ft.cancelled) break;

    const parent = parentOfRelative(file.relativePath);
    if (parent) {
      ft.currentFolder = parent;
      const newCount = await ensureFolder(
        ft.destination,
        parent,
        createdFolders,
        "local",
      );
      ft.createdFolders = 1 + createdFolders.size;
      if (newCount > 0) notify();
    }

    const fileName = file.relativePath.split(/[\\/]/).pop()!;
    const localDir = parent ? joinPath(ft.destination, parent) : ft.destination;
    const localPath = localDir + "\\" + fileName;
    const url = `http://${address}/download?path=${encodeURIComponent(file.fullPath)}`;

    ft.currentFile = file.relativePath;
    notify();

    const job = TransferService.addJob(
      "copy",
      fileName,
      file.fullPath,
      localDir,
      file.size,
    );
    ft.childJobIds.push(job.id);
    childToParent.set(job.id, ft.id);
    TransferService.setStatus(job.id, "running");

    try {
      await remoteDownload(job.id, url, localPath);
    } catch {
      TransferService.setStatus(job.id, "failed", "Failed to start download");
    }

    const status = await waitForJob(job.id);
    if (status === "completed") {
      ft.completedFiles++;
      ft.bytesTransferred += file.size;
    } else if (status === "cancelled") {
      ft.cancelled = true;
    } else {
      ft.failedFiles++;
    }
    notify();
  }

  // Create any remaining empty directories
  for (const folder of folders) {
    if (ft.cancelled) break;
    if (!createdFolders.has(folder.relativePath.replace(/\\/g, "/"))) {
      await ensureFolder(ft.destination, folder.relativePath, createdFolders, "local");
      ft.createdFolders = 1 + createdFolders.size;
      notify();
    }
  }
}

async function runLocalToRemote(
  ft: FolderTransfer,
  address: string,
  destDir: string,
  folderName: string,
): Promise<void> {
  const entries = await listRecursive(ft.source, "local");
  const files = entries.filter((e) => !e.isDirectory);
  const folders = entries.filter((e) => e.isDirectory);

  ft.totalFiles = files.length;
  ft.totalFolders = folders.length + 1;
  ft.totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  ft.status = "running";
  notify();

  const createdFolders = new Set<string>();

  try {
    await ExplorerService.remoteCreateFolder(address, destDir, folderName);
  } catch {
    // Exists when overwriting
  }
  ft.createdFolders = 1;
  notify();

  for (const file of files) {
    if (ft.cancelled) break;

    const parent = parentOfRelative(file.relativePath);
    if (parent) {
      ft.currentFolder = parent;
      const newCount = await ensureFolder(
        ft.destination,
        parent,
        createdFolders,
        "remote",
        address,
      );
      ft.createdFolders = 1 + createdFolders.size;
      if (newCount > 0) notify();
    }

    const fileName = file.relativePath.split(/[\\/]/).pop()!;
    const remoteDir = parent ? joinPath(ft.destination, parent) : ft.destination;
    const uploadUrl = `http://${address}/upload?path=${encodeURIComponent(remoteDir)}&filename=${encodeURIComponent(fileName)}`;

    ft.currentFile = file.relativePath;
    notify();

    const job = TransferService.addJob(
      "copy",
      fileName,
      file.fullPath,
      remoteDir,
      file.size,
    );
    ft.childJobIds.push(job.id);
    childToParent.set(job.id, ft.id);
    TransferService.setStatus(job.id, "running");

    try {
      await remoteUploadFile(job.id, file.fullPath, uploadUrl);
    } catch {
      TransferService.setStatus(job.id, "failed", "Failed to start upload");
    }

    const status = await waitForJob(job.id);
    if (status === "completed") {
      ft.completedFiles++;
      ft.bytesTransferred += file.size;
    } else if (status === "cancelled") {
      ft.cancelled = true;
    } else {
      ft.failedFiles++;
    }
    notify();
  }

  for (const folder of folders) {
    if (ft.cancelled) break;
    if (!createdFolders.has(folder.relativePath.replace(/\\/g, "/"))) {
      await ensureFolder(
        ft.destination,
        folder.relativePath,
        createdFolders,
        "remote",
        address,
      );
      ft.createdFolders = 1 + createdFolders.size;
      notify();
    }
  }
}

async function runRemoteSameDevice(
  ft: FolderTransfer,
  address: string,
  destDir: string,
  folderName: string,
): Promise<void> {
  const entries = await listRecursive(ft.source, "remote", address);
  const files = entries.filter((e) => !e.isDirectory);
  const folders = entries.filter((e) => e.isDirectory);

  ft.totalFiles = files.length;
  ft.totalFolders = folders.length + 1;
  ft.totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  ft.status = "running";
  notify();

  const createdFolders = new Set<string>();

  try {
    await ExplorerService.remoteCreateFolder(address, destDir, folderName);
  } catch {
    // Exists when overwriting
  }
  ft.createdFolders = 1;
  notify();

  for (const file of files) {
    if (ft.cancelled) break;

    const parent = parentOfRelative(file.relativePath);
    if (parent) {
      ft.currentFolder = parent;
      const newCount = await ensureFolder(
        ft.destination,
        parent,
        createdFolders,
        "remote",
        address,
      );
      ft.createdFolders = 1 + createdFolders.size;
      if (newCount > 0) notify();
    }

    const fileName = file.relativePath.split(/[\\/]/).pop()!;
    const remoteDir = parent ? joinPath(ft.destination, parent) : ft.destination;

    ft.currentFile = file.relativePath;
    notify();

    const job = TransferService.addJob(
      "copy",
      fileName,
      file.fullPath,
      remoteDir,
      file.size,
    );
    ft.childJobIds.push(job.id);
    childToParent.set(job.id, ft.id);
    TransferService.setStatus(job.id, "running");

    const downloadUrl = `http://${address}/download?path=${encodeURIComponent(file.fullPath)}`;

    try {
      const resp = await fetch(downloadUrl);
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const uploadFile = new File([blob], fileName);
      const form = new FormData();
      form.append("file", uploadFile);
      const uploadUrl = `http://${address}/upload?path=${encodeURIComponent(remoteDir)}&filename=${encodeURIComponent(fileName)}`;
      const uploadResp = await fetch(uploadUrl, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(300000),
      });
      if (!uploadResp.ok) throw new Error("Upload failed");
      TransferService.setStatus(job.id, "completed");
    } catch {
      TransferService.setStatus(job.id, "failed", "Failed to copy on device");
    }

    const completedJob = TransferService.getJob(job.id);
    if (completedJob?.status === "completed") {
      ft.completedFiles++;
      ft.bytesTransferred += file.size;
    } else {
      ft.failedFiles++;
    }
    notify();
  }

  for (const folder of folders) {
    if (ft.cancelled) break;
    if (!createdFolders.has(folder.relativePath.replace(/\\/g, "/"))) {
      await ensureFolder(
        ft.destination,
        folder.relativePath,
        createdFolders,
        "remote",
        address,
      );
      ft.createdFolders = 1 + createdFolders.size;
      notify();
    }
  }
}

export const FolderTransferService = {
  subscribe(
    listener: (transfers: readonly FolderTransfer[]) => void,
  ): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  getTransfers(): readonly FolderTransfer[] {
    return [...transfers.values()];
  },

  getTransfer(id: string): FolderTransfer | undefined {
    return transfers.get(id);
  },

  isChildJob(jobId: string): boolean {
    return childToParent.has(jobId);
  },

  getParentId(jobId: string): string | undefined {
    return childToParent.get(jobId);
  },

  cancelFolderTransfer(id: string): void {
    const ft = transfers.get(id);
    if (
      !ft ||
      ft.status === "completed" ||
      ft.status === "cancelled" ||
      ft.status === "failed"
    )
      return;

    ft.cancelled = true;

    for (const jobId of ft.childJobIds) {
      const job = TransferService.getJob(jobId);
      if (job && (job.status === "running" || job.status === "queued")) {
        TransferService.cancelJob(jobId);
      }
    }
  },

  removeFolderTransfer(id: string): void {
    const ft = transfers.get(id);
    if (!ft) return;
    for (const jobId of ft.childJobIds) {
      childToParent.delete(jobId);
      TransferService.removeJob(jobId);
    }
    transfers.delete(id);
    notify();
  },

  clearCompleted(): void {
    for (const [id, ft] of transfers) {
      if (
        ft.status === "completed" ||
        ft.status === "cancelled" ||
        ft.status === "failed"
      ) {
        for (const jobId of ft.childJobIds) {
          childToParent.delete(jobId);
          TransferService.removeJob(jobId);
        }
        transfers.delete(id);
      }
    }
    notify();
  },

  startRemoteToLocal(
    address: string,
    sourcePath: string,
    destDir: string,
    folderName: string,
  ): string {
    const destFolderPath =
      destDir.replace(/[\\/]+$/, "") + "\\" + folderName;
    const ft = makeFolderTransfer(folderName, sourcePath, destFolderPath);
    transfers.set(ft.id, ft);
    notify();

    runRemoteToLocal(ft, address, destDir, folderName)
      .catch((err) => {
        ft.status = "failed";
        ft.completedAt = Date.now();
        ft.error = err instanceof Error ? err.message : String(err);
        ft.currentFile = null;
        ft.currentFolder = null;
        notify();
      })
      .then(() => {
        if (!ft.completedAt) finalize(ft);
      });

    return ft.id;
  },

  startLocalToRemote(
    address: string,
    sourcePath: string,
    destDir: string,
    folderName: string,
  ): string {
    const sep = pathSep(destDir);
    const destFolderPath =
      destDir.replace(/[\\/]+$/, "") + sep + folderName;
    const ft = makeFolderTransfer(folderName, sourcePath, destFolderPath);
    transfers.set(ft.id, ft);
    notify();

    runLocalToRemote(ft, address, destDir, folderName)
      .catch((err) => {
        ft.status = "failed";
        ft.completedAt = Date.now();
        ft.error = err instanceof Error ? err.message : String(err);
        ft.currentFile = null;
        ft.currentFolder = null;
        notify();
      })
      .then(() => {
        if (!ft.completedAt) finalize(ft);
      });

    return ft.id;
  },

  startRemoteSameDevice(
    address: string,
    sourcePath: string,
    destDir: string,
    folderName: string,
  ): string {
    const sep = pathSep(destDir);
    const destFolderPath =
      destDir.replace(/[\\/]+$/, "") + sep + folderName;
    const ft = makeFolderTransfer(folderName, sourcePath, destFolderPath);
    transfers.set(ft.id, ft);
    notify();

    runRemoteSameDevice(ft, address, destDir, folderName)
      .catch((err) => {
        ft.status = "failed";
        ft.completedAt = Date.now();
        ft.error = err instanceof Error ? err.message : String(err);
        ft.currentFile = null;
        ft.currentFolder = null;
        notify();
      })
      .then(() => {
        if (!ft.completedAt) finalize(ft);
      });

    return ft.id;
  },
};
