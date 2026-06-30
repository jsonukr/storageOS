import { create } from "zustand";

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
}

export const useExplorerStore = create<ExplorerState>((set) => ({
  viewMode: "details",
  setViewMode: (mode) => set({ viewMode: mode }),
  navPanelWidth: 240,
  setNavPanelWidth: (width) => set({ navPanelWidth: width }),
  propertiesOpen: false,
  toggleProperties: () => set((s) => ({ propertiesOpen: !s.propertiesOpen })),
  propertiesWidth: 280,
  setPropertiesWidth: (width) => set({ propertiesWidth: width }),
}));
