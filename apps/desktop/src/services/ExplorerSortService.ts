import type { DirectoryEntry } from "@/lib/tauri";

export type SortField = "name" | "date_modified" | "date_created" | "size" | "type";
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
  foldersFirst: boolean;
}

const STORAGE_KEY = "storageos:sort";

const DEFAULT_CONFIG: SortConfig = {
  field: "name",
  direction: "asc",
  foldersFirst: true,
};

export const ExplorerSortService = {
  loadConfig(): SortConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      return {
        field: parsed.field ?? DEFAULT_CONFIG.field,
        direction: parsed.direction ?? DEFAULT_CONFIG.direction,
        foldersFirst: parsed.foldersFirst ?? DEFAULT_CONFIG.foldersFirst,
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  },

  saveConfig(config: SortConfig): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  },

  sort(entries: DirectoryEntry[], config: SortConfig): DirectoryEntry[] {
    const sorted = [...entries];
    sorted.sort((a, b) => {
      if (config.foldersFirst) {
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
      }

      const cmp = compareByField(a, b, config.field);
      return config.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  },
};

function numCmp(x: number, y: number): number {
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

function compareByField(a: DirectoryEntry, b: DirectoryEntry, field: SortField): number {
  switch (field) {
    case "name":
      return naturalCompare(a.name, b.name);
    case "date_modified":
      return numCmp(a.last_modified, b.last_modified);
    case "date_created":
      return numCmp(a.date_created, b.date_created);
    case "size":
      return numCmp(a.size, b.size);
    case "type": {
      const extA = a.is_directory ? "" : a.extension.toLowerCase();
      const extB = b.is_directory ? "" : b.extension.toLowerCase();
      const cmp = extA.localeCompare(extB);
      if (cmp !== 0) return cmp;
      return naturalCompare(a.name, b.name);
    }
    default:
      return 0;
  }
}

function naturalCompare(a: string, b: string): number {
  const ax = tokenize(a.toLowerCase());
  const bx = tokenize(b.toLowerCase());
  const len = Math.min(ax.length, bx.length);

  for (let i = 0; i < len; i++) {
    const ta = ax[i];
    const tb = bx[i];
    if (ta.num !== null && tb.num !== null) {
      if (ta.num !== tb.num) return ta.num - tb.num;
    } else if (ta.num !== null) {
      return -1;
    } else if (tb.num !== null) {
      return 1;
    } else {
      const cmp = ta.str.localeCompare(tb.str);
      if (cmp !== 0) return cmp;
    }
  }
  return ax.length - bx.length;
}

interface Token {
  str: string;
  num: number | null;
}

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\d+)|(\D+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[1] !== undefined) {
      tokens.push({ str: m[1], num: parseInt(m[1], 10) });
    } else {
      tokens.push({ str: m[2], num: null });
    }
  }
  return tokens;
}
