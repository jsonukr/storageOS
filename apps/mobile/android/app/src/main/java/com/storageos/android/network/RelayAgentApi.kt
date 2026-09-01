package com.storageos.android.network

import android.util.Base64
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
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.booleanOrNull
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
            // Check envelope-level request_id first (Desktop Agent responses),
            // then fall back to payload-level request_id (Android responses)
            val requestId = msg.requestId
                ?: msg.payload["request_id"]?.jsonPrimitive?.contentOrNull
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
                // Use requestId as the envelope message ID so Desktop Agent echoes it
                // back in the response's envelope-level request_id field
                relay.sendMessage(targetDeviceId, payload, messageId = requestId)
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
        val p = response.payload
        val dataStr = p["data"]?.jsonPrimitive?.contentOrNull
        if (dataStr != null) return json.decodeFromString(dataStr)
        return json.decodeFromString(p.toString())
    }

    override suspend fun roots(): List<DriveInfo> {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "roots_request")
            put("request_id", requestId)
        }
        val response = sendAndWait(payload)
        val p = response.payload
        val dataStr = p["data"]?.jsonPrimitive?.contentOrNull
        if (dataStr != null) return json.decodeFromString(dataStr)
        return parseRootsFromDomainPayload(p)
    }

    override suspend fun directory(path: String): List<DirectoryEntry> {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "directory_request")
            put("request_id", requestId)
            put("path", path)
        }
        val response = sendAndWait(payload)
        val p = response.payload
        val dataStr = p["data"]?.jsonPrimitive?.contentOrNull
        if (dataStr != null) return json.decodeFromString(dataStr)
        return parseEntriesFromDomainPayload(p)
    }

    override suspend fun search(path: String, query: String, recursive: Boolean): List<DirectoryEntry> {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "search_request")
            put("request_id", requestId)
            put("path", path)
            put("query", query)
            put("recursive", recursive)
        }
        val response = sendAndWait(payload)
        val p = response.payload
        val dataStr = p["data"]?.jsonPrimitive?.contentOrNull
        if (dataStr != null) return json.decodeFromString(dataStr)
        return parseEntriesFromDomainPayload(p)
    }

    override suspend fun mkdir(request: MkdirRequest): OperationResponse {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "mkdir_request")
            put("request_id", requestId)
            put("parent", request.parent)
            put("name", request.name)
        }
        val response = sendAndWait(payload)
        return parseOperationResponse(response.payload)
    }

    override suspend fun rename(request: RenameRequest): OperationResponse {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "rename_request")
            put("request_id", requestId)
            put("path", request.path)
            put("new_name", request.newName)
        }
        val response = sendAndWait(payload)
        return parseOperationResponse(response.payload)
    }

    override suspend fun deleteEntry(path: String): OperationResponse {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "delete_request")
            put("request_id", requestId)
            put("path", path)
        }
        val response = sendAndWait(payload)
        return parseOperationResponse(response.payload)
    }

    private fun parseRootsFromDomainPayload(p: JsonObject): List<DriveInfo> {
        val rootsArray = p["roots"]?.jsonArray
            ?: throw RuntimeException("No roots in response: $p")
        return rootsArray.map { elem ->
            val root = elem.jsonObject
            val metadata = root["metadata"]?.jsonObject
            val capacity = root["capacity"]?.jsonObject
            val custom = metadata?.get("custom")?.jsonObject
            DriveInfo(
                letter = custom?.get("drive_letter")?.jsonPrimitive?.contentOrNull
                    ?: root["id"]?.jsonPrimitive?.content ?: "",
                label = custom?.get("volume_label")?.jsonPrimitive?.contentOrNull
                    ?: root["name"]?.jsonPrimitive?.content ?: "",
                driveType = custom?.get("windows_drive_type")?.jsonPrimitive?.contentOrNull
                    ?: root["kind"]?.jsonPrimitive?.content ?: "unknown",
                totalBytes = capacity?.get("total_bytes")?.jsonPrimitive?.longOrNull ?: 0L,
                freeBytes = capacity?.get("free_bytes")?.jsonPrimitive?.longOrNull ?: 0L,
                usedBytes = capacity?.get("used_bytes")?.jsonPrimitive?.longOrNull ?: 0L,
                fileSystem = metadata?.get("file_system")?.jsonPrimitive?.contentOrNull ?: "",
                isRemovable = metadata?.get("is_removable")?.jsonPrimitive?.booleanOrNull ?: false,
                isReady = metadata?.get("is_ready")?.jsonPrimitive?.booleanOrNull ?: false,
            )
        }
    }

    private fun parseEntriesFromDomainPayload(p: JsonObject): List<DirectoryEntry> {
        val entriesArray = p["entries"]?.jsonArray
            ?: throw RuntimeException("No entries in response: $p")
        return entriesArray.map { elem ->
            val entry = elem.jsonObject
            val metadata = entry["metadata"]?.jsonObject
            DirectoryEntry(
                name = entry["name"]?.jsonPrimitive?.content ?: "",
                fullPath = entry["path"]?.jsonPrimitive?.content ?: "",
                isDirectory = entry["kind"]?.jsonPrimitive?.content == "folder",
                size = entry["size"]?.jsonPrimitive?.longOrNull ?: 0L,
                lastModified = entry["modified_at"]?.jsonPrimitive?.longOrNull ?: 0L,
                dateCreated = entry["created_at"]?.jsonPrimitive?.longOrNull ?: 0L,
                hidden = metadata?.get("hidden")?.jsonPrimitive?.booleanOrNull ?: false,
                readonly = metadata?.get("readonly")?.jsonPrimitive?.booleanOrNull ?: false,
                extension = metadata?.get("extension")?.jsonPrimitive?.contentOrNull ?: "",
            )
        }
    }

    private fun parseOperationResponse(p: JsonObject): OperationResponse {
        val dataStr = p["data"]?.jsonPrimitive?.contentOrNull
        if (dataStr != null) return json.decodeFromString(dataStr)
        return OperationResponse(
            success = p["success"]?.jsonPrimitive?.booleanOrNull ?: false,
            path = p["path"]?.jsonPrimitive?.contentOrNull ?: "",
        )
    }

    suspend fun uploadFile(
        destDir: String,
        fileName: String,
        fileBytes: ByteArray,
        onProgress: ((Long, Long) -> Unit)? = null,
    ): OperationResponse {
        val transferId = UUID.randomUUID().toString()
        val totalBytes = fileBytes.size.toLong()

        val startPayload = buildJsonObject {
            put("type", "upload_start")
            put("request_id", UUID.randomUUID().toString())
            put("transfer_id", transferId)
            put("path", destDir)
            put("file_name", fileName)
            put("total_bytes", totalBytes)
        }
        val startResp = sendAndWait(startPayload)
        val respType = startResp.payload["type"]?.jsonPrimitive?.contentOrNull
        if (respType != "upload_ready") {
            throw RuntimeException("Device not ready for upload: $respType")
        }

        val chunkSize = 256 * 1024
        var offset = 0L
        while (offset < totalBytes) {
            val end = minOf(offset + chunkSize, totalBytes).toInt()
            val chunk = fileBytes.copyOfRange(offset.toInt(), end)
            val isLast = end.toLong() >= totalBytes
            val dataPayload = buildJsonObject {
                put("type", "upload_data")
                put("transfer_id", transferId)
                put("offset", offset)
                put("data", Base64.encodeToString(chunk, Base64.NO_WRAP))
                put("is_last", isLast)
            }
            relay.sendMessage(targetDeviceId, dataPayload, kind = "transfer")
            offset = end.toLong()
            onProgress?.invoke(offset, totalBytes)
        }

        val completePayload = buildJsonObject {
            put("type", "upload_complete")
            put("request_id", UUID.randomUUID().toString())
            put("transfer_id", transferId)
            put("path", destDir)
        }
        val completeResp = sendAndWait(completePayload)
        return parseOperationResponse(completeResp.payload)
    }

    /**
     * Fetch a file's full bytes over the relay (used for image previews, since
     * relay connections have no HTTP endpoint to load from). The desktop agent
     * returns the whole file as a single base64 download_data response.
     */
    suspend fun downloadBytes(path: String): ByteArray {
        val requestId = UUID.randomUUID().toString()
        val payload = buildJsonObject {
            put("type", "download_request")
            put("request_id", requestId)
            put("transfer_id", UUID.randomUUID().toString())
            put("path", path)
        }
        val response = sendAndWait(payload)
        val dataB64 = response.payload["data"]?.jsonPrimitive?.contentOrNull
            ?: throw RuntimeException("No data in download response")
        return Base64.decode(dataB64, Base64.DEFAULT)
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
