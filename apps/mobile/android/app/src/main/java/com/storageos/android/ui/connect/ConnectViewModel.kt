package com.storageos.android.ui.connect

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.storageos.android.api.AgentApi
import com.storageos.android.api.PairDeviceRequest
import com.storageos.android.api.PairInitiateV2Request
import com.storageos.android.data.DeviceStore
import com.storageos.android.data.SavedDevice
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import android.util.Log
import com.storageos.android.data.DeviceIdentity
import com.storageos.android.network.RelayAgentApi
import com.storageos.android.network.RelayClient
import java.net.Inet4Address
import java.net.NetworkInterface

private const val TAG = "ConnectVM"
private const val PAIR_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

private const val DEFAULT_RELAY_URL = "wss://storageos.onrender.com/ws"

data class ConnectUiState(
    val host: String = "",
    val port: String = "19742",
    val pairingCode: String = "",
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
    private var activeRelay: RelayClient? = null
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

    fun onPairingCodeChanged(value: String) {
        // Strip everything that isn't a code character, then re-insert dashes
        // every 4 characters so the field reads XXXX-XXXX-XXXX as the user types.
        val cleaned = value.uppercase().filter { it in PAIR_CODE_CHARSET }.take(12)
        val formatted = cleaned.chunked(4).joinToString("-")
        _state.value = _state.value.copy(pairingCode = formatted, error = null)
    }

    fun submitPairingCode(onConnected: (AgentApi) -> Unit) {
        val code = _state.value.pairingCode.replace("-", "").trim()
        if (code.length < 8) {
            _state.value = _state.value.copy(error = "Enter a valid pairing code")
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isConnecting = true, error = null)
            try {
                val lookupResult = withContext(Dispatchers.IO) {
                    val httpUrl = DEFAULT_RELAY_URL
                        .replace("ws://", "http://")
                        .replace("wss://", "https://")
                        .trimEnd('/').removeSuffix("/ws")

                    val okClient = okhttp3.OkHttpClient.Builder()
                        .connectTimeout(90, java.util.concurrent.TimeUnit.SECONDS)
                        .readTimeout(90, java.util.concurrent.TimeUnit.SECONDS)
                        .build()

                    val bodyStr = """{"pair_code":"$code"}"""
                    val mediaType = "application/json".toMediaType()
                    val request = okhttp3.Request.Builder()
                        .url("$httpUrl/pair/lookup")
                        .post(bodyStr.toRequestBody(mediaType))
                        .build()

                    Log.i(TAG, "Pairing code lookup: $code")
                    val response = okClient.newCall(request).execute()
                    val body = response.body?.string() ?: "{}"
                    Log.i(TAG, "Pairing code lookup response: $body")
                    json.decodeFromString<PairLookupResult>(body)
                }

                if (!lookupResult.found) {
                    _state.value = _state.value.copy(
                        isConnecting = false,
                        error = "Pairing code not found or expired.",
                    )
                    return@launch
                }

                connectViaRelay(lookupResult.deviceId, lookupResult.displayName, onConnected, pairCode = code)
            } catch (e: Exception) {
                Log.e(TAG, "Pairing code lookup failed", e)
                _state.value = _state.value.copy(
                    isConnecting = false,
                    error = "Failed to look up pairing code: ${e.message}",
                )
            }
        }
    }

    private suspend fun connectViaRelay(
        targetDeviceId: String,
        targetName: String,
        onConnected: (AgentApi) -> Unit,
        pairCode: String? = null,
    ) {
        activeRelay?.disconnect()
        activeRelay = null

        val context = getApplication<Application>()
        val identity = DeviceIdentity(context)
        val relay = RelayClient(identity, DEFAULT_RELAY_URL)
        activeRelay = relay
        relay.enableBrowseHandler()
        relay.connect()

        // Wait for relay connection (up to 90s for Render cold start)
        var connected = false
        for (i in 0 until 900) {
            if (relay.connected.value) { connected = true; break }
            withContext(Dispatchers.IO) { Thread.sleep(100) }
        }

        if (!connected) {
            relay.disconnect()
            activeRelay = null
            _state.value = _state.value.copy(
                isConnecting = false,
                error = "Could not connect to relay server.",
            )
            return
        }

        Log.i(TAG, "Relay connected, creating RelayAgentApi for $targetDeviceId")
        val relayApi = RelayAgentApi(relay, targetDeviceId)

        // The target agent may still be (re)connecting to the relay itself
        // (e.g. Render cold start). Probe until it actually answers instead of
        // dropping the user into the browser only for the first load to time out.
        val reachable = probeRelayTarget(relayApi)
        if (!reachable) {
            relay.disconnect()
            activeRelay = null
            _state.value = _state.value.copy(
                isConnecting = false,
                error = "Device isn't responding via relay. Make sure the desktop app is running, then try again.",
            )
            return
        }

        // Announce ourselves to the target so it shows an approval prompt and
        // registers this device (parity with the LAN /pair/initiate flow). Done
        // after the probe so we know our HELLO was processed and the target is
        // online to receive it.
        if (!pairCode.isNullOrBlank()) {
            sendRelayPairInitiate(relay, identity, targetDeviceId, pairCode)
        }

        deviceStore.save(SavedDevice(
            deviceId = targetDeviceId,
            host = "",
            port = 0,
            name = targetName,
        ))
        _state.value = _state.value.copy(
            isConnecting = false,
            savedDevices = deviceStore.loadAll(),
        )

        onConnected(relayApi)
    }

    private fun sendRelayPairInitiate(
        relay: RelayClient,
        identity: DeviceIdentity,
        targetDeviceId: String,
        pairCode: String,
    ) {
        val code = pairCode.replace("-", "")
        val payload = buildJsonObject {
            put("type", "pair_initiate")
            put("pair_code", code)
            put("device_id", identity.deviceId)
            put("display_name", identity.displayName)
            put("device_kind", "android")
            put("platform", "Android ${android.os.Build.VERSION.RELEASE}")
            put("version", "0.1.0")
            put("public_key", identity.publicKeyBase64)
            put("fingerprint", identity.fingerprint)
            put("address", "")
            putJsonArray("capabilities") { add("browse"); add("transfer") }
        }
        relay.sendMessage(targetDeviceId, payload, kind = "request")
        Log.i(TAG, "Sent pair_initiate via relay to $targetDeviceId")
    }

    private suspend fun probeRelayTarget(relayApi: RelayAgentApi): Boolean {
        val deadlineMs = System.currentTimeMillis() + 75_000
        var attempt = 0
        while (System.currentTimeMillis() < deadlineMs) {
            attempt++
            val reached = try {
                withTimeout(8_000) { relayApi.roots() }
                true
            } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
                false
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e // genuine coroutine cancellation — don't swallow it
            } catch (e: Exception) {
                Log.i(TAG, "Relay target not ready (attempt $attempt): ${e.message}")
                false
            }
            if (reached) {
                Log.i(TAG, "Relay target reachable after $attempt attempt(s)")
                return true
            }
            withContext(Dispatchers.IO) { Thread.sleep(1500) }
        }
        return false
    }

    fun onQrScanned(rawValue: String, onConnected: (AgentApi) -> Unit) {
        Log.i(TAG, "onQrScanned: ${rawValue.take(200)}")
        try {
            if (rawValue.contains("\"v\"") && (rawValue.contains("\"v\":2") || rawValue.contains("\"v\": 2"))) {
                val v2 = json.decodeFromString<QrPayloadV2>(rawValue)
                Log.i(TAG, "V2 QR: id=${v2.id} relay=${v2.relay} hint=${v2.hint?.lan} code=${v2.code}")
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
                Log.i(TAG, "Trying LAN hint: $host:$port")
                try {
                    val client = AgentApi.create(host, port)
                    val health = client.health()
                    Log.i(TAG, "LAN health: ${health.status}")
                    if (health.status == "ok") {
                        val pairCode = v2.code.replace("-", "")
                        val myAddress = "${getLocalIpAddress()}:${com.storageos.android.server.StorageServer.DEFAULT_PORT}"
                        try {
                            client.pairInitiate(PairInitiateV2Request(
                                pairCode = pairCode,
                                deviceId = myDeviceId,
                                displayName = android.os.Build.MODEL,
                                deviceKind = "android",
                                platform = "Android ${android.os.Build.VERSION.RELEASE}",
                                version = "0.1.0",
                                address = myAddress,
                            ))
                        } catch (_: Exception) {
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
                        deviceStore.saveRelayUrl(if (!relayFromQr.isNullOrBlank()) relayFromQr else DEFAULT_RELAY_URL)
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
            Log.i(TAG, "LAN failed, trying relay: $relayUrl")
            if (relayUrl.isNullOrBlank()) {
                _state.value = _state.value.copy(
                    isConnecting = false,
                    error = "Cannot reach device. No LAN connection and no relay available.",
                )
                return@launch
            }

            try {
                deviceStore.saveRelayUrl(relayUrl)

                val lookupResult = withContext(Dispatchers.IO) {
                    val httpUrl = relayUrl
                        .replace("ws://", "http://")
                        .replace("wss://", "https://")
                        .trimEnd('/').removeSuffix("/ws")

                    val okClient = okhttp3.OkHttpClient.Builder()
                        .connectTimeout(90, java.util.concurrent.TimeUnit.SECONDS)
                        .readTimeout(90, java.util.concurrent.TimeUnit.SECONDS)
                        .build()

                    val pairCode = v2.code.replace("-", "")
                    val bodyStr = """{"pair_code":"$pairCode"}"""
                    val mediaType = "application/json".toMediaType()

                    val lookupRequest = okhttp3.Request.Builder()
                        .url("$httpUrl/pair/lookup")
                        .post(bodyStr.toRequestBody(mediaType))
                        .build()

                    Log.i(TAG, "POST $httpUrl/pair/lookup body=$bodyStr")
                    val lookupResponse = okClient.newCall(lookupRequest).execute()
                    val lookupBody = lookupResponse.body?.string() ?: "{}"
                    Log.i(TAG, "Lookup response: code=${lookupResponse.code} body=$lookupBody")
                    json.decodeFromString<PairLookupResult>(lookupBody)
                }

                if (!lookupResult.found) {
                    _state.value = _state.value.copy(
                        isConnecting = false,
                        error = "Pairing code not found or expired.",
                    )
                    return@launch
                }

                val hintHost = v2.hint?.lan?.split(":")?.getOrNull(0) ?: ""
                val hintPort = v2.hint?.lan?.split(":")?.getOrNull(1)?.toIntOrNull() ?: 19743

                deviceStore.save(com.storageos.android.data.SavedDevice(
                    deviceId = v2.id,
                    host = hintHost,
                    port = hintPort,
                    name = v2.name,
                ))
                // Keep the "Connecting…" state until the connection actually
                // resolves — clearing it here made a Reconnect card appear
                // mid-connection instead of navigating to the drives.
                _state.value = _state.value.copy(savedDevices = deviceStore.loadAll())

                if (hintHost.isNotBlank()) {
                    try {
                        val client = withContext(Dispatchers.IO) {
                            val c = AgentApi.create(hintHost, hintPort)
                            c.health()
                            c
                        }
                        api = client
                        onConnected(client)
                        return@launch
                    } catch (_: Exception) {
                        Log.i(TAG, "LAN retry failed, connecting via relay")
                    }
                }

                connectViaRelay(v2.id, v2.name, onConnected, pairCode = v2.code)
            } catch (e: Exception) {
                Log.e(TAG, "Relay connection failed", e)
                _state.value = _state.value.copy(
                    isConnecting = false,
                    error = "Relay connection failed: ${e.message}",
                )
            }
        }
    }

    fun renameDevice(deviceId: String, newName: String) {
        val device = deviceStore.findByDeviceId(deviceId) ?: return
        deviceStore.save(device.copy(name = newName))
        _state.value = _state.value.copy(savedDevices = deviceStore.loadAll())
    }

    fun removeDevice(deviceId: String) {
        deviceStore.remove(deviceId)
        _state.value = _state.value.copy(savedDevices = deviceStore.loadAll())
    }

    fun connectToSaved(device: SavedDevice, onConnected: (AgentApi) -> Unit) {
        _state.value = _state.value.copy(
            host = device.host,
            port = device.port.toString(),
            error = null,
        )

        if (device.host.isBlank() || device.port <= 0) {
            viewModelScope.launch {
                _state.value = _state.value.copy(isConnecting = true, error = null)
                try {
                    connectViaRelay(device.deviceId, device.name, onConnected)
                } catch (e: Exception) {
                    _state.value = _state.value.copy(
                        isConnecting = false,
                        error = "Could not reconnect via relay: ${e.message}",
                    )
                }
            }
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isConnecting = true, error = null)
            try {
                val client = withContext(Dispatchers.IO) {
                    val c = AgentApi.create(device.host, device.port)
                    c.health()
                    c
                }
                api = client
                _state.value = _state.value.copy(isConnecting = false)
                deviceStore.save(device)
                _state.value = _state.value.copy(savedDevices = deviceStore.loadAll())
                onConnected(client)
            } catch (e: Exception) {
                Log.i(TAG, "LAN reconnect failed for ${device.name}, trying relay: ${e.message}")
                try {
                    connectViaRelay(device.deviceId, device.name, onConnected)
                } catch (e2: Exception) {
                    _state.value = _state.value.copy(
                        isConnecting = false,
                        error = friendlyError(e),
                    )
                }
            }
        }
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
                deviceStore.saveRelayUrl(DEFAULT_RELAY_URL)

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
