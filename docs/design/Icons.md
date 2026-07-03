# Icons

## Icon System

StorageOS uses **inline SVG icons** exclusively. No icon library dependencies.

### Sizing

| Context | Size | Stroke Width |
|---------|------|-------------|
| Toolbar buttons | 14x14 | 1.2–1.3 |
| Navigation (sidebar) | 18x18 | 1.3 |
| Context menu items | 14x14 | 1.2 |
| File icons (details view) | 14x14 | 0.8 |
| File icons (grid view) | 16–96px | 1.0 |
| Status indicators | 11x11 | 0.9 |
| Dialog icons | 16x16 | 1.5–1.6 |
| Empty state illustrations | 24–48px | 1.4–2.0 |

### Style

- **Line style**: Rounded caps and joins (`strokeLinecap="round"`, `strokeLinejoin="round"`)
- **Fill**: Icons are outline-only by default. Filled variants used for active states or emphasis.
- **Color**: Icons inherit `currentColor` from their parent text color.

### File Type Icons

File icons use a document-page base shape with category-specific symbols:
- PDF: "PDF" text label
- Word: "W" text label
- Excel: "X" text label
- PowerPoint: "P" text label
- Image: Mountain/sun motif
- Video: Play triangle
- Audio: Note/stem
- Archive: Zipper pattern
- Code: Angle brackets
- Text: Horizontal lines

### Folder Icons

- Standard folder: Filled with 55% opacity, warm yellow (`#dcb44c`)
- Folder with plus: New folder action
- Folder with arrow: Transfer/move

### Status Dots

- Online: `bg-success` (green)
- Connecting: `bg-warning animate-pulse` (yellow, pulsing)
- Error: `bg-danger` (red)
- Offline: `bg-text-tertiary` (gray)

### Rules

- Never use emoji as icons
- Never use external icon libraries (no Lucide, no Heroicons, no Material Icons)
- All icons must be `shrink-0` to prevent compression in flex layouts
- Use `aria-label` on icon-only buttons
- Icons in disabled buttons use the same color as text (opacity handles the disabled look)
