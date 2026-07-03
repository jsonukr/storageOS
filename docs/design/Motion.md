# Motion & Animation

## Principles

1. **Purposeful** — Animations communicate state changes, not decoration.
2. **Fast** — Transitions feel instant. 150ms is the standard, 250ms is the maximum.
3. **Subtle** — Users should notice the effect, not the animation itself.

## Duration Scale

| Duration | Usage |
|----------|-------|
| 100ms | Micro-interactions: hover color changes, opacity toggles |
| 150ms | Standard transitions: panel slides, button presses, menu show/hide |
| 200ms | Content transitions: expand/collapse, view mode switches |
| 250ms | Layout transitions: sidebar collapse, panel resize |
| 300ms | Progress bar updates (`transition-all duration-300`) |

## Easing

| Easing | CSS | Usage |
|--------|-----|-------|
| Standard | `ease-in-out` | Most transitions |
| Enter | `ease-out` | Elements appearing (menus, dialogs) |
| Exit | `ease-in` | Elements disappearing |

## Patterns

### Hover States
- Background color changes: 150ms transition
- Text color changes: 150ms transition
- Always use `transition-colors` class

### Sidebar Collapse
- Width transition: 200ms `ease-in-out`
- Text labels fade with the width change (no separate opacity animation)

### Dialog Appearance
- Overlay fade: instant (no animation on the backdrop)
- Dialog itself: no entrance animation (matches Windows 11 behavior)

### Progress Bars
- Width changes: 300ms `transition-all`
- Color changes on status: 300ms

### Loading Spinners
- Standard spinner: `animate-spin` (1s linear infinite)
- Connecting dot: `animate-pulse` (2s ease-in-out infinite)

### Context Menu
- Show: instant (no animation)
- Hide: instant

## Anti-patterns

- No bouncing or spring animations
- No staggered list entrance animations
- No parallax effects
- No page transition animations between routes
- No skeleton shimmer on desktop (only on Android)
