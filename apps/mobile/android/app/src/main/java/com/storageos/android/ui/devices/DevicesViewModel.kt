package com.storageos.android.ui.devices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.storageos.android.api.AgentApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DeviceRecord(
    @SerialName("device_id") val deviceId: String,
    @SerialName("system_name") val systemName: String,
    @SerialName("friendly_name") val friendlyName: String,
    @SerialName("device_type") val deviceType: String,
    val platform: String = "",
    val version: String = "",
    val address: String = "",
    @SerialName("last_seen") val lastSeen: Long = 0,
    @SerialName("paired_at") val pairedAt: Long = 0,
    val status: String = "offline",
)

data class DevicesUiState(
    val devices: List<DeviceRecord> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
)

class DevicesViewModel : ViewModel() {

    private val _state = MutableStateFlow(DevicesUiState())
    val state: StateFlow<DevicesUiState> = _state.asStateFlow()

    private var api: AgentApi? = null
    private var polling = false

    fun init(api: AgentApi) {
        this.api = api
        if (!polling) {
            polling = true
            startPolling()
        }
    }

    private fun startPolling() {
        viewModelScope.launch {
            while (polling) {
                loadDevices()
                delay(8_000)
            }
        }
    }

    private suspend fun loadDevices() {
        val client = api ?: return
        try {
            val response = client.listDevices()
            _state.value = _state.value.copy(
                devices = response,
                isLoading = false,
                error = null,
            )
        } catch (e: Exception) {
            _state.value = _state.value.copy(
                isLoading = false,
                error = if (_state.value.devices.isEmpty()) "Could not load devices" else null,
            )
        }
    }

    override fun onCleared() {
        polling = false
        super.onCleared()
    }
}
