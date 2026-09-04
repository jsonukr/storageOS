import { useState } from "react";
import { useUpdateCheck } from "../hooks/useUpdateCheck";
import { openUrl, installUpdate } from "@/lib/tauri";

const DISMISS_KEY = "storageos:update-dismissed-version";

/**
 * Full-width banner shown when a newer desktop build is available. "Install"
 * downloads the installer and runs it (the app then quits so the installer can
 * update in place and relaunch). Falls back to opening the website if there is
 * no direct installer URL or the download fails. Dismissal is remembered
 * per-version, so a given update is only offered once but a new version resurfaces.
 */
export function UpdateBanner() {
  const info = useUpdateCheck();
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!info?.available) return null;
  if (dismissed) return null;
  if (localStorage.getItem(DISMISS_KEY) === info.latestVersion) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, info.latestVersion);
    setDismissed(true);
  };

  const openSite = () => {
    if (info.downloadUrl) openUrl(info.downloadUrl).catch(() => {});
  };

  const install = async () => {
    if (!info.installUrl) {
      openSite();
      return;
    }
    setInstalling(true);
    setFailed(false);
    try {
      // On success the app exits and the installer takes over — nothing after runs.
      await installUpdate(info.installUrl);
    } catch {
      setInstalling(false);
      setFailed(true);
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-border bg-[var(--color-info-bg)] px-4 py-2 text-[12px] shrink-0">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
        <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
      </svg>

      <span className="flex-1 text-text-primary" style={{ overflowWrap: "anywhere" }}>
        {failed ? (
          <>Couldn't install the update automatically. <button onClick={openSite} className="text-accent underline">Download it from the website</button>.</>
        ) : installing ? (
          <>Downloading StorageOS <strong>{info.latestVersion}</strong>… the app will restart to finish installing.</>
        ) : (
          <>StorageOS <strong>{info.latestVersion}</strong> is available (you have {info.currentVersion}). Install it now?</>
        )}
      </span>

      {installing ? (
        <span className="shrink-0 flex items-center gap-2 text-[11px] text-text-secondary">
          <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Installing…
        </span>
      ) : failed ? (
        <button
          onClick={dismiss}
          className="shrink-0 rounded-[4px] px-3 py-1 text-[11px] font-semibold text-text-secondary hover:bg-surface-hover transition-all duration-[167ms]"
        >
          Dismiss
        </button>
      ) : (
        <>
          <button
            onClick={install}
            className="shrink-0 rounded-[4px] bg-accent px-3 py-1 text-[11px] font-semibold text-white hover:bg-accent-hover transition-all duration-[167ms]"
          >
            Install
          </button>
          <button
            onClick={dismiss}
            aria-label="Later"
            className="shrink-0 rounded-[4px] p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-all duration-[167ms]"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
