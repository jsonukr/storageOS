# Desktop Components

## Layout

The desktop app uses a fixed three-region layout:

```
┌─────────────────────────────────────────────────┐
│ Sidebar │ TopNav (search, breadcrumb, actions)  │
│         │───────────────────────────────────────│
│ nav     │ Toolbar (Back/Fwd/Up, actions, views) │
│ icons   │ Address Bar (breadcrumbs)             │
│         │───────────────────────────────────────│
│         │ NavPanel │ FileArea │ PropertiesPanel │
│         │          │          │  (optional)     │
├─────────┴──────────┴──────────┴─────────────────┤
│ StatusBar                                       │
└─────────────────────────────────────────────────┘
```

### Sidebar
- Width: 208px expanded, 56px collapsed
- Contains: Logo, navigation icons (Explorer, Transfers, Devices, Settings), version footer
- Active item: left accent bar (3px), accent background, accent icon color
- Collapse: smooth width transition, text labels hidden

### TopNav
- Height: 44px
- Contains: sidebar toggle, breadcrumb (StorageOS > Page), search box (centered), theme toggle, actions
- Search box: centered with max-width, debounced (300ms), clear button, recursive toggle

### Toolbar
- Height: auto (fits content)
- Groups separated by vertical dividers
- Groups: Navigation (Back/Forward/Up/Refresh) | Actions (New Folder/Upload/Download) | Sort/View | Properties

### Address Bar
- Height: 36px
- Breadcrumb segments are clickable (except the last, which is current)
- Refresh button at the right end

### StatusBar
- Height: 24px
- Shows: agent status, storage type, item count, selection, clipboard, zoom, pair button

## File Area

### View Modes

| Mode | Grid | Icon Size | Description |
|------|------|-----------|-------------|
| Extra Large | 180px min | 96px | Large thumbnails |
| Large | 130px min | 64px | Medium thumbnails |
| Medium | 90px min | 32px | Small thumbnails |
| Small | 70px min | 16px | Icon + name only |
| List | Fixed 208px | 14px | Wrapping list of names |
| Details | Table | 14px | Sortable columns: Name, Date, Type, Size |

### Selection

- Click: select single item
- Ctrl+Click: toggle item in selection
- Shift+Click: range select
- Click background: deselect all
- Selected items: `bg-accent/10` with `ring-1 ring-accent/30` (grid) or `border-accent/20` (details)

## Dialogs

All dialogs use `DialogOverlay` + `DialogButton` components for consistency:

- Overlay: fixed inset, `bg-black/50` backdrop
- Dialog: white/dark surface, `rounded-lg`, `shadow-xl`, max-width 400px
- Title: 13px semibold
- Body: 12px text-secondary
- Actions: right-aligned, Cancel + Primary/Danger button

### Special Dialogs

- **Paste Conflict**: Windows 11 "Replace or Skip Files" style with maroon title bar, icon options
- **Transfer Progress**: Windows 11 copy dialog with progress bar, speed, ETA, pause/cancel
- **Insufficient Space**: Windows 11 error dialog with drive info, retry/cancel

## Context Menu

- Appears on right-click (entry or background)
- Max width: auto (fits content)
- Items: icon (14px) + label (12px) + optional keyboard shortcut (right-aligned, text-tertiary)
- Dividers separate groups (Open | Copy/Cut/Paste | Rename/Delete | Properties)
- Disabled items: reduced opacity, no pointer events

## Properties Panel

- Width: 280px (resizable, 200–400px range)
- Shows: file icon (large), name, type, size, dates, attributes (chips)
- Toggled via toolbar Properties button
