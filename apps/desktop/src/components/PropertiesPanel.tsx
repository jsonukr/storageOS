import { useEffect } from "react";
import { useExplorerStore } from "../stores/explorer";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatDate(timestamp: number): string {
  if (timestamp === 0) return "—";
  const d = new Date(timestamp * 1000);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day}/${year} ${hours}:${mins}`;
}

function AttributeChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
        active
          ? "bg-accent/15 text-accent"
          : "bg-surface-tertiary text-text-tertiary"
      }`}
    >
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1">
      <span className="text-[11px] text-text-tertiary shrink-0">{label}</span>
      <span className="text-[11px] text-text-primary text-right break-all">{value}</span>
    </div>
  );
}

export function PropertiesPanel() {
  const selectedEntries = useExplorerStore((s) => s.selectedEntries);
  const selectedAttributes = useExplorerStore((s) => s.selectedAttributes);
  const loadSelectedAttributes = useExplorerStore((s) => s.loadSelectedAttributes);

  useEffect(() => {
    loadSelectedAttributes();
  }, [selectedEntries, loadSelectedAttributes]);

  const entry = selectedEntries.length === 1 ? selectedEntries[0] : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto select-none">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border">
        <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
          Properties
        </h3>
      </div>

      {!entry ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary mx-auto mb-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-text-tertiary">
                <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
                <path d="M9 6v4M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[12px] text-text-tertiary">
              {selectedEntries.length > 1
                ? `${selectedEntries.length} items selected`
                : "No item selected"}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {/* File icon + name */}
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
              {entry.is_directory ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-warning">
                  <path d="M2 5.5C2 4.67 2.67 4 3.5 4H7l1 1h5.5c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-10C2.67 15 2 14.33 2 13.5V5.5z" fill="currentColor" opacity="0.55" stroke="currentColor" strokeWidth="0.8" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-text-tertiary">
                  <path d="M5 2h6.5l4 4v9a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 15V3.5A1.5 1.5 0 015 2z" stroke="currentColor" strokeWidth="0.8" />
                  <path d="M11.5 2v4h4" stroke="currentColor" strokeWidth="0.8" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-text-primary truncate">{entry.name}</p>
              <p className="text-[10px] text-text-tertiary">{entry.is_directory ? "Folder" : (entry.extension ? `.${entry.extension.toUpperCase()} File` : "File")}</p>
            </div>
          </div>

          {/* General info */}
          <div>
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">General</p>
            {!entry.is_directory && (
              <Row label="Size" value={formatSize(entry.size)} />
            )}
            <Row label="Modified" value={formatDate(entry.last_modified)} />
            <Row label="Created" value={formatDate(entry.date_created)} />
          </div>

          {/* Attributes */}
          {selectedAttributes && (
            <div>
              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">Attributes</p>
              <div className="flex flex-wrap gap-1">
                <AttributeChip label="Hidden" active={selectedAttributes.hidden} />
                <AttributeChip label="Read Only" active={selectedAttributes.readonly} />
                <AttributeChip label="System" active={selectedAttributes.system} />
                <AttributeChip label="Archive" active={selectedAttributes.archive} />
              </div>
            </div>
          )}

          {/* Path */}
          <div>
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Location</p>
            <p className="text-[11px] text-text-secondary break-all">{entry.full_path}</p>
          </div>
        </div>
      )}
    </div>
  );
}
