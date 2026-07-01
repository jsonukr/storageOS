package com.storageos.android.ui.connect

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.storageos.android.api.AgentApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ConnectUiState(
    val host: String = "",
    val port: String = "19742",
    val isConnecting: Boolean = false,
    val error: String? = null,
    val agentVersion: String? = null,
    val agentPlatform: String? = null,
)

class ConnectViewModel : ViewModel() {

    private val _state = MutableStateFlow(ConnectUiState())
    val state: StateFlow<ConnectUiState> = _state.asStateFlow()

    private var api: AgentApi? = null

    fun onHostChanged(value: String) {
        _state.value = _state.value.copy(host = value, error = null)
    }

    fun onPortChanged(value: String) {
        _state.value = _state.value.copy(port = value, error = null)
    }

    fun connect(onConnected: (AgentApi) -> Unit) {
        val current = _state.value
        val host = current.host.trim()
        val port = current.port.trim().toIntOrNull()

        if (host.isEmpty()) {
            _state.value = current.copy(error = "Enter an IP address")
            return
        }

        if (port == null || port !in 1..65535) {
            _state.value = current.copy(error = "Enter a valid port (1–65535)")
            return
        }

        _state.value = current.copy(isConnecting = true, error = null)

        viewModelScope.launch {
            try {
                val client = AgentApi.create(host, port)
                val health = client.health()

                if (health.status != "ok") {
                    _state.value = _state.value.copy(
                        isConnecting = false,
                        error = "Agent returned status: ${health.status}",
                    )
                    return@launch
                }

                api = client
                _state.value = _state.value.copy(
                    isConnecting = false,
                    agentVersion = health.version,
                    agentPlatform = health.platform,
                )
                onConnected(client)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isConnecting = false,
                    error = friendlyError(e),
                )
            }
        }
    }

    private fun friendlyError(e: Exception): String = when {
        e is java.net.ConnectException -> "Could not connect. Check the IP address and make sure the Agent is running."
        e is java.net.SocketTimeoutException -> "Connection timed out. Check the IP address and port."
        e is java.net.UnknownHostException -> "Unknown host. Check the IP address."
        else -> "Connection failed: ${e.message}"
    }
}
