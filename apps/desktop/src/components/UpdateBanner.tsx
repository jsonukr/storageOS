import { useState } from "react";
import { useUpdateCheck } from "../hooks/useUpdateCheck";
import { openUrl } from "@/lib/tauri";

const DISMISS_KEY = "storageos:update-dismissed-version";

/**
 * Full-width banner shown when a newer desktop build is available. It only
 * links to the download website — it does not download or install anything.
 * Dismissal is remembered per-version so a given update is only nagged once,
 * but a brand-new version will surface again.
 */
export function UpdateBanner() {
  const info = useUpdateCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!info?.available) return null;
  if (dismissed) return null;
  if (localStorage.getItem(DISMISS_KEY) === info.latestVersion) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, info.latestVersion);
    setDismissed(true);
  };

  const download = () => {
    if (info.downloadUrl) openUrl(info.downloadUrl).catch(() => {});
  };

  return (
    <div className="flex items-center gap-3 border-b border-border bg-[var(--color-info-bg)] px-4 py-2 text-[12px] shrink-0">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
        <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
      </svg>
      <span className="flex-1 text-text-primary" style={{ overflowWrap: "anywhere" }}>
        StorageOS <strong>{info.latestVersion}</strong> is available (you have {info.currentVersion}). Please download the latest version from the website and install it.
      </span>
      <button
        onClick={download}
        className="shrink-0 rounded-[4px] bg-accent px-3 py-1 text-[11px] font-semibold text-white hover:bg-accent-hover transition-all duration-[167ms]"
      >
        Download
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-[4px] p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-all duration-[167ms]"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
