import { create } from "zustand";
import type { DirectoryEntry, SearchProgressPayload } from "@/lib/tauri";
import { onBridgeEvent } from "@/lib/tauri";
import { ExplorerService } from "@/services/ExplorerService";
import { ClipboardService } from "@/services/clipboard";
import { TransferService } from "@/services/transfer";

type ViewMode = "grid" | "list" | "details";

interface ExplorerState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
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
  selectedEntry: DirectoryEntry | null;
  historyStack: string[];
  forwardStack: string[];

  navigateTo: (path: string) => void;
  openEntry: (entry: DirectoryEntry) => void;
  selectEntry: (entry: DirectoryEntry | null) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  refresh: () => void;

  operationLoading: boolean;
  operationError: string | null;
  clearOperationError: () => void;
  createFolder: (name: string) => Promise<boolean>;
  renameEntry: (entry: DirectoryEntry, newName: string) => Promise<boolean>;
  deleteEntry: (entry: DirectoryEntry) => Promise<boolean>;

  contextMenu: { x: number; y: number; entry: DirectoryEntry | null } | null;
  showContextMenu: (x: number, y: number, entry: DirectoryEntry | null) => void;
  hideContextMenu: () => void;

  newFolderDialogOpen: boolean;
  openNewFolderDialog: () => void;
  closeNewFolderDialog: () => void;

  renameTarget: DirectoryEntry | null;
  startRename: (entry: DirectoryEntry) => void;
  cancelRename: () => void;

  deleteTarget: DirectoryEntry | null;
  confirmDelete: (entry: DirectoryEntry) => void;
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
    remainingItems: Array<{ path: string }>;
  } | null;
  resolvePasteConflict: (resolution: "replace" | "keep_both" | "cancel") => void;

  notification: string | null;
  clearNotification: () => void;
}

let searchGeneration = 0;
let searchStartTime = 0;

function loadDirectory(path: string, set: (partial: Partial<ExplorerState>) => void) {
  searchGeneration++;
  set({ currentPath: path, loading: true, error: null, entries: [], selectedEntry: null, searchQuery: "", searchResults: null, searchLoading: false, searchError: null, searchProgress: null, searchDurationMs: null });
  ExplorerService.listDirectory(path)
    .then((entries) => set({ entries, loading: false }))
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
  viewMode: "details",
  setViewMode: (mode) => set({ viewMode: mode }),
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
  selectedEntry: null,
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
    if (!entry.is_directory) return;
    const { currentPath } = get();
    const history = currentPath !== null
      ? [...get().historyStack, currentPath]
      : get().historyStack;
    set({ historyStack: history, forwardStack: [] });
    loadDirectory(entry.full_path, set);
  },

  selectEntry: (entry: DirectoryEntry | null) => {
    set({ selectedEntry: entry });
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
    const { currentPath } = get();
    if (currentPath === null) return false;
    set({ operationLoading: true, operationError: null });
    try {
      await ExplorerService.createFolder(currentPath, name);
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
    set({ operationLoading: true, operationError: null });
    try {
      await ExplorerService.rename(entry.full_path, newName);
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

  deleteEntry: async (entry: DirectoryEntry): Promise<boolean> => {
    set({ operationLoading: true, operationError: null });
    try {
      await ExplorerService.delete(entry.full_path);
      set({ operationLoading: false, deleteTarget: null, selectedEntry: null });
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

  contextMenu: null,
  showContextMenu: (x, y, entry) => set({ contextMenu: { x, y, entry } }),
  hideContextMenu: () => set({ contextMenu: null }),

  newFolderDialogOpen: false,
  openNewFolderDialog: () => set({ newFolderDialogOpen: true, operationError: null }),
  closeNewFolderDialog: () => set({ newFolderDialogOpen: false, operationError: null }),

  renameTarget: null,
  startRename: (entry) => set({ renameTarget: entry, operationError: null, contextMenu: null }),
  cancelRename: () => set({ renameTarget: null, operationError: null }),

  deleteTarget: null,
  confirmDelete: (entry) => set({ deleteTarget: entry, operationError: null, contextMenu: null }),
  cancelDelete: () => set({ deleteTarget: null, operationError: null }),

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
        set({ searchResults: results, searchLoading: false, selectedEntry: null, searchDurationMs: duration, searchProgress: null });
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
    ClipboardService.copy(
      entries.map((e) => ({
        providerId: "local",
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
    ClipboardService.cut(
      entries.map((e) => ({
        providerId: "local",
        path: e.full_path,
        type: e.is_directory ? "directory" as const : "file" as const,
        size: e.size,
        name: e.name,
      })),
    );
    const names = entries.map((e) => e.name).join(", ");
    set({ notification: `Cut: ${names}` });
  },

  pasteEntries: async (overwrite?: boolean, newName?: string) => {
    const { currentPath, pasteConflict } = get();
    if (!currentPath) return;

    let items: Array<{ path: string }>;
    let isCut: boolean;

    if (pasteConflict && (overwrite || newName)) {
      items = [{ path: pasteConflict.sourcePath }, ...pasteConflict.remainingItems];
      isCut = pasteConflict.isCut;
      set({ pasteConflict: null });
    } else {
      if (!ClipboardService.hasItems()) return;
      items = ClipboardService.getItems();
      isCut = ClipboardService.isCutOperation();
    }

    set({ operationLoading: true, operationError: null });
    let successCount = 0;
    let firstItemOverwrite = overwrite;
    let firstItemNewName = newName;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const ow = i === 0 ? firstItemOverwrite : undefined;
      const nn = i === 0 ? firstItemNewName : undefined;
      try {
        if (isCut) {
          await ExplorerService.moveTo(item.path, currentPath, ow, nn);
        } else {
          await ExplorerService.copyTo(item.path, currentPath, ow, nn);
        }
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists in the destination")) {
          const fileName = msg.match(/"([^"]+)" already exists/)?.[1] ?? item.path.split(/[\\/]/).pop() ?? "file";
          set({
            operationLoading: false,
            pasteConflict: {
              sourcePath: item.path,
              destDir: currentPath,
              fileName,
              isCut,
              remainingItems: items.slice(i + 1),
            },
          });
          if (successCount > 0) loadDirectory(currentPath, set);
          return;
        }
        set({
          operationLoading: false,
          operationError: msg,
          notification: `Failed: ${msg}`,
        });
        break;
      }
    }
    if (successCount > 0) {
      set({ notification: `${isCut ? "Moved" : "Pasted"} ${successCount} item(s)` });
      if (isCut) { ClipboardService.clear(); }
      loadDirectory(currentPath, set);
    }
    set({ operationLoading: false });
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

  notification: null,
  clearNotification: () => set({ notification: null }),
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

export { getParentPath };
