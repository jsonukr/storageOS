/**
 * Update check.
 *
 * Fetches the version manifest served by the relay (`GET /version`), compares
 * the latest Windows version to the running app version, and reports whether a
 * newer build is available. It does NOT download or install anything — the UI
 * simply points the user to the download website.
 */

import { version } from "@/lib/tauri";

const MANIFEST_URL = "https://storageos.onrender.com/version";

interface UpdateManifest {
  windows?: { version?: string; notes?: string };
  android?: { version?: string; versionCode?: number; notes?: string };
  downloadUrl?: string;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  notes?: string;
  downloadUrl: string;
}

/** Returns true if `latest` is a strictly newer semver-ish version than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/**
 * Check for a newer desktop build. Returns null on any failure (offline,
 * relay asleep, malformed manifest) so the caller can silently ignore it.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const current = (await version()).app_version;

    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return null;

    const manifest = (await res.json()) as UpdateManifest;
    const latest = manifest.windows?.version;
    if (!latest) return null;

    return {
      available: isNewerVersion(latest, current),
      currentVersion: current,
      latestVersion: latest,
      notes: manifest.windows?.notes,
      downloadUrl: manifest.downloadUrl ?? "",
    };
  } catch {
    return null;
  }
}
