import type { ClipboardItem, ClipboardOperation } from "./types";

type ClipboardChangeListener = () => void;

let items: readonly ClipboardItem[] = [];
let operation: ClipboardOperation = "copy";
let listeners: ClipboardChangeListener[] = [];

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export const ClipboardService = {
  copy(entries: ClipboardItem[]): void {
    items = [...entries];
    operation = "copy";
    notify();
  },

  cut(entries: ClipboardItem[]): void {
    items = [...entries];
    operation = "cut";
    notify();
  },

  clear(): void {
    if (items.length === 0) return;
    items = [];
    operation = "copy";
    notify();
  },

  getItems(): readonly ClipboardItem[] {
    return items;
  },

  hasItems(): boolean {
    return items.length > 0;
  },

  isCutOperation(): boolean {
    return operation === "cut";
  },

  getOperation(): ClipboardOperation {
    return operation;
  },

  subscribe(listener: ClipboardChangeListener): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};
