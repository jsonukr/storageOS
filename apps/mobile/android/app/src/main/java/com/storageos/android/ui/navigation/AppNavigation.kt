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
import androidx.navigation.compose.rememberNavController
import com.storageos.android.api.AgentApi
import com.storageos.android.transfer.DownloadManager
import com.storageos.android.transfer.UploadManager
import com.storageos.android.ui.browser.BrowserScreen
import com.storageos.android.ui.browser.BrowserViewModel
import com.storageos.android.ui.connect.ConnectScreen
import com.storageos.android.ui.connect.ConnectViewModel
import com.storageos.android.ui.devices.DevicesScreen
import com.storageos.android.ui.pair.PairScreen
import com.storageos.android.ui.settings.SettingsScreen
import com.storageos.android.ui.transfers.TransfersScreen

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    var connectedApi by remember { mutableStateOf<AgentApi?>(null) }
    var agentBaseUrl by remember { mutableStateOf("") }
    val browserViewModel: BrowserViewModel = viewModel()
    val context = androidx.compose.ui.platform.LocalContext.current
    val downloadManager = remember { DownloadManager(context) }
    val uploadManager = remember { UploadManager(context) }

    NavHost(navController = navController, startDestination = "connect") {
        composable("connect") {
            val connectViewModel: ConnectViewModel = viewModel()
            ConnectScreen(
                onConnected = { api ->
                    connectedApi = api
                    val s = connectViewModel.state.value
                    agentBaseUrl = "http://${s.host}:${s.port}"
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
                        connectedApi = null
                        navController.navigate("connect") {
                            popUpTo("browser") { inclusive = true }
                        }
                    }
                }

                BrowserScreen(
                    api = api,
                    agentBaseUrl = agentBaseUrl,
                    onDisconnect = {
                        connectedApi = null
                        navController.navigate("connect") {
                            popUpTo("browser") { inclusive = true }
                        }
                    },
                    onOpenSettings = {
                        navController.navigate("settings")
                    },
                    onOpenDevices = {
                        navController.navigate("devices")
                    },
                    onOpenTransfers = {
                        navController.navigate("transfers")
                    },
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
                    onBack = { navController.popBackStack() },
                )
            }
        }

        composable("transfers") {
            TransfersScreen(
                downloadManager = downloadManager,
                uploadManager = uploadManager,
                onBack = { navController.popBackStack() },
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
                onBack = { navController.popBackStack() },
            )
        }
    }
}
