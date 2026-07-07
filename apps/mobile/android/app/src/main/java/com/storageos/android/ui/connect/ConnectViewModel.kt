package com.storageos.android.ui.connect

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.storageos.android.api.AgentApi
import com.storageos.android.api.PairDeviceRequest
import com.storageos.android.api.PairInitiateV2Request
import com.storageos.android.data.DeviceStore
import com.storageos.android.data.SavedDevice
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.Inet4Address
import java.net.NetworkInterface

data class ConnectUiState(
    val host: String = "",
    val port: String = "19742",
    val isConnecting: Boolean = false,
    val error: String? = null,
    val agentVersion: String? = null,
    val agentPlatform: String? = null,
    val savedDevices: List<SavedDevice> = emptyList(),
)

@Serializable
private data class QrPayload(
    @SerialName("device_id") val deviceId: String = "",
    val host: String = "",
    val port: Int = 0,
    val name: String = "Desktop",
    @SerialName("pairing_token") val pairingToken: String = "",
    val version: String = "",
)

@Serializable
private data class QrPayloadV2(
    val v: Int = 0,
    val id: String = "",
    val pk: String = "",
    val fp: String = "",
    val name: String = "",
    val code: String = "",
    val caps: List<String> = emptyList(),
    val relay: String? = null,
    val ts: Long = 0,
    val sig: String? = null,
    val hint: QrV2Hint? = null,
)

@Serializable
private data class QrV2Hint(
    val lan: String = "",
)

@Serializable
private data class PairLookupResult(
    val found: Boolean = false,
    @SerialName("device_id") val deviceId: String = "",
    @SerialName("display_name") val displayName: String = "",
    val fingerprint: String = "",
)

class ConnectViewModel(application: Application) : AndroidViewModel(application) {

    private val _state = MutableStateFlow(ConnectUiState())
    val state: StateFlow<ConnectUiState> = _state.asStateFlow()

    private val deviceStore = DeviceStore(application)
    private var api: AgentApi? = null
    private val json = Json { ignoreUnknownKeys = true }
    private val myDeviceId = deviceStore.getOrCreateDeviceId()

    init {
        _state.value = _state.value.copy(savedDevices = deviceStore.loadAll())
    }

    fun onHostChanged(value: String) {
        _state.value = _state.value.copy(host = value, error = null)
    }

    fun onPortChanged(value: String) {
        _state.value = _state.value.copy(port = value, error = null)
    }

    fun onQrScanned(rawValue: String, onConnected: (AgentApi) -> Unit) {
        try {
            if (rawValue.contains("\"v\"") && (rawValue.contains("\"v\":2") || rawValue.contains("\"v\": 2"))) {
                val v2 = json.decodeFromString<QrPayloadV2>(rawValue)
                handleV2Qr(v2, onConnected)
            } else {
                val payload = json.decodeFromString<QrPayload>(rawValue)
                if (payload.host.isBlank() || payload.port !in 1..65535) {
                    _state.value = _state.value.copy(error = "Invalid QR code data")
                    return
                }
                _state.value = _state.value.copy(
                    host = payload.host,
                    port = payload.port.toString(),
                    error = null,
                )
                connectTo(payload.host, payload.port, payload.name, payload.pairingToken, payload.deviceId, onConnected)
            }
        } catch (_: Exception) {
            _state.value = _state.value.copy(error = "Invalid QR code")
        }
    }

    private fun handleV2Qr(v2: QrPayloadV2, onConnected: (AgentApi) -> Unit) {
        val lanHint = v2.hint?.lan
        val parts = lanHint?.split(":") ?: emptyList()
        val host = parts.getOrNull(0) ?: ""
        val port = parts.getOrNull(1)?.toIntOrNull() ?: 19742

        if (host.isNotBlank()) {
            _state.value = _state.value.copy(host = host, port = port.toString(), error = null)
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isConnecting = true, error = null)

            if (host.isNotBlank()) {
                try {
                    val client = AgentApi.create(host, port)
                    val health = client.health()
                    if (health.status == "ok") {
                        val pairCode = v2.code.replace("-", "")
                        try {
                            client.pairInitiate(PairInitiateV2Request(
                                pairCode = pairCode,
                                deviceId = myDeviceId,
                                displayName = android.os.Build.MODEL,
                                deviceKind = "android",
                                platform = "Android ${android.os.Build.VERSION.RELEASE}",
                                version = "0.1.0",
                            ))
                        } catch (_: Exception) {
                            val myAddress = "${getLocalIpAddress()}:${com.storageos.android.server.StorageServer.DEFAULT_PORT}"
                            try {
                                client.pairDevice(PairDeviceRequest(
                                    deviceId = myDeviceId,
                                    systemName = android.os.Build.MODEL,
                                    deviceType = "android",
                                    platform = "Android ${android.os.Build.VERSION.RELEASE}",
                                    version = "0.1.0",
                                    address = myAddress,
                                    pairingToken = v2.code,
                                ))
                            } catch (_: Exception) { }
                        }

                        api = client
                        _state.value = _state.value.copy(isConnecting = false)
                        val relayFromQr = v2.relay
                        if (!relayFromQr.isNullOrBlank()) {
                            deviceStore.saveRelayUrl(relayFromQr)
                        } else {
                            deviceStore.saveRelayUrl("ws://$host:19800/ws")
                        }
                        deviceStore.save(com.storageos.android.data.SavedDevice(
                            deviceId = v2.id,
                            host = host,
                            port = port,
                            name = v2.name,
                            version = health.version,
                            platform = health.platform,
                        ))
                        _state.value = _state.value.copy(savedDevices = deviceStore.loadAll())
                        onConnected(client)
                        return@launch
                    }
                } catch (_: Exception) {
                    // LAN failed, fall through to relay
                }
            }

            // Cross-network: use relay to send pair initiate
            val relayUrl = v2.relay
            if (relayUrl.isNullOrBlank()) {
                _state.value = _state.value.copy(
                    isConnecting = false,
                    error = "Cannot reach device. No LAN connection and no relay available.",
                )
                return@launch
            }

            try {
                deviceStore.saveRelayUrl(relayUrl)
                val httpUrl = relayUrl
                    .replace("ws://", "http://")
                    .replace("wss://", "https://")
                    .trimEnd('/').removeSuffix("/ws")

                val okClient = okhttp3.OkHttpClient.Builder()
                    .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                    .build()

                val pairCode = v2.code.replace("-", "")
                val bodyStr = """{"pair_code":"$pairCode"}"""
                val mediaType = "application/json".toMediaType()

                val lookupRequest = okhttp3.Request.Builder()
                    .url("$httpUrl/pair/lookup")
                    .post(bodyStr.toRequestBody(mediaType))
                    .build()

                val lookupResponse = okClient.newCall(lookupRequest).execute()
                val lookupBody = lookupResponse.body?.string() ?: "{}"
                val lookupResult = json.decodeFromString<PairLookupResult>(lookupBody)

                if (!lookupResult.found) {
                    _state.value = _state.value.copy(
                        isConnecting = false,
                        error = "Pairing code not found or expired.",
                    )
                    return@launch
                }

                deviceStore.save(com.storageos.android.data.SavedDevice(
                    deviceId = v2.id,
                    host = "",
                    port = 0,
                    name = v2.name,
                ))
                _state.value = _state.value.copy(
                    isConnecting = false,
                    savedDevices = deviceStore.loadAll(),
                    error = "Pair request sent via relay. Waiting for approval on ${v2.name}.",
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isConnecting = false,
                    error = "Relay connection failed: ${e.message}",
                )
            }
        }
    }

    fun connectToSaved(device: SavedDevice, onConnected: (AgentApi) -> Unit) {
        _state.value = _state.value.copy(
            host = device.host,
            port = device.port.toString(),
            error = null,
        )
        connectTo(device.host, device.port, device.name, null, device.deviceId, onConnected)
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

        connectTo(host, port, null, null, null, onConnected)
    }

    private fun connectTo(
        host: String,
        port: Int,
        deviceName: String?,
        pairingToken: String?,
        remoteDeviceId: String?,
        onConnected: (AgentApi) -> Unit,
    ) {
        _state.value = _state.value.copy(isConnecting = true, error = null)

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
                deviceStore.saveRelayUrl("ws://$host:19800/ws")

                val actualDeviceId = remoteDeviceId?.takeIf { it.isNotEmpty() } ?: health.deviceId

                if (!pairingToken.isNullOrEmpty()) {
                    try {
                        val myAddress = "${getLocalIpAddress()}:${com.storageos.android.server.StorageServer.DEFAULT_PORT}"
                        val response = client.pairDevice(PairDeviceRequest(
                            deviceId = myDeviceId,
                            systemName = android.os.Build.MODEL,
                            deviceType = "android",
                            platform = "Android ${android.os.Build.VERSION.RELEASE}",
                            version = "0.1.0",
                            address = myAddress,
                            pairingToken = pairingToken,
                        ))

                        deviceStore.save(SavedDevice(
                            deviceId = response.deviceId,
                            host = host,
                            port = port,
                            name = deviceName ?: response.systemName,
                            systemName = response.systemName,
                            deviceType = response.deviceType,
                            platform = response.platform,
                            version = response.version,
                        ))
                    } catch (_: Exception) {
                        deviceStore.save(SavedDevice(
                            deviceId = actualDeviceId,
                            host = host,
                            port = port,
                            name = deviceName ?: host,
                        ))
                    }
                } else {
                    deviceStore.save(SavedDevice(
                        deviceId = actualDeviceId,
                        host = host,
                        port = port,
                        name = deviceName ?: host,
                        version = health.version,
                        platform = health.platform,
                    ))
                }

                _state.value = _state.value.copy(savedDevices = deviceStore.loadAll())
                onConnected(client)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isConnecting = false,
                    error = friendlyError(e),
                )
            }
        }
    }

    private fun getLocalIpAddress(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val intf = interfaces.nextElement()
                if (intf.isLoopback || !intf.isUp) continue
                val addrs = intf.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        return addr.hostAddress ?: continue
                    }
                }
            }
        } catch (_: Exception) {}
        return "0.0.0.0"
    }

    private fun friendlyError(e: Exception): String = when {
        e is java.net.ConnectException -> "Could not connect. Check the IP address and make sure the Agent is running."
        e is java.net.SocketTimeoutException -> "Connection timed out. Check the IP address and port."
        e is java.net.UnknownHostException -> "Unknown host. Check the IP address."
        else -> "Connection failed: ${e.message}"
    }
}
