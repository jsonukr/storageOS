package com.storageos.android.network

import com.storageos.android.data.DeviceIdentity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

@Serializable
data class RelayMessage(
    val source: String,
    val destination: String,
    val kind: String,
    val version: String = "1.0.0",
    val payload: JsonObject,
)

@Serializable
private data class HelloMessage(
    val source: String,
    val destination: String = "relay",
    val kind: String = "hello",
    val version: String = "1.0.0",
    val payload: HelloPayload,
)

@Serializable
private data class HelloPayload(
    val type: String = "hello",
    @SerialName("device_id") val deviceId: String,
    @SerialName("device_name") val deviceName: String,
    @SerialName("public_key") val publicKey: String,
    val fingerprint: String,
    val capabilities: List<String> = listOf("browse", "transfer"),
)

class RelayClient(
    private val identity: DeviceIdentity,
    private val relayUrl: String,
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val client = OkHttpClient.Builder()
        .connectTimeout(90, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MINUTES)
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private var ws: WebSocket? = null
    private var reconnectAttempt = 0
    private var shouldReconnect = true

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected.asStateFlow()

    private val _messages = MutableSharedFlow<RelayMessage>(extraBufferCapacity = 16)
    val messages: SharedFlow<RelayMessage> = _messages.asSharedFlow()

    fun connect() {
        shouldReconnect = true
        doConnect()
    }

    fun disconnect() {
        shouldReconnect = false
        ws?.close(1000, "Client disconnect")
        ws = null
        _connected.value = false
    }

    fun sendMessage(destination: String, payload: JsonObject) {
        val msg = json.encodeToString(RelayMessage(
            source = identity.deviceId,
            destination = destination,
            kind = "request",
            payload = payload,
        ))
        ws?.send(msg)
    }

    fun registerPairCode(pairCode: String) {
        val payload = json.parseToJsonElement(json.encodeToString(PairCodeRegisterPayload(
            type = "pair_code_register",
            pairCode = pairCode,
            deviceId = identity.deviceId,
            displayName = identity.displayName,
            fingerprint = identity.fingerprint,
        ))).jsonObject
        sendMessage("relay", payload)
    }

    private fun doConnect() {
        val url = relayUrl.trimEnd('/')
        val wsUrl = if (url.contains("/ws")) url else "$url/ws"

        val request = Request.Builder().url(wsUrl).build()
        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                reconnectAttempt = 0
                _connected.value = true
                sendHello(webSocket)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = json.decodeFromString<RelayMessage>(text)
                    scope.launch { _messages.emit(msg) }
                } catch (_: Exception) { }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _connected.value = false
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _connected.value = false
                scheduleReconnect()
            }
        })
    }

    private fun sendHello(webSocket: WebSocket) {
        val hello = HelloMessage(
            source = identity.deviceId,
            payload = HelloPayload(
                deviceId = identity.deviceId,
                deviceName = identity.displayName,
                publicKey = identity.publicKeyBase64,
                fingerprint = identity.fingerprint,
            ),
        )
        webSocket.send(json.encodeToString(hello))
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect) return
        reconnectAttempt++
        val delay = minOf(30_000L, 1000L * (1L shl minOf(reconnectAttempt, 5)))
        scope.launch {
            delay(delay)
            if (shouldReconnect) doConnect()
        }
    }
}

@Serializable
private data class PairCodeRegisterPayload(
    val type: String,
    @SerialName("pair_code") val pairCode: String,
    @SerialName("device_id") val deviceId: String,
    @SerialName("display_name") val displayName: String,
    val fingerprint: String,
    @SerialName("ttl_secs") val ttlSecs: Int = 300,
)
