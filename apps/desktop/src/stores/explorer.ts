import { create } from "zustand";
import type { DirectoryEntry } from "@/lib/tauri";
import { ExplorerService } from "@/services/ExplorerService";

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
}

function loadDirectory(path: string, set: (partial: Partial<ExplorerState>) => void) {
  set({ currentPath: path, loading: true, error: null, entries: [], selectedEntry: null });
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
}));

export { getParentPath };
