package com.storageos.android.network

import android.util.Log
import com.storageos.android.api.AgentApi
import com.storageos.android.api.DirectoryEntry
import com.storageos.android.api.DriveInfo
import com.storageos.android.api.HealthResponse
import com.storageos.android.api.MkdirRequest
import com.storageos.android.api.OperationResponse
import com.storageos.android.api.PairDeviceRequest
import com.storageos.android.api.PairDeviceResponse
import com.storageos.android.api.PairInitiateV2Request
import com.storageos.android.api.PairSessionStatus
import com.storageos.android.api.RenameRequest
import com.storageos.android.ui.devices.DeviceRecord
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val TAG = "RelayAgentApi"
private const val REQUEST_TIMEOUT_MS = 30_000L

class RelayAgentApi(
    private val relay: RelayClient,
    private val targetDeviceId: String,
) : AgentApi {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val pendingRequests = ConcurrentHashMap<String, (RelayMessage) -> Unit>()

    init {
        relay.addResponseHandler { msg ->
            val requestId = msg.payload["request_id"]?.jsonPrimitive?.content
            if (requestId != null) {
                pendingRequests.remove(requestId)?.invoke(msg)
            }
        }
    }

    private suspend fun sendAndWait(payload: JsonObject): RelayMessage {
        val requestId = payload["request_id"]?.jsonPrimitive?.content
            ?: throw IllegalArgumentException("Payload must contain request_id")

        return withTimeout(REQUEST_TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                pendingRequests[requestId] = { msg ->
                    val error = msg.payload["error"]?.jsonPrimitive?.contentOrNull
                    if (!error.isNullOrEmpty()) {
                        cont.resumeWithException(RuntimeException("Remote error: $error"))
                    } else {
                        cont.resume(msg)
                    }
                }
                cont.invokeOnCancellation { pendingRequests.remove(requestId) }
                relay.sendMessage(targetDeviceId, payload)
            }
        }
    }

    override suspend fun health(): HealthResponse {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "health_request")
            put("request_id", requestId)
        }
        val response = sendAndWait(payload)
        val data = response.payload["data"]?.jsonPrimitive?.contentOrNull
            ?: throw RuntimeException("No data in health response")
        return json.decodeFromString(data)
    }

    override suspend fun roots(): List<DriveInfo> {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "roots_request")
            put("request_id", requestId)
        }
        val response = sendAndWait(payload)
        val data = response.payload["data"]?.jsonPrimitive?.contentOrNull
            ?: throw RuntimeException("No data in roots response")
        return json.decodeFromString(data)
    }

    override suspend fun directory(path: String): List<DirectoryEntry> {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "directory_request")
            put("request_id", requestId)
            put("path", path)
        }
        val response = sendAndWait(payload)
        val data = response.payload["data"]?.jsonPrimitive?.contentOrNull
            ?: throw RuntimeException("No data in directory response")
        return json.decodeFromString(data)
    }

    override suspend fun mkdir(request: MkdirRequest): OperationResponse {
        Log.w(TAG, "mkdir not supported via relay yet")
        throw UnsupportedOperationException("mkdir not supported via relay")
    }

    override suspend fun rename(request: RenameRequest): OperationResponse {
        Log.w(TAG, "rename not supported via relay yet")
        throw UnsupportedOperationException("rename not supported via relay")
    }

    override suspend fun deleteEntry(path: String): OperationResponse {
        Log.w(TAG, "delete not supported via relay yet")
        throw UnsupportedOperationException("delete not supported via relay")
    }

    override suspend fun pairDevice(request: PairDeviceRequest): PairDeviceResponse {
        throw UnsupportedOperationException("pairDevice not applicable via relay")
    }

    override suspend fun pairInitiate(request: PairInitiateV2Request): PairSessionStatus {
        throw UnsupportedOperationException("pairInitiate not applicable via relay")
    }

    override suspend fun listDevices(): List<DeviceRecord> {
        return emptyList()
    }
}
