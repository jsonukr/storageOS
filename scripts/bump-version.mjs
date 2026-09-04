#!/usr/bin/env node
/**
 * StorageOS version manager — one source of truth: /version.env
 *
 *   node scripts/bump-version.mjs [patch|minor|major]   bump version.env, then propagate
 *   node scripts/bump-version.mjs sync                   propagate current version.env as-is
 *
 * `version.env` (VERSION + VERSION_CODE) is the ONLY hand-authored version.
 * Every native config file below is generated from it — never edit the version
 * in those directly. On a bump, VERSION_CODE is incremented by 1 (Android
 * requires a strictly-increasing integer). Keep this in sync with
 * .githooks/pre-push, which BLOCKS any code push that doesn't bump version.env.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => join(root, rel);
const ENV = p("version.env");

// ── Read the source of truth ─────────────────────────────────────────────
const env = readFileSync(ENV, "utf8");
const vMatch = env.match(/^VERSION\s*=\s*(\d+)\.(\d+)\.(\d+)\s*$/m);
const cMatch = env.match(/^VERSION_CODE\s*=\s*(\d+)\s*$/m);
if (!vMatch || !cMatch) {
  console.error("bump-version: version.env must define VERSION=x.y.z and VERSION_CODE=<int>");
  process.exit(1);
}
let [maj, min, pat] = [Number(vMatch[1]), Number(vMatch[2]), Number(vMatch[3])];
let code = Number(cMatch[1]);

// ── Apply the requested bump (default: patch; `sync` = no bump) ───────────
const kind = process.argv[2] || "patch";
if (kind === "sync") {
  // propagate current values unchanged
} else if (kind === "major") { maj++; min = 0; pat = 0; code++; }
else if (kind === "minor") { min++; pat = 0; code++; }
else if (kind === "patch") { pat++; code++; }
else {
  console.error(`bump-version: unknown argument "${kind}" (use patch|minor|major|sync)`);
  process.exit(1);
}
const version = `${maj}.${min}.${pat}`;

// Write version.env back (source of truth first, so propagation always matches).
writeFileSync(
  ENV,
  env.replace(/^VERSION\s*=.*$/m, `VERSION=${version}`).replace(/^VERSION_CODE\s*=.*$/m, `VERSION_CODE=${code}`),
);

// ── Propagate into every native config file ──────────────────────────────
const edit = (rel, fn) => {
  const abs = p(rel);
  const before = readFileSync(abs, "utf8");
  const after = fn(before);
  writeFileSync(abs, after);
};

// Rust crates (desktop + agent): [package] version
edit("apps/desktop/src-tauri/Cargo.toml", (s) =>
  s.replace(/^version\s*=\s*"\d+\.\d+\.\d+"/m, `version = "${version}"`));
edit("services/storageos-agent/Cargo.toml", (s) =>
  s.replace(/^version\s*=\s*"\d+\.\d+\.\d+"/m, `version = "${version}"`));

// Tauri config + desktop package.json
edit("apps/desktop/src-tauri/tauri.conf.json", (s) =>
  s.replace(/("version"\s*:\s*)"\d+\.\d+\.\d+"/, `$1"${version}"`));
edit("apps/desktop/package.json", (s) =>
  s.replace(/("version"\s*:\s*)"\d+\.\d+\.\d+"/, `$1"${version}"`));

// Android: versionName (string) + versionCode (int)
edit("apps/mobile/android/app/build.gradle.kts", (s) =>
  s.replace(/versionCode\s*=\s*\d+/, `versionCode = ${code}`)
   .replace(/versionName\s*=\s*"\d+\.\d+\.\d+"/, `versionName = "${version}"`));

// Relay update manifest served at /version
edit("services/storageos-relay/version.json", (s) => {
  const m = JSON.parse(s);
  if (m.windows) m.windows.version = version;
  if (m.android) { m.android.version = version; m.android.versionCode = code; }
  return JSON.stringify(m, null, 2) + "\n";
});

// Download site: static fallback (page also fetches the latest GitHub release live)
edit("site/index.html", (s) =>
  s.replace(/(<span id="ver-badge">)[^<]*(<\/span>)/, `$1${version}$2`)
   .replace(/(<span id="ver-footer">)v?[^<]*(<\/span>)/, `$1v${version}$2`));

console.log(`bump-version: ${kind} -> ${version} (Android versionCode ${code})`);
console.log("Propagated to: version.env, desktop+agent Cargo.toml, tauri.conf.json,");
console.log("package.json, build.gradle.kts, relay version.json, site/index.html.");
if (kind !== "sync") console.log("Now: rebuild the apps, commit the bump, and push.");
