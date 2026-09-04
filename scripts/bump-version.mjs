#!/usr/bin/env node
/**
 * Bump the StorageOS version everywhere it is recorded, in one shot.
 *
 *   node scripts/bump-version.mjs [patch|minor|major]   (default: patch)
 *
 * Canonical version = apps/desktop/src-tauri/Cargo.toml. Android versionCode
 * is incremented by 1 each bump (Google requires a strictly increasing int).
 * Keep this in sync with .githooks/pre-push, which BLOCKS any push that does
 * not include a version bump here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => join(root, rel);

const F = {
  desktopCargo: p("apps/desktop/src-tauri/Cargo.toml"),
  tauriConf: p("apps/desktop/src-tauri/tauri.conf.json"),
  desktopPkg: p("apps/desktop/package.json"),
  androidGradle: p("apps/mobile/android/app/build.gradle.kts"),
  agentCargo: p("services/storageos-agent/Cargo.toml"),
  relayManifest: p("services/storageos-relay/version.json"),
};

const kind = process.argv[2] || "patch";

// Canonical version
const cargo = readFileSync(F.desktopCargo, "utf8");
const m = cargo.match(/^version\s*=\s*"(\d+)\.(\d+)\.(\d+)"/m);
if (!m) {
  console.error("bump-version: could not read version from apps/desktop/src-tauri/Cargo.toml");
  process.exit(1);
}
let [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
if (kind === "major") { maj++; min = 0; pat = 0; }
else if (kind === "minor") { min++; pat = 0; }
else { pat++; }
const next = `${maj}.${min}.${pat}`;

// Android versionCode = current + 1
const gradle = readFileSync(F.androidGradle, "utf8");
const vc = gradle.match(/versionCode\s*=\s*(\d+)/);
const nextCode = (vc ? Number(vc[1]) : 0) + 1;

// --- write every file ---
writeFileSync(F.desktopCargo, cargo.replace(/^version\s*=\s*"\d+\.\d+\.\d+"/m, `version = "${next}"`));

writeFileSync(
  F.tauriConf,
  readFileSync(F.tauriConf, "utf8").replace(/("version"\s*:\s*)"\d+\.\d+\.\d+"/, `$1"${next}"`),
);

writeFileSync(
  F.desktopPkg,
  readFileSync(F.desktopPkg, "utf8").replace(/("version"\s*:\s*)"\d+\.\d+\.\d+"/, `$1"${next}"`),
);

writeFileSync(
  F.androidGradle,
  gradle
    .replace(/versionCode\s*=\s*\d+/, `versionCode = ${nextCode}`)
    .replace(/versionName\s*=\s*"\d+\.\d+\.\d+"/, `versionName = "${next}"`),
);

writeFileSync(
  F.agentCargo,
  readFileSync(F.agentCargo, "utf8").replace(/^version\s*=\s*"\d+\.\d+\.\d+"/m, `version = "${next}"`),
);

const manifest = JSON.parse(readFileSync(F.relayManifest, "utf8"));
if (manifest.windows) manifest.windows.version = next;
if (manifest.android) { manifest.android.version = next; manifest.android.versionCode = nextCode; }
writeFileSync(F.relayManifest, JSON.stringify(manifest, null, 2) + "\n");

console.log(`bump-version: -> ${next} (Android versionCode ${nextCode}) across ${Object.keys(F).length} files.`);
console.log("Now: rebuild the apps, commit the bump, and push.");
