package com.storageos.android.network

import com.storageos.android.data.DeviceIdentity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
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
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

private const val TAG = "RelayClient"

@Serializable
data class ProtocolVersion(
    val major: Int = 1,
    val minor: Int = 0,
)

@Serializable
data class RelayMessage(
    val version: ProtocolVersion = ProtocolVersion(),
    val id: String = java.util.UUID.randomUUID().toString(),
    @SerialName("request_id") val requestId: String? = null,
    val timestamp: Long = System.currentTimeMillis() / 1000,
    val source: String,
    val destination: String,
    val kind: String,
    val payload: JsonObject,
)

@Serializable
private data class HelloMessage(
    val version: ProtocolVersion = ProtocolVersion(),
    val id: String = java.util.UUID.randomUUID().toString(),
    val timestamp: Long = System.currentTimeMillis() / 1000,
    val source: String,
    val destination: String = "relay",
    val kind: String = "hello",
    val payload: HelloPayload,
)

@Serializable
private data class HelloPayload(
    val type: String = "hello",
    @SerialName("device_id") val deviceId: String,
    @SerialName("device_name") val deviceName: String,
    @SerialName("device_kind") val deviceKind: String = "phone",
    val platform: String = "Android ${android.os.Build.VERSION.RELEASE}",
    @SerialName("agent_version") val agentVersion: String = "0.1.0",
    @SerialName("protocol_version") val protocolVersion: ProtocolVersion = ProtocolVersion(),
    val capabilities: List<String> = listOf("browse", "transfer"),
    @SerialName("public_key") val publicKey: String,
    val fingerprint: String,
)

class RelayClient(
    private val identity: DeviceIdentity,
    private val relayUrl: String,
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    // Single-threaded so incoming browse/upload requests are handled off the
    // WebSocket reader thread (heavy file I/O) yet stay strictly in order —
    // upload chunks must be written sequentially.
    private val browseDispatcher = Executors.newSingleThreadExecutor { r ->
        Thread(r, "relay-browse-handler")
    }.asCoroutineDispatcher()
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val client = OkHttpClient.Builder()
        .connectTimeout(90, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MINUTES)
        .pingInterval(10, TimeUnit.SECONDS)
        .build()

    val deviceId: String get() = identity.deviceId

    private var ws: WebSocket? = null
    private var reconnectAttempt = 0
    private var shouldReconnect = true
    private var pendingPairCode: String? = null
    private var browseHandler: RelayBrowseHandler? = null
    private val responseHandlers = mutableListOf<(RelayMessage) -> Unit>()

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected.asStateFlow()

    private val _messages = MutableSharedFlow<RelayMessage>(extraBufferCapacity = 16)
    val messages: SharedFlow<RelayMessage> = _messages.asSharedFlow()

    fun enableBrowseHandler() {
        browseHandler = RelayBrowseHandler(this, json)
    }

    fun addResponseHandler(handler: (RelayMessage) -> Unit) {
        responseHandlers.add(handler)
    }

    fun connect() {
        Log.i(TAG, "connect() called, url=$relayUrl")
        shouldReconnect = true
        doConnect()
    }

    fun disconnect() {
        shouldReconnect = false
        ws?.close(1000, "Client disconnect")
        ws = null
        _connected.value = false
        browseDispatcher.close()
    }

    fun sendMessage(destination: String, payload: JsonObject, kind: String = "request", requestId: String? = null, messageId: String? = null) {
        val msg = json.encodeToString(RelayMessage(
            id = messageId ?: java.util.UUID.randomUUID().toString(),
            source = identity.deviceId,
            destination = destination,
            kind = kind,
            requestId = requestId,
            payload = payload,
        ))
        Log.d(TAG, "sendMessage dest=$destination kind=$kind msg=${msg.take(200)}")
        ws?.send(msg)
    }

    fun registerPairCode(pairCode: String) {
        pendingPairCode = pairCode
        if (_connected.value) {
            doRegisterPairCode(pairCode)
        } else {
            Log.i(TAG, "registerPairCode queued (WS not open yet): $pairCode")
        }
    }

    private fun doRegisterPairCode(pairCode: String) {
        val payload = json.parseToJsonElement(json.encodeToString(PairCodeRegisterPayload(
            type = "pair_code_register",
            pairCode = pairCode,
            deviceId = identity.deviceId,
            displayName = identity.displayName,
            fingerprint = identity.fingerprint,
        ))).jsonObject
        Log.i(TAG, "Sending pair_code_register for code=$pairCode")
        sendMessage("relay", payload)
    }

    private fun doConnect() {
        val url = relayUrl.trimEnd('/')
        val wsUrl = if (url.contains("/ws")) url else "$url/ws"

        val request = Request.Builder().url(wsUrl).build()
        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "WebSocket opened, sending HELLO")
                reconnectAttempt = 0
                _connected.value = true
                sendHello(webSocket)
                pendingPairCode?.let { code ->
                    Log.i(TAG, "Flushing queued pair_code_register after HELLO")
                    doRegisterPairCode(code)
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "onMessage: ${text.take(300)}")
                try {
                    val msg = json.decodeFromString<RelayMessage>(text)
                    val payloadType = msg.payload["type"]?.jsonPrimitive?.content ?: ""

                    if (payloadType.endsWith("_request") || payloadType.startsWith("upload_")) {
                        val handler = browseHandler
                        if (handler != null) {
                            scope.launch(browseDispatcher) { handler.handleMessage(msg) }
                        }
                    }

                    responseHandlers.forEach { it(msg) }

                    scope.launch { _messages.emit(msg) }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to parse relay message", e)
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.w(TAG, "WebSocket closed code=$code reason=$reason")
                _connected.value = false
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure: ${t.message}", t)
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
        val helloJson = json.encodeToString(hello)
        Log.i(TAG, "Sending HELLO: ${helloJson.take(500)}")
        webSocket.send(helloJson)
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
