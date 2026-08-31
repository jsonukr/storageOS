package com.storageos.android.ui.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.storageos.android.api.AgentApi
import com.storageos.android.transfer.DownloadManager
import com.storageos.android.transfer.UploadManager
import com.storageos.android.ui.adaptive.AdaptiveScaffold
import com.storageos.android.ui.adaptive.NavDestination
import com.storageos.android.ui.browser.BrowserScreen
import com.storageos.android.ui.browser.BrowserViewModel
import com.storageos.android.ui.connect.ConnectScreen
import com.storageos.android.ui.connect.ConnectViewModel
import com.storageos.android.ui.devices.DevicesScreen
import com.storageos.android.ui.pair.PairScreen
import com.storageos.android.ui.settings.SettingsScreen
import com.storageos.android.ui.transfers.TransfersScreen
import com.storageos.android.update.UpdateGate

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    var connectedApi by remember { mutableStateOf<AgentApi?>(null) }
    var connectedDeviceId by remember { mutableStateOf<String?>(null) }
    var agentBaseUrl by remember { mutableStateOf("") }
    val browserViewModel: BrowserViewModel = viewModel()
    val context = androidx.compose.ui.platform.LocalContext.current
    val downloadManager = remember { DownloadManager(context) }
    val uploadManager = remember { UploadManager(context) }

    // Tear down the current connection and clear the browser so stale drives /
    // files never linger after disconnecting or forgetting a device.
    val resetToConnect: () -> Unit = {
        connectedApi = null
        connectedDeviceId = null
        browserViewModel.reset()
        navController.navigate("connect") {
            popUpTo(0) { inclusive = true }
        }
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: "connect"
    val isConnected = connectedApi != null
    val showNav = isConnected && currentRoute in listOf("browser", "devices", "transfers", "settings")

    val navigateToDestination: (NavDestination) -> Unit = { dest ->
        if (currentRoute != dest.route) {
            navController.navigate(dest.route) {
                popUpTo("browser") { inclusive = false }
                launchSingleTop = true
            }
        }
    }

    val content: @Composable () -> Unit = {
        NavHost(navController = navController, startDestination = "connect") {
            composable("connect") {
                val connectViewModel: ConnectViewModel = viewModel()
                ConnectScreen(
                    onConnected = { api ->
                        connectedApi = api
                        val s = connectViewModel.state.value
                        // DeviceStore.save() inserts the just-connected device at
                        // index 0, so the head of the list is the active device.
                        connectedDeviceId = s.savedDevices.firstOrNull()?.deviceId
                        agentBaseUrl = if (s.host.isNotBlank()) "http://${s.host}:${s.port}" else ""
                        navController.navigate("browser") {
                            popUpTo("connect") { inclusive = true }
                        }
                    },
                    onSharePairing = { navController.navigate("pair") },
                    viewModel = connectViewModel,
                )
            }

            composable("browser") {
                val api = connectedApi
                if (api != null) {
                    BackHandler {
                        if (!browserViewModel.goBack()) {
                            resetToConnect()
                        }
                    }

                    BrowserScreen(
                        api = api,
                        agentBaseUrl = agentBaseUrl,
                        onDisconnect = { resetToConnect() },
                        onOpenSettings = { navController.navigate("settings") },
                        onOpenDevices = { navController.navigate("devices") },
                        onOpenTransfers = { navController.navigate("transfers") },
                        showNavigationActions = false,
                        downloadManager = downloadManager,
                        uploadManager = uploadManager,
                        viewModel = browserViewModel,
                    )
                }
            }

            composable("devices") {
                val api = connectedApi
                if (api != null) {
                    DevicesScreen(
                        api = api,
                        onBack = {
                            navController.navigate("browser") {
                                popUpTo("browser") { inclusive = true }
                                launchSingleTop = true
                            }
                        },
                        onAddDevice = { resetToConnect() },
                        onForgetActiveDevice = { deviceId ->
                            if (deviceId == connectedDeviceId) resetToConnect()
                        },
                    )
                }
            }

            composable("transfers") {
                TransfersScreen(
                    downloadManager = downloadManager,
                    uploadManager = uploadManager,
                    onBack = {
                        navController.navigate("browser") {
                            popUpTo("browser") { inclusive = true }
                            launchSingleTop = true
                        }
                    },
                )
            }

            composable("pair") {
                PairScreen(
                    onBack = { navController.popBackStack() },
                    onPaired = { navController.popBackStack() },
                )
            }

            composable("settings") {
                SettingsScreen(
                    onBack = {
                        navController.navigate("browser") {
                            popUpTo("browser") { inclusive = true }
                            launchSingleTop = true
                        }
                    },
                )
            }
        }
    }

    if (showNav) {
        AdaptiveScaffold(
            currentRoute = currentRoute,
            onNavigate = navigateToDestination,
            content = content,
        )
    } else {
        content()
    }

    // Overlays an "update available" dialog on top of any screen if the relay's
    // /version manifest reports a newer build than this one.
    UpdateGate()
}
