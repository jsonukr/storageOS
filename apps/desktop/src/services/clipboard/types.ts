export interface ClipboardItem {
  readonly providerId: string;
  readonly path: string;
  readonly type: "file" | "directory";
  readonly size: number;
  readonly name: string;
}

export type ClipboardOperation = "copy" | "cut";
