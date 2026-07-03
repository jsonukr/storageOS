# Colors

## Design Tokens

StorageOS uses CSS custom properties for theming. All colors are defined in `apps/desktop/src/styles/index.css` inside `@theme` blocks.

### Light Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--color-surface` | `#ffffff` | Primary background |
| `--color-surface-secondary` | `#f8fafc` | Side panels, navigation, cards |
| `--color-surface-tertiary` | `#f1f5f9` | Nested surfaces, column headers |
| `--color-surface-hover` | `#f1f5f9` | Interactive hover background |
| `--color-border` | `#e2e8f0` | Primary borders |
| `--color-border-subtle` | `#f1f5f9` | Subtle separators |
| `--color-text-primary` | `#0f172a` | Body text, headings |
| `--color-text-secondary` | `#64748b` | Descriptions, metadata |
| `--color-text-tertiary` | `#94a3b8` | Placeholders, disabled text |
| `--color-accent` | `#2563eb` | Primary actions, selections, links |
| `--color-accent-hover` | `#1d4ed8` | Accent hover state |
| `--color-accent-subtle` | `#eff6ff` | Selected row background, highlights |
| `--color-accent-text` | `#1e40af` | Active navigation text |
| `--color-sidebar` | `#f8fafc` | Sidebar background |
| `--color-toolbar` | `#ffffff` | Toolbar background |
| `--color-statusbar` | `#f8fafc` | Status bar background |
| `--color-success` | `#16a34a` | Completed state, online |
| `--color-warning` | `#d97706` | Paused state, caution |
| `--color-danger` | `#dc2626` | Errors, destructive actions |

### Dark Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--color-surface` | `#1a1a2e` | Primary background |
| `--color-surface-secondary` | `#1e1e35` | Side panels, navigation |
| `--color-surface-tertiary` | `#252542` | Nested surfaces |
| `--color-surface-hover` | `#252542` | Interactive hover |
| `--color-border` | `#2d2d4a` | Primary borders |
| `--color-border-subtle` | `#252542` | Subtle separators |
| `--color-text-primary` | `#f1f5f9` | Body text |
| `--color-text-secondary` | `#94a3b8` | Descriptions |
| `--color-text-tertiary` | `#64748b` | Placeholders |
| `--color-accent` | `#3b82f6` | Primary actions |
| `--color-accent-hover` | `#60a5fa` | Accent hover |
| `--color-accent-subtle` | `#1e2a4a` | Selected background |
| `--color-accent-text` | `#93c5fd` | Active text |
| `--color-sidebar` | `#16162b` | Sidebar |
| `--color-toolbar` | `#1e1e35` | Toolbar |
| `--color-statusbar` | `#16162b` | Status bar |
| `--color-success` | `#22c55e` | Completed |
| `--color-warning` | `#f59e0b` | Paused |
| `--color-danger` | `#ef4444` | Errors |

## Semantic Colors

| Purpose | Color |
|---------|-------|
| Selection highlight | `accent/10` (10% opacity accent) |
| Active indicator | `accent` solid |
| Online status | `success` |
| Offline status | `text-tertiary` |
| Error state | `danger` |
| Warning/paused | `warning` |

## File Type Colors

| Category | Hex | Usage |
|----------|-----|-------|
| Folder | `#dcb44c` | Folder icons |
| Image | `#26A69A` | Image file icons |
| Video | `#7B1FA2` | Video file icons |
| Audio | `#F57C00` | Audio file icons |
| PDF | `#E2574C` | PDF file icons |
| Word | `#2B579A` | Document file icons |
| Excel | `#217346` | Spreadsheet file icons |
| PowerPoint | `#D24726` | Presentation file icons |
| Archive | `#FFA000` | Compressed file icons |
| Code | `#5C6BC0` | Source code file icons |
| Text | `#78909C` | Plain text file icons |
| Executable | `#546E7A` | Executable file icons |

## Rules

- Never hardcode hex values in components. Always use CSS custom properties or Tailwind tokens.
- Dark mode must have equal visual hierarchy to light mode (not just inverted colors).
- Status colors (success/warning/danger) are consistent across both themes.
- File type colors do not change between themes.
