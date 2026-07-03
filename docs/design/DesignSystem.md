# StorageOS Design System

**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-07-03

---

## Philosophy

StorageOS follows the **Windows 11 Fluent Design** language. The app should feel like a native Windows application — not a web page inside a shell.

### Principles

1. **Familiar** — Users should feel at home. Windows conventions are preferred over web conventions.
2. **Consistent** — Every screen uses the same spacing, typography, colors, and interaction patterns.
3. **Quiet** — UI elements should not compete for attention. Let content (files, folders, transfers) be the focus.
4. **Responsive** — Every action gives immediate visual feedback. Hover states, press states, and transitions are mandatory.
5. **Accessible** — All interactive elements must be keyboard-reachable and screen-reader-friendly.

### Design Reference

Primary reference: **Windows 11 File Explorer**

Secondary references:
- Windows 11 Settings
- Windows 11 Task Manager (for transfers)
- WinUI 3 Gallery (for component patterns)

---

## Platform Rules

### Desktop (Windows)

- Follow Windows 11 visual patterns
- Use Segoe UI / Inter as primary typeface
- 8px spacing grid
- Rounded corners (4–8px)
- Light and dark themes required
- Toolbar icons are 14–16px, with optional text labels for primary actions
- Context menus use system-like styling with dividers and keyboard shortcuts

### Android

- Follow Material 3 design language
- Use Material You dynamic color where available
- Touch targets minimum 48dp
- Bottom navigation or drawer for primary navigation
- Use Compose Material 3 components exclusively

---

## File Organization

| File | Purpose |
|------|---------|
| `DesignSystem.md` | This overview document |
| `Colors.md` | Color palette and semantic tokens |
| `Typography.md` | Type scale, font families, weights |
| `Desktop.md` | Desktop-specific component patterns |
| `Android.md` | Android-specific component patterns |
| `Icons.md` | Icon system and conventions |
| `Motion.md` | Animation and transition patterns |
| `Accessibility.md` | Accessibility standards and checklist |
