# StorageOS Post-MVP Backlog

> Parking lot for ideas beyond MVP scope. Items here are not scheduled — they represent future directions.

## Search

- [ ] Background indexing service (filesystem watcher + SQLite index)
- [ ] SQLite search index (instant lookup, no live traversal)
- [ ] Instant global search (cross-drive, cross-provider)
- [ ] File content search (full-text search inside files)
- [ ] Regex search (pattern matching in filenames and content)
- [ ] Search filters (by date, size, type, extension, provider)
- [ ] Saved searches (persist and re-run named queries)

## Explorer

- [ ] File previews (image thumbnails, text preview, PDF first page)
- [ ] Tabs (multiple directories open simultaneously)
- [ ] Dual pane mode (side-by-side directory browsing)
- [ ] Folder color tags (user-assigned visual labels)
- [ ] Drag and drop (move/copy between panels, upload from OS)
- [ ] Keyboard shortcuts (Ctrl+C/V/X, F2 rename, Delete, Ctrl+A select all)
- [ ] Bulk operations (multi-select, batch rename, batch delete)
- [ ] Recycle Bin integration (Windows IFileOperation API)

## Performance

- [ ] Virtualized file list (react-window or similar for 10k+ entries)
- [ ] Thumbnail cache (persistent thumbnail store for previews)
- [ ] Metadata cache (avoid re-reading unchanged directories)
- [ ] Parallel directory scanning (concurrent reads for multi-drive views)

## Cloud

- [ ] Google Drive connector
- [ ] OneDrive / SharePoint connector
- [ ] Dropbox connector
- [ ] Offline cache (local copies of cloud files)
- [ ] Conflict resolution (divergent edits on cloud files)
- [ ] Sync engine (background bidirectional sync)
- [ ] Unified search across local + cloud

## Platform

- [ ] macOS support
- [ ] Linux support
- [ ] Auto-updater (Tauri updater plugin)
- [ ] System tray integration
- [ ] Shell extension (right-click "Open in StorageOS")
