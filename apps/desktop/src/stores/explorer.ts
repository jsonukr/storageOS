import { create } from "zustand";
import type { DirectoryEntry, FileAttributes, SearchProgressPayload } from "@/lib/tauri";
import { onBridgeEvent, startTransfer, setHidden, setReadonly, getAttributes } from "@/lib/tauri";
import { ExplorerService } from "@/services/ExplorerService";
import { ExplorerSortService } from "@/services/ExplorerSortService";
import type { SortField, SortDirection, SortConfig } from "@/services/ExplorerSortService";
import { ClipboardService } from "@/services/clipboard";
import type { ClipboardItem } from "@/services/clipboard";
import { TransferService, FolderTransferService } from "@/services/transfer";

type ViewMode = "extra_large" | "large" | "medium" | "small" | "list" | "details";

const VIEW_STORAGE_KEY = "storageos:viewMode";
const HIDDEN_ITEMS_KEY = "storageos:showHiddenItems";
const FILE_EXT_KEY = "storageos:showFileExtensions";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp"]);

function isImageFile(entry: DirectoryEntry): boolean {
  return !entry.is_directory && IMAGE_EXTENSIONS.has((entry.extension ?? "").toLowerCase());
}

const initialSortConfig = ExplorerSortService.loadConfig();
const initialShowHiddenItems = localStorage.getItem(HIDDEN_ITEMS_KEY) === "true";
const initialShowFileExtensions = localStorage.getItem(FILE_EXT_KEY) !== "false";
const initialViewMode: ViewMode = (() => {
  const saved = localStorage.getItem(VIEW_STORAGE_KEY);
  if (saved && ["extra_large", "large", "medium", "small", "list", "details"].includes(saved)) return saved as ViewMode;
  return "details";
})();

interface ExplorerState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  sortField: SortField;
  sortDirection: SortDirection;
  foldersFirst: boolean;
  setSortField: (field: SortField) => void;
  setSortDirection: (dir: SortDirection) => void;
  toggleFoldersFirst: () => void;

  navPanelWidth: number;
  setNavPanelWidth: (width: number) => void;
  propertiesOpen: boolean;
  toggleProperties: () => void;
  propertiesWidth: number;
  setPropertiesWidth: (width: number) => void;

  currentPath: string | null;
  entries: DirectoryEntry[];
  loading: boolean;
  error: string | null;
  selectedEntries: DirectoryEntry[];
  historyStack: string[];
  forwardStack: string[];

  navigateTo: (path: string) => void;
  openEntry: (entry: DirectoryEntry) => void;
  selectEntry: (entry: DirectoryEntry | null, ctrl?: boolean, shift?: boolean) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  refresh: () => void;

  operationLoading: boolean;
  operationError: string | null;
  clearOperationError: () => void;
  createFolder: (name: string) => Promise<boolean>;
  renameEntry: (entry: DirectoryEntry, newName: string) => Promise<boolean>;
  deleteEntry: () => Promise<boolean>;

  contextMenu: { x: number; y: number; entry: DirectoryEntry | null } | null;
  showContextMenu: (x: number, y: number, entry: DirectoryEntry | null) => void;
  hideContextMenu: () => void;

  newFolderDialogOpen: boolean;
  openNewFolderDialog: () => void;
  closeNewFolderDialog: () => void;

  renameTarget: DirectoryEntry | null;
  startRename: (entry: DirectoryEntry) => void;
  cancelRename: () => void;

  deleteTargets: DirectoryEntry[];
  confirmDelete: (entries: DirectoryEntry[]) => void;
  cancelDelete: () => void;

  searchQuery: string;
  searchResults: DirectoryEntry[] | null;
  searchLoading: boolean;
  searchError: string | null;
  searchRecursive: boolean;
  setSearchRecursive: (recursive: boolean) => void;
  searchProgress: SearchProgressPayload | null;
  searchDurationMs: number | null;
  performSearch: (query: string) => void;
  clearSearch: () => void;

  clipboardCount: number;
  clipboardOperation: "copy" | "cut";
  copyEntries: (entries: DirectoryEntry[]) => void;
  cutEntries: (entries: DirectoryEntry[]) => void;
  pasteEntries: (overwrite?: boolean, newName?: string) => void;

  pasteConflict: {
    sourcePath: string;
    destDir: string;
    fileName: string;
    isCut: boolean;
    providerId: string;
    remainingItems: Array<{ path: string }>;
  } | null;
  resolvePasteConflict: (resolution: "replace" | "keep_both" | "cancel") => void;

  showHiddenItems: boolean;
  toggleShowHiddenItems: () => void;
  showFileExtensions: boolean;
  toggleShowFileExtensions: () => void;

  setEntryHidden: (entries: DirectoryEntry[], hidden: boolean) => Promise<void>;
  setEntryReadonly: (entries: DirectoryEntry[], readonly: boolean) => Promise<void>;
  selectedAttributes: FileAttributes | null;
  loadSelectedAttributes: () => void;

  notification: string | null;
  clearNotification: () => void;

  spaceError: {
    transferId: string;
    error: string;
    destination: string;
    source: string;
    transferType: string;
    name: string;
  } | null;
  dismissSpaceError: () => void;
  retrySpaceError: () => void;

  remoteDevice: { address: string; name: string } | null;
  browseRemoteDevice: (address: string, name: string) => void;
  exitRemoteBrowse: () => void;

  previewImages: DirectoryEntry[];
  previewIndex: number;
  openImagePreview: (entry: DirectoryEntry) => void;
  closeImagePreview: () => void;
  previewNext: () => void;
  previewPrev: () => void;
}

let searchGeneration = 0;
let searchStartTime = 0;

function getSortConfig(): SortConfig {
  const s = useExplorerStore.getState();
  return { field: s.sortField, direction: s.sortDirection, foldersFirst: s.foldersFirst };
}

function loadDirectory(path: string, set: (partial: Partial<ExplorerState>) => void) {
  searchGeneration++;
  set({ currentPath: path, loading: true, error: null, entries: [], selectedEntries: [], searchQuery: "", searchResults: null, searchLoading: false, searchError: null, searchProgress: null, searchDurationMs: null });
  const remote = useExplorerStore.getState().remoteDevice;
  const promise = remote
    ? ExplorerService.listRemoteDirectory(remote.address, path)
    : ExplorerService.listDirectory(path);
  promise
    .then((entries) => set({ entries: ExplorerSortService.sort(entries, getSortConfig()), loading: false }))
    .catch((err) =>
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
}

function getParentPath(path: string): string | null {
  const normalized = path.replace(/[\\/]+$/, "");
  if (/^[A-Za-z]:$/.test(normalized)) return null;
  const sep = normalized.lastIndexOf("\\");
  const fwdSep = normalized.lastIndexOf("/");
  const lastSep = Math.max(sep, fwdSep);
  if (lastSep <= 0) return null;
  const parent = normalized.substring(0, lastSep);
  if (/^[A-Za-z]:$/.test(parent)) return parent + "\\";
  return parent;
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  viewMode: initialViewMode,
  setViewMode: (mode) => {
    localStorage.setItem(VIEW_STORAGE_KEY, mode);
    set({ viewMode: mode });
  },

  sortField: initialSortConfig.field,
  sortDirection: initialSortConfig.direction,
  foldersFirst: initialSortConfig.foldersFirst,
  setSortField: (field) => {
    const { sortDirection, foldersFirst, entries, searchResults } = get();
    const config: SortConfig = { field, direction: sortDirection, foldersFirst };
    ExplorerSortService.saveConfig(config);
    const sorted = ExplorerSortService.sort(entries, config);
    const sortedSearch = searchResults ? ExplorerSortService.sort(searchResults, config) : null;
    set({ sortField: field, entries: sorted, searchResults: sortedSearch, selectedEntries: [] });
  },
  setSortDirection: (dir) => {
    const { sortField, foldersFirst, entries, searchResults } = get();
    const config: SortConfig = { field: sortField, direction: dir, foldersFirst };
    ExplorerSortService.saveConfig(config);
    const sorted = ExplorerSortService.sort(entries, config);
    const sortedSearch = searchResults ? ExplorerSortService.sort(searchResults, config) : null;
    set({ sortDirection: dir, entries: sorted, searchResults: sortedSearch, selectedEntries: [] });
  },
  toggleFoldersFirst: () => {
    const { sortField, sortDirection, foldersFirst, entries, searchResults } = get();
    const newVal = !foldersFirst;
    const config: SortConfig = { field: sortField, direction: sortDirection, foldersFirst: newVal };
    ExplorerSortService.saveConfig(config);
    const sorted = ExplorerSortService.sort(entries, config);
    const sortedSearch = searchResults ? ExplorerSortService.sort(searchResults, config) : null;
    set({ foldersFirst: newVal, entries: sorted, searchResults: sortedSearch, selectedEntries: [] });
  },

  navPanelWidth: 240,
  setNavPanelWidth: (width) => set({ navPanelWidth: width }),
  propertiesOpen: false,
  toggleProperties: () => set((s) => ({ propertiesOpen: !s.propertiesOpen })),
  propertiesWidth: 280,
  setPropertiesWidth: (width) => set({ propertiesWidth: width }),

  currentPath: null,
  entries: [],
  loading: false,
  error: null,
  selectedEntries: [],
  historyStack: [],
  forwardStack: [],

  navigateTo: (path: string) => {
    const { currentPath } = get();
    const history = currentPath !== null
      ? [...get().historyStack, currentPath]
      : get().historyStack;
    set({ historyStack: history, forwardStack: [] });
    loadDirectory(path, set);
  },

  openEntry: (entry: DirectoryEntry) => {
    if (!entry.is_directory) {
      if (isImageFile(entry)) {
        get().openImagePreview(entry);
      }
      return;
    }
    const { currentPath } = get();
    const history = currentPath !== null
      ? [...get().historyStack, currentPath]
      : get().historyStack;
    set({ historyStack: history, forwardStack: [] });
    loadDirectory(entry.full_path, set);
  },

  selectEntry: (entry: DirectoryEntry | null, ctrl?: boolean, shift?: boolean) => {
    if (!entry) { set({ selectedEntries: [] }); return; }
    const { selectedEntries, entries, searchResults } = get();
    const list = searchResults ?? entries;

    if (shift && selectedEntries.length > 0) {
      const anchor = selectedEntries[0];
      const anchorIdx = list.findIndex((e) => e.full_path === anchor.full_path);
      const targetIdx = list.findIndex((e) => e.full_path === entry.full_path);
      if (anchorIdx >= 0 && targetIdx >= 0) {
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        set({ selectedEntries: list.slice(start, end + 1) });
        return;
      }
    }

    if (ctrl) {
      const exists = selectedEntries.some((e) => e.full_path === entry.full_path);
      if (exists) {
        set({ selectedEntries: selectedEntries.filter((e) => e.full_path !== entry.full_path) });
      } else {
        set({ selectedEntries: [...selectedEntries, entry] });
      }
      return;
    }

    set({ selectedEntries: [entry] });
  },

  goBack: () => {
    const { historyStack, currentPath } = get();
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    const newHistory = historyStack.slice(0, -1);
    const forward = currentPath !== null
      ? [currentPath, ...get().forwardStack]
      : get().forwardStack;
    set({ historyStack: newHistory, forwardStack: forward });
    loadDirectory(previous, set);
  },

  goForward: () => {
    const { forwardStack, currentPath } = get();
    if (forwardStack.length === 0) return;
    const next = forwardStack[0];
    const newForward = forwardStack.slice(1);
    const history = currentPath !== null
      ? [...get().historyStack, currentPath]
      : get().historyStack;
    set({ historyStack: history, forwardStack: newForward });
    loadDirectory(next, set);
  },

  goUp: () => {
    const { currentPath } = get();
    if (currentPath === null) return;
    const parent = getParentPath(currentPath);
    if (parent === null) return;
    const history = [...get().historyStack, currentPath];
    set({ historyStack: history, forwardStack: [] });
    loadDirectory(parent, set);
  },

  refresh: () => {
    const { currentPath } = get();
    if (currentPath === null) return;
    loadDirectory(currentPath, set);
  },

  operationLoading: false,
  operationError: null,
  clearOperationError: () => set({ operationError: null }),

  createFolder: async (name: string): Promise<boolean> => {
    const { currentPath, remoteDevice } = get();
    if (currentPath === null) return false;
    set({ operationLoading: true, operationError: null });
    try {
      if (remoteDevice) {
        await ExplorerService.remoteCreateFolder(remoteDevice.address, currentPath, name);
      } else {
        await ExplorerService.createFolder(currentPath, name);
      }
      set({ operationLoading: false, newFolderDialogOpen: false });
      loadDirectory(currentPath, set);
      return true;
    } catch (err) {
      set({
        operationLoading: false,
        operationError: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  },

  renameEntry: async (entry: DirectoryEntry, newName: string): Promise<boolean> => {
    const { remoteDevice } = get();
    set({ operationLoading: true, operationError: null });
    try {
      if (remoteDevice) {
        await ExplorerService.remoteRename(remoteDevice.address, entry.full_path, newName);
      } else {
        await ExplorerService.rename(entry.full_path, newName);
      }
      set({ operationLoading: false, renameTarget: null });
      const { currentPath } = get();
      if (currentPath) loadDirectory(currentPath, set);
      return true;
    } catch (err) {
      set({
        operationLoading: false,
        operationError: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  },

  deleteEntry: async (): Promise<boolean> => {
    const targets = get().deleteTargets;
    if (targets.length === 0) return false;
    const { remoteDevice } = get();
    set({ operationLoading: true, operationError: null });
    try {
      for (const entry of targets) {
        if (remoteDevice) {
          await ExplorerService.remoteDelete(remoteDevice.address, entry.full_path);
        } else {
          await ExplorerService.delete(entry.full_path);
        }
      }
      set({ operationLoading: false, deleteTargets: [], selectedEntries: [] });
      const { currentPath } = get();
      if (currentPath) loadDirectory(currentPath, set);
      window.dispatchEvent(new Event("drives:invalidate"));
      return true;
    } catch (err) {
      set({
        operationLoading: false,
        operationError: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  },

  contextMenu: null,
  showContextMenu: (x, y, entry) => set({ contextMenu: { x, y, entry } }),
  hideContextMenu: () => set({ contextMenu: null }),

  newFolderDialogOpen: false,
  openNewFolderDialog: () => set({ newFolderDialogOpen: true, operationError: null }),
  closeNewFolderDialog: () => set({ newFolderDialogOpen: false, operationError: null }),

  renameTarget: null,
  startRename: (entry) => set({ renameTarget: entry, operationError: null, contextMenu: null }),
  cancelRename: () => set({ renameTarget: null, operationError: null }),

  deleteTargets: [],
  confirmDelete: (entries) => set({ deleteTargets: entries, operationError: null, contextMenu: null }),
  cancelDelete: () => set({ deleteTargets: [], operationError: null }),

  searchQuery: "",
  searchResults: null,
  searchLoading: false,
  searchError: null,
  searchRecursive: false,
  setSearchRecursive: (recursive: boolean) => set({ searchRecursive: recursive }),
  searchProgress: null,
  searchDurationMs: null,

  performSearch: (query: string) => {
    const { currentPath, searchRecursive } = get();
    if (!query.trim()) {
      set({ searchQuery: "", searchResults: null, searchLoading: false, searchError: null, searchProgress: null, searchDurationMs: null });
      return;
    }
    if (!currentPath) {
      set({ searchQuery: query, searchResults: null, searchLoading: false, searchError: "Select a folder to search", searchProgress: null, searchDurationMs: null });
      return;
    }
    const gen = ++searchGeneration;
    searchStartTime = performance.now();
    set({ searchQuery: query, searchLoading: true, searchError: null, searchProgress: null, searchDurationMs: null });
    ExplorerService.searchDirectory(currentPath, query.trim(), searchRecursive)
      .then((results) => {
        if (gen !== searchGeneration) return;
        const duration = performance.now() - searchStartTime;
        const sorted = ExplorerSortService.sort(results, getSortConfig());
        set({ searchResults: sorted, searchLoading: false, selectedEntries: [], searchDurationMs: duration, searchProgress: null });
      })
      .catch((err) => {
        if (gen !== searchGeneration) return;
        set({
          searchLoading: false,
          searchError: err instanceof Error ? err.message : String(err),
          searchProgress: null,
        });
      });
  },

  clearSearch: () => {
    searchGeneration++;
    set({ searchQuery: "", searchResults: null, searchLoading: false, searchError: null, searchProgress: null, searchDurationMs: null });
  },

  clipboardCount: 0,
  clipboardOperation: "copy" as const,

  copyEntries: (entries: DirectoryEntry[]) => {
    const remote = get().remoteDevice;
    const providerId = remote ? `remote:${remote.address}` : "local";
    ClipboardService.copy(
      entries.map((e) => ({
        providerId,
        path: e.full_path,
        type: e.is_directory ? "directory" as const : "file" as const,
        size: e.size,
        name: e.name,
      })),
    );
    const names = entries.map((e) => e.name).join(", ");
    set({ notification: `Copied: ${names}` });
  },

  cutEntries: (entries: DirectoryEntry[]) => {
    const remote = get().remoteDevice;
    const providerId = remote ? `remote:${remote.address}` : "local";
    ClipboardService.cut(
      entries.map((e) => ({
        providerId,
        path: e.full_path,
        type: e.is_directory ? "directory" as const : "file" as const,
        size: e.size,
        name: e.name,
      })),
    );
    const names = entries.map((e) => e.name).join(", ");
    set({ notification: `Cut: ${names}` });
  },

  pasteEntries: (overwrite?: boolean, newName?: string) => {
    const { currentPath, pasteConflict, entries, remoteDevice } = get();
    if (!currentPath) return;

    let clipboardItems: readonly ClipboardItem[];
    let isCut: boolean;

    if (pasteConflict && (overwrite || newName)) {
      const resumeItems = ClipboardService.getItems().filter(
        (it) => it.path === pasteConflict.sourcePath || pasteConflict.remainingItems.some((r) => r.path === it.path),
      );
      clipboardItems = resumeItems.length > 0 ? resumeItems : [{ providerId: pasteConflict.providerId, path: pasteConflict.sourcePath, type: "file" as const, size: 0, name: pasteConflict.fileName }];
      isCut = pasteConflict.isCut;
      set({ pasteConflict: null });
    } else {
      if (!ClipboardService.hasItems()) return;
      clipboardItems = ClipboardService.getItems();
      isCut = ClipboardService.isCutOperation();
    }

    const sourceIsRemote = clipboardItems.length > 0 && clipboardItems[0].providerId.startsWith("remote:");
    const sourceAddress = sourceIsRemote ? clipboardItems[0].providerId.substring(7) : null;
    const destIsRemote = !!remoteDevice;

    if (isCut && (sourceIsRemote || destIsRemote)) {
      isCut = false;
    }

    const existingNames = new Set(entries.map((e) => e.name));
    const firstItemOverwrite = overwrite;
    const firstItemNewName = newName;
    let queued = 0;
    let skippedSameDir = 0;

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      const ow = i === 0 ? firstItemOverwrite : undefined;
      const nn = i === 0 ? firstItemNewName : undefined;
      const fileName = nn ?? item.path.split(/[\\/]/).pop() ?? "file";

      const itemParent = item.path.replace(/[\\/][^\\/]+$/, "");
      const normalizedParent = itemParent.replace(/[\\/]+$/, "").toLowerCase();
      const normalizedDest = currentPath.replace(/[\\/]+$/, "").toLowerCase();
      if (isCut && !nn && normalizedParent === normalizedDest) {
        skippedSameDir++;
        continue;
      }

      if (!ow && !nn && existingNames.has(fileName)) {
        set({
          pasteConflict: {
            sourcePath: item.path,
            destDir: currentPath,
            fileName,
            isCut,
            providerId: item.providerId,
            remainingItems: clipboardItems.slice(i + 1).map((it) => ({ path: it.path })),
          },
        });
        return;
      }

      if (sourceIsRemote && !destIsRemote) {
        if (item.type === "directory") {
          FolderTransferService.startRemoteToLocal(sourceAddress!, item.path, currentPath, fileName);
        } else {
          ExplorerService.remoteDownloadFile(sourceAddress!, item.path, currentPath, fileName, item.size);
        }
        queued++;
      } else if (!sourceIsRemote && destIsRemote) {
        if (item.type === "directory") {
          FolderTransferService.startLocalToRemote(remoteDevice!.address, item.path, currentPath, fileName);
        } else {
          ExplorerService.remoteUploadToDevice(remoteDevice!.address, item.path, currentPath, fileName, item.size);
        }
        queued++;
      } else if (!sourceIsRemote && !destIsRemote) {
        const transferType = isCut ? "move" : "copy";
        const job = TransferService.addJob(transferType as "copy" | "move", fileName, item.path, currentPath, 0);
        TransferService.setStatus(job.id, "running");
        startTransfer(job.id, item.path, currentPath, transferType, ow, nn).catch(() =>
          TransferService.setStatus(job.id, "failed", "Failed to start transfer"),
        );
        queued++;
      } else if (sourceIsRemote && destIsRemote && sourceAddress === remoteDevice!.address) {
        if (item.type === "directory") {
          FolderTransferService.startRemoteSameDevice(remoteDevice!.address, item.path, currentPath, fileName);
        } else {
          ExplorerService.remoteCopyOnDevice(remoteDevice!.address, item.path, currentPath, fileName, item.size);
        }
        queued++;
      } else {
        set({ notification: "Copying between two different remote devices is not supported" });
        return;
      }
    }

    if (skippedSameDir > 0 && queued === 0) {
      if (isCut) ClipboardService.clear();
      set({ notification: skippedSameDir === 1 ? "The item is already in this location" : `${skippedSameDir} items are already in this location` });
      return;
    }

    if (queued > 0) {
      const action = isCut ? "Moving" : (sourceIsRemote && !destIsRemote ? "Downloading" : (!sourceIsRemote && destIsRemote ? "Uploading" : (sourceIsRemote && destIsRemote ? "Copying on device" : "Copying")));
      set({ notification: `${action} ${queued} item(s)...` });
      if (isCut) ClipboardService.clear();
    }
  },

  pasteConflict: null,
  resolvePasteConflict: (resolution: "replace" | "keep_both" | "cancel") => {
    const conflict = get().pasteConflict;
    if (!conflict) return;

    if (resolution === "cancel") {
      set({ pasteConflict: null });
      return;
    }

    if (resolution === "replace") {
      get().pasteEntries(true);
      return;
    }

    if (resolution === "keep_both") {
      const name = conflict.fileName;
      const dotIdx = name.lastIndexOf(".");
      let base: string;
      let ext: string;
      if (dotIdx > 0) {
        base = name.substring(0, dotIdx);
        ext = name.substring(dotIdx);
      } else {
        base = name;
        ext = "";
      }
      let counter = 2;
      const existingNames = new Set(get().entries.map((e) => e.name));
      let candidate = `${base} (${counter})${ext}`;
      while (existingNames.has(candidate)) {
        counter++;
        candidate = `${base} (${counter})${ext}`;
      }
      get().pasteEntries(false, candidate);
      return;
    }
  },

  showHiddenItems: initialShowHiddenItems,
  toggleShowHiddenItems: () => {
    const next = !get().showHiddenItems;
    localStorage.setItem(HIDDEN_ITEMS_KEY, String(next));
    set({ showHiddenItems: next });
  },
  showFileExtensions: initialShowFileExtensions,
  toggleShowFileExtensions: () => {
    const next = !get().showFileExtensions;
    localStorage.setItem(FILE_EXT_KEY, String(next));
    set({ showFileExtensions: next });
  },

  setEntryHidden: async (entries, hidden) => {
    for (const entry of entries) {
      try {
        await setHidden(entry.full_path, hidden);
      } catch { /* skip failures */ }
    }
    get().refresh();
  },
  setEntryReadonly: async (entries, readonly) => {
    for (const entry of entries) {
      try {
        await setReadonly(entry.full_path, readonly);
      } catch { /* skip failures */ }
    }
    get().refresh();
  },
  selectedAttributes: null,
  loadSelectedAttributes: () => {
    const { selectedEntries } = get();
    if (selectedEntries.length !== 1) {
      set({ selectedAttributes: null });
      return;
    }
    getAttributes(selectedEntries[0].full_path)
      .then((attrs) => set({ selectedAttributes: attrs }))
      .catch(() => set({ selectedAttributes: null }));
  },

  notification: null,
  clearNotification: () => set({ notification: null }),

  spaceError: null,
  dismissSpaceError: () => set({ spaceError: null }),
  retrySpaceError: () => {
    const err = get().spaceError;
    if (!err) return;
    const job = TransferService.addJob(err.transferType as "copy" | "move", err.name, err.source, err.destination, 0);
    TransferService.setStatus(job.id, "running");
    startTransfer(job.id, err.source, err.destination, err.transferType).catch(() =>
      TransferService.setStatus(job.id, "failed", "Failed to start transfer"),
    );
    set({ spaceError: null });
  },

  remoteDevice: null,
  browseRemoteDevice: (address: string, name: string) => {
    set({ remoteDevice: { address, name }, historyStack: [], forwardStack: [], currentPath: null, entries: [], loading: true, error: null, selectedEntries: [] });
    ExplorerService.listRemoteRoots(address)
      .then((roots) => {
        if (roots.length === 1) {
          loadDirectory(roots[0].letter + ":\\", set);
        } else {
          set({ loading: false });
        }
      })
      .catch((err) => set({ loading: false, error: err instanceof Error ? err.message : String(err) }));
  },
  exitRemoteBrowse: () => {
    set({ remoteDevice: null, currentPath: null, entries: [], historyStack: [], forwardStack: [], selectedEntries: [], error: null });
  },

  previewImages: [],
  previewIndex: -1,
  openImagePreview: (entry: DirectoryEntry) => {
    const { entries, searchResults } = get();
    const list = searchResults ?? entries;
    const images = list.filter(isImageFile);
    const index = images.findIndex((e) => e.full_path === entry.full_path);
    if (index >= 0) {
      set({ previewImages: images, previewIndex: index });
    }
  },
  closeImagePreview: () => {
    set({ previewImages: [], previewIndex: -1 });
  },
  previewNext: () => {
    const { previewIndex, previewImages } = get();
    if (previewIndex < previewImages.length - 1) {
      set({ previewIndex: previewIndex + 1 });
    }
  },
  previewPrev: () => {
    const { previewIndex } = get();
    if (previewIndex > 0) {
      set({ previewIndex: previewIndex - 1 });
    }
  },
}));

onBridgeEvent("search:progress", (payload) => {
  const state = useExplorerStore.getState();
  if (state.searchLoading) {
    useExplorerStore.setState({ searchProgress: payload });
  }
});

ClipboardService.subscribe(() => {
  useExplorerStore.setState({
    clipboardCount: ClipboardService.getItems().length,
    clipboardOperation: ClipboardService.getOperation(),
  });
});

onBridgeEvent("transfer:progress", (payload) => {
  if (payload.status === "failed" && payload.error) {
    const job = TransferService.getJob(payload.transferId);
    if (payload.error.includes("Not enough disk space") && job) {
      useExplorerStore.setState({
        spaceError: {
          transferId: payload.transferId,
          error: payload.error,
          destination: job.destination,
          source: job.source,
          transferType: job.type,
          name: job.name,
        },
      });
    } else if (payload.error.includes("already exists in the destination") && job) {
      TransferService.removeJob(payload.transferId);
      useExplorerStore.setState({
        pasteConflict: {
          sourcePath: job.source,
          destDir: job.destination,
          fileName: job.name,
          isCut: job.type === "move",
          providerId: "local",
          remainingItems: [],
        },
      });
    } else {
      useExplorerStore.setState({ notification: payload.error });
    }
    return;
  }
  if (payload.status !== "completed" && payload.status !== "cancelled") return;
  const { currentPath } = useExplorerStore.getState();
  if (!currentPath) return;
  const job = TransferService.getJob(payload.transferId);
  if (job && job.destination === currentPath) {
    useExplorerStore.getState().refresh();
  }
});

if ((window as any).__storageos_keydown) {
  document.removeEventListener("keydown", (window as any).__storageos_keydown);
}
(window as any).__storageos_keydown = function _explorerKeydown(e: KeyboardEvent) {
  const state = useExplorerStore.getState();
  const el = e.target;
  const isTextInput = el instanceof HTMLInputElement && el.type !== "checkbox" && el.type !== "radio" || el instanceof HTMLTextAreaElement;

  if (e.key === "Delete") {
    if (isTextInput && (el as HTMLInputElement).value.length > 0) return;
    if (state.selectedEntries.length > 0 && state.deleteTargets.length === 0) {
      e.preventDefault();
      if (isTextInput) (el as HTMLElement).blur();
      state.confirmDelete(state.selectedEntries);
    }
    return;
  }

  if (!e.ctrlKey && !e.metaKey) return;

  if (e.key === "h") {
    if (isTextInput) return;
    e.preventDefault();
    state.toggleShowHiddenItems();
    return;
  }

  if (e.key === "a") {
    if (isTextInput) return;
    e.preventDefault();
    state.selectEntry(null);
    const list = state.searchResults ?? state.entries;
    if (list.length > 0) {
      useExplorerStore.setState({ selectedEntries: [...list] });
    }
    return;
  }

  if (e.key === "c" || e.key === "x") {
    if (isTextInput) {
      const inp = el as HTMLInputElement;
      if (inp.selectionStart !== inp.selectionEnd) return;
    }
    if (state.selectedEntries.length > 0) {
      e.preventDefault();
      if (e.key === "c") state.copyEntries(state.selectedEntries);
      else state.cutEntries(state.selectedEntries);
    }
    return;
  }

  if (e.key === "v") {
    if (isTextInput) return;
    if (state.currentPath && ClipboardService.hasItems()) {
      e.preventDefault();
      state.pasteEntries();
    }
  }
};
document.addEventListener("keydown", (window as any).__storageos_keydown);

export { getParentPath, isImageFile };
