# Known Issues

> Tracked issues that are understood but not yet fixed. Each entry includes root cause and planned resolution.

---

## LS-008B — Recursive search is slow on very large directories

**Issue:** Recursive search can take several seconds on directories with tens of thousands of files (e.g. `node_modules`, `C:\Windows`).

**Reason:** Filesystem traversal is performed live on every search — no pre-built index exists.

**Future Fix:** Background indexing service using SQLite. The index would be built incrementally via filesystem watchers and queried instantly.

**Priority:** Medium

**Status:** Deferred until indexing engine (post-MVP).

---

## LS-007A — Delete is permanent (no Recycle Bin)

**Issue:** `delete_item` uses `std::fs::remove_file` / `std::fs::remove_dir_all`, which permanently deletes without sending to Recycle Bin.

**Reason:** Safe deletion on Windows requires the `IFileOperation` COM API, which adds significant complexity.

**Future Fix:** Replace with `IFileOperation` API call that moves items to Recycle Bin instead of permanent deletion.

**Priority:** High

**Status:** Deferred. UI shows permanent deletion warning as interim mitigation.

---

## LS-005 — Drive detection is Windows-only

**Issue:** `list_drives` returns an empty Vec on macOS and Linux.

**Reason:** MVP targets Windows only. macOS uses mount points (`/Volumes/`), Linux uses `/dev/` and `/mnt/`.

**Future Fix:** Platform-specific implementations behind a trait or cfg blocks.

**Priority:** Low (MVP is Windows-only)

**Status:** Deferred until cross-platform support.
