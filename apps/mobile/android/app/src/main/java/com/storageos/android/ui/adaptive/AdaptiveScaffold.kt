package com.storageos.android.ui.adaptive

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector

enum class NavDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    Browser("browser", "Files", Icons.AutoMirrored.Filled.InsertDriveFile),
    Transfers("transfers", "Transfers", Icons.Default.SwapVert),
    Devices("devices", "Devices", Icons.Default.Devices),
    Settings("settings", "Settings", Icons.Default.Settings),
}

@Composable
fun AdaptiveScaffold(
    currentRoute: String,
    onNavigate: (NavDestination) -> Unit,
    content: @Composable () -> Unit,
) {
    val windowSizeClass = LocalWindowSizeClass.current
    val showRail = windowSizeClass.showNavigationRail()

    if (showRail) {
        Row(modifier = Modifier.fillMaxSize()) {
            NavigationRail(
                modifier = Modifier.fillMaxHeight(),
                containerColor = MaterialTheme.colorScheme.surface,
            ) {
                NavDestination.entries.forEach { dest ->
                    NavigationRailItem(
                        selected = currentRoute == dest.route,
                        onClick = { onNavigate(dest) },
                        icon = {
                            Icon(
                                imageVector = dest.icon,
                                contentDescription = dest.label,
                            )
                        },
                        label = { Text(dest.label) },
                    )
                }
            }
            VerticalDivider()
            content()
        }
    } else {
        content()
    }
}
