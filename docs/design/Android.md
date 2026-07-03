# Android Components

## Framework

- **Jetpack Compose** with **Material 3**
- **Material You** dynamic color on Android 12+ (S+)
- Custom light/dark color schemes as fallback for older devices

## Navigation

- Single Activity architecture
- Navigation Compose for routing
- Routes: Connect -> Browser -> (Devices, Transfers, Settings, ImagePreview)
- System back button navigation matches stack behavior

## Screens

### Connect Screen
- Manual host:port input fields
- QR code scan button (camera permission)
- Saved devices list with tap-to-reconnect
- Connection state (idle, connecting, error) with friendly messages

### Browser Screen
- Top bar: path display, item count, action buttons (grid/list toggle, transfers, devices, settings)
- Home view: "LOCAL STORAGE" section (drive rows) + "DEVICES" section (device rows)
- Directory view: file/folder list with icons, names, metadata
- Breadcrumb bar: scrollable horizontal path segments
- Pull-to-refresh via PullToRefreshBox
- Grid/list toggle with LazyVerticalGrid (adaptive 96dp columns)
- Shimmer loading placeholder (animated gradient, 8 skeleton rows)
- AnimatedContent transitions between states

### Image Preview
- Full-screen dark overlay
- HorizontalPager for swipe navigation
- Pinch-to-zoom (1x-5x), double-tap zoom (3x)
- Pan with bounds when zoomed
- Preloads adjacent images (`beyondViewportPageCount = 1`)
- Tap to show/hide overlay controls

### Devices Screen
- Device cards: icon, friendly name, status dot, platform, version, paired date
- Live status polling every 8 seconds

### Transfers Screen
- Download and upload job list
- Status-specific icons (cloud, check, error, cancel)
- Progress indicators for active transfers
- Cancel/remove actions
- Clear All in top bar

### Settings Screen
- Theme toggle (system default)
- Clear saved devices (with confirmation)
- About section (version, protocol)

## Design Patterns

### Touch Targets
- Minimum 48dp for all interactive elements
- Ripple effect on tappable items

### Typography
- Material 3 type scale (headlineSmall, bodyMedium, labelMedium, etc.)
- No custom font — use default Material 3 font

### Spacing
- 16dp standard horizontal padding
- 8dp between list items
- 12dp section spacing

### Status Indicators
- Online: green dot (8dp), Color(0xFF4CAF50)
- Offline: gray dot (8dp), Color(0xFF9E9E9E)

### Empty States
- Centered icon + message
- Uses Material Icons (standard set)

### Loading States
- Shimmer skeleton for initial load
- CircularProgressIndicator for inline loading
- Pull-to-refresh for manual reload
