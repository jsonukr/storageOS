package com.storageos.android.ui.pair

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.storageos.android.data.DeviceIdentity
import com.storageos.android.network.RelayClient
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.Inet4Address
import java.net.NetworkInterface

enum class PairView { LOADING, PAIRING, APPROVAL, DONE }

data class PairUiState(
    val view: PairView = PairView.LOADING,
    val qrPayload: String = "",
    val pairCode: String = "",
    val pairCodeFormatted: String = "",
    val countdown: Int = 300,
    val peerName: String = "",
    val peerKind: String = "",
    val peerPlatform: String = "",
    val peerFingerprint: String = "",
    val peerDeviceId: String = "",
    val peerPublicKey: String = "",
    val friendlyName: String = "",
    val sessionId: String = "",
    val error: String? = null,
)

class PairViewModel : ViewModel() {

    private val _state = MutableStateFlow(PairUiState())
    val state: StateFlow<PairUiState> = _state.asStateFlow()

    private var identity: DeviceIdentity? = null
    private var relay: RelayClient? = null
    private var countdownJob: Job? = null
    private var pollJob: Job? = null
    private var relayUrl: String? = null

    fun init(context: Context) {
        if (identity != null) return
        val id = DeviceIdentity(context)
        identity = id

        val deviceStore = com.storageos.android.data.DeviceStore(context)
        relayUrl = deviceStore.getRelayUrl() ?: discoverRelayUrl()

        val url = relayUrl
        if (url != null) {
            relay = RelayClient(id, url).also { it.connect() }
        }

        generateSession()
        startCountdown()
        startMessagePolling()
    }

    private fun discoverRelayUrl(): String? {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val intf = interfaces.nextElement()
                if (intf.isLoopback || !intf.isUp) continue
                val addrs = intf.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        val ip = addr.hostAddress ?: continue
                        val parts = ip.split(".")
                        if (parts.size == 4) {
                            val gateway = "${parts[0]}.${parts[1]}.${parts[2]}.1"
                            return "ws://$gateway:19800/ws"
                        }
                    }
                }
            }
        } catch (_: Exception) { }
        return null
    }

    fun cleanup() {
        relay?.disconnect()
        countdownJob?.cancel()
        pollJob?.cancel()
    }

    fun refresh() {
        generateSession()
    }

    fun onFriendlyNameChanged(name: String) {
        _state.value = _state.value.copy(friendlyName = name)
    }

    fun approve(onPaired: () -> Unit) {
        val current = _state.value
        _state.value = current.copy(
            view = PairView.DONE,
            peerName = current.friendlyName.ifBlank { current.peerName },
        )
        viewModelScope.launch {
            delay(100)
            onPaired()
        }
    }

    fun reject() {
        _state.value = _state.value.copy(view = PairView.PAIRING)
        generateSession()
    }

    private fun generateSession() {
        val id = identity ?: return
        val pairCode = id.generatePairCode()
        val formatted = id.formatPairCode(pairCode)
        val lanHint = "${getLocalIpAddress()}:19743"
        val url = relayUrl
        val qrJson = id.generateQrPayload(pairCode, url, lanHint)

        relay?.registerPairCode(pairCode)

        _state.value = _state.value.copy(
            view = PairView.PAIRING,
            qrPayload = qrJson,
            pairCode = pairCode,
            pairCodeFormatted = formatted,
            countdown = 300,
            error = if (url == null) "No relay server found. Connect to a desktop agent first." else null,
        )
    }

    private fun startCountdown() {
        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            while (true) {
                delay(1000)
                val current = _state.value
                if (current.view != PairView.PAIRING) continue
                val next = current.countdown - 1
                if (next <= 0) {
                    generateSession()
                } else {
                    _state.value = current.copy(countdown = next)
                }
            }
        }
    }

    private fun startMessagePolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            val r = relay ?: return@launch
            r.messages.collect { msg ->
                val payloadType = msg.payload["type"]?.jsonPrimitive?.content ?: return@collect
                when (payloadType) {
                    "pair_initiate" -> handlePairInitiate(msg.payload)
                }
            }
        }
    }

    private fun handlePairInitiate(payload: kotlinx.serialization.json.JsonObject) {
        val name = payload["display_name"]?.jsonPrimitive?.content ?: "Unknown Device"
        val kind = payload["device_kind"]?.jsonPrimitive?.content ?: "desktop"
        val platform = payload["platform"]?.jsonPrimitive?.content ?: kind
        val fp = payload["fingerprint"]?.jsonPrimitive?.content ?: ""
        val deviceId = payload["device_id"]?.jsonPrimitive?.content ?: ""
        val pk = payload["public_key"]?.jsonPrimitive?.content ?: ""

        _state.value = _state.value.copy(
            view = PairView.APPROVAL,
            peerName = name,
            peerKind = kind,
            peerPlatform = platform,
            peerFingerprint = fp,
            peerDeviceId = deviceId,
            peerPublicKey = pk,
            friendlyName = name,
        )
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
        } catch (_: Exception) { }
        return "0.0.0.0"
    }

    override fun onCleared() {
        cleanup()
        super.onCleared()
    }
}
