# Accessibility

## Standards

StorageOS targets **WCAG 2.1 Level AA** compliance where practical.

## Keyboard Navigation

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+H` | Toggle hidden files |
| `Ctrl+C` | Copy selected entries |
| `Ctrl+X` | Cut selected entries |
| `Ctrl+V` | Paste |
| `Delete` | Delete selected entries |
| `F2` | Rename selected entry |
| `Escape` | Close dialog / clear search / deselect |
| `Enter` | Open selected entry / submit dialog |

### Explorer Navigation

| Shortcut | Action |
|----------|--------|
| `Alt+Left` | Navigate back |
| `Alt+Right` | Navigate forward |
| `Alt+Up` | Navigate to parent folder |
| `F5` | Refresh current directory |

### Focus Management

- Dialogs trap focus within themselves
- Opening a dialog moves focus to the first input
- Closing a dialog returns focus to the trigger element
- Tab order follows visual layout (left to right, top to bottom)
- File area is focusable (`tabIndex={-1}`) for keyboard events

## ARIA Labels

### Required Labels

- All icon-only buttons must have `aria-label`
- Navigation landmarks use `aria-label` (e.g., `aria-label="Breadcrumb"`)
- Status indicators have `title` attributes
- Dialogs use heading elements for screen reader context

### Patterns

```tsx
// Icon-only button
<button aria-label="Back" title="Back">
  <svg>...</svg>
</button>

// Disabled button
<button disabled aria-label="Download" className="disabled:opacity-35 disabled:pointer-events-none">
  <svg>...</svg>
</button>

// Status dot
<span className="h-1.5 w-1.5 rounded-full bg-success" title="Online" />
```

## Color Contrast

- Text on surface: minimum 4.5:1 contrast ratio
- Large text (18px+): minimum 3:1
- Interactive elements: minimum 3:1 against background
- Status colors (success/warning/danger) chosen for both light and dark theme contrast

## Motion

- Users who prefer reduced motion: respect `prefers-reduced-motion` media query
- Critical state changes (errors, completions) use color/icon, not animation alone

## Android

- All Composables with click handlers use `Modifier.semantics { contentDescription = "..." }`
- Status dots include content descriptions
- Images include content descriptions via `contentDescription` parameter
- Bottom sheets and dialogs use proper Material 3 accessibility roles

## Checklist

For every new component or feature:

- [ ] All interactive elements reachable via Tab key
- [ ] All icon-only buttons have `aria-label`
- [ ] Dialogs trap focus and restore it on close
- [ ] Color is not the only indicator of state (use icons or text too)
- [ ] Text contrast meets 4.5:1 minimum
- [ ] Screen reader can understand the component purpose
