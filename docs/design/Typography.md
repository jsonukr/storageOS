# Typography

## Font Families

| Role | Stack | Usage |
|------|-------|-------|
| Primary | `"Inter", "Segoe UI", system-ui, -apple-system, sans-serif` | All UI text |
| Monospace | `"JetBrains Mono", "Cascadia Code", "Fira Code", monospace` | File paths, code, technical values |

## Type Scale

| Name | Size | Weight | Usage |
|------|------|--------|-------|
| Page title | 16px (base) | Semibold (600) | Page headings (Transfers, Devices, Settings) |
| Section header | 13px | Semibold (600) | Dialog titles, card headers, section labels |
| Body | 12–13px | Regular (400) | File names, descriptions, dialog text |
| Small | 11px | Medium (500) | Toolbar labels, status bar, metadata, column headers |
| Micro | 10px | Regular (400) | Timestamps, secondary detail, child job info |

## Font Features

OpenType features enabled globally:
- `cv02`, `cv03`, `cv04`, `cv11` (Inter stylistic alternates for better legibility at small sizes)

## Rendering

- `-webkit-font-smoothing: antialiased` on all platforms
- `-moz-osx-font-smoothing: grayscale` for macOS

## Rules

- Body text is 12px minimum. Never go below 10px.
- Use `font-medium` (500) for interactive labels (buttons, menu items).
- Use `font-semibold` (600) for headings and section titles.
- Use `font-normal` (400) for body text and descriptions.
- Use `text-text-primary` for content text, `text-text-secondary` for metadata, `text-text-tertiary` for placeholders and disabled.
- Truncate long text with `truncate` class (single line) or `line-clamp-2` (two lines max).
- File names use the `overflowWrap: "anywhere"` rule in dialogs to prevent overflow.
