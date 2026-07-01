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
import com.storageos.android.ui.browser.BrowserScreen
import com.storageos.android.ui.browser.BrowserViewModel
import com.storageos.android.ui.connect.ConnectScreen

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    var connectedApi by remember { mutableStateOf<AgentApi?>(null) }
    val browserViewModel: BrowserViewModel = viewModel()

    NavHost(navController = navController, startDestination = "connect") {
        composable("connect") {
            ConnectScreen(
                onConnected = { api ->
                    connectedApi = api
                    navController.navigate("browser") {
                        popUpTo("connect") { inclusive = true }
                    }
                },
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
                    onDisconnect = {
                        connectedApi = null
                        navController.navigate("connect") {
                            popUpTo("browser") { inclusive = true }
                        }
                    },
                    viewModel = browserViewModel,
                )
            }
        }
    }
}
