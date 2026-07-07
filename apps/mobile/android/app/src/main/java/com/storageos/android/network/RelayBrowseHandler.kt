package com.storageos.android.network

import android.os.Environment
import android.os.StatFs
import android.util.Log
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File

private const val TAG = "RelayBrowseHandler"

class RelayBrowseHandler(
    private val relay: RelayClient,
    private val json: Json = Json { ignoreUnknownKeys = true; encodeDefaults = true },
) {
    fun handleMessage(msg: RelayMessage) {
        val payloadType = msg.payload["type"]?.jsonPrimitive?.content ?: return
        val requestId = msg.payload["request_id"]?.jsonPrimitive?.content ?: ""
        val source = msg.source

        Log.d(TAG, "handleMessage type=$payloadType from=$source requestId=$requestId")

        when (payloadType) {
            "roots_request" -> handleRootsRequest(source, requestId)
            "directory_request" -> handleDirectoryRequest(source, requestId, msg.payload)
            "health_request" -> handleHealthRequest(source, requestId)
            else -> Log.d(TAG, "Unknown browse request type: $payloadType")
        }
    }

    private fun handleRootsRequest(destination: String, requestId: String) {
        val roots = mutableListOf<RootData>()
        val internal = Environment.getExternalStorageDirectory()
        if (internal.exists()) {
            val stat = StatFs(internal.absolutePath)
            roots.add(RootData(
                letter = "0",
                label = "Internal Storage",
                driveType = "Fixed",
                totalBytes = stat.totalBytes,
                freeBytes = stat.availableBytes,
                usedBytes = stat.totalBytes - stat.availableBytes,
                fileSystem = "ext4",
                isRemovable = false,
                isReady = true,
            ))
        }
        val response = BrowseResponse(
            type = "roots_response",
            requestId = requestId,
            data = json.encodeToString(roots),
        )
        sendResponse(destination, response)
    }

    private fun handleDirectoryRequest(destination: String, requestId: String, payload: JsonObject) {
        val path = payload["path"]?.jsonPrimitive?.content ?: ""
        if (path.isBlank()) {
            sendErrorResponse(destination, requestId, "Missing path")
            return
        }

        val resolvedPath = resolvePath(path)
        val dir = File(resolvedPath)
        if (!dir.exists() || !dir.isDirectory) {
            sendErrorResponse(destination, requestId, "Directory not found: $path")
            return
        }

        val entries = (dir.listFiles() ?: emptyArray())
            .filter { !it.name.startsWith(".") }
            .sortedWith(compareBy<File> { !it.isDirectory }.thenBy { it.name.lowercase() })
            .map { file ->
                DirEntryData(
                    name = file.name,
                    fullPath = file.absolutePath,
                    isDirectory = file.isDirectory,
                    size = if (file.isFile) file.length() else 0,
                    lastModified = file.lastModified() / 1000,
                    dateCreated = file.lastModified() / 1000,
                    hidden = file.isHidden,
                    readonly = !file.canWrite(),
                    extension = if (file.isFile) file.extension else "",
                )
            }

        val response = BrowseResponse(
            type = "directory_response",
            requestId = requestId,
            data = json.encodeToString(entries),
        )
        sendResponse(destination, response)
    }

    private fun handleHealthRequest(destination: String, requestId: String) {
        val health = HealthData(
            status = "ok",
            version = "0.1.0",
            platform = "Android ${android.os.Build.VERSION.RELEASE}",
            deviceId = relay.deviceId,
        )
        val response = BrowseResponse(
            type = "health_response",
            requestId = requestId,
            data = json.encodeToString(health),
        )
        sendResponse(destination, response)
    }

    private fun sendResponse(destination: String, response: BrowseResponse) {
        val payloadJson = json.parseToJsonElement(json.encodeToString(response))
        relay.sendMessage(destination, payloadJson as JsonObject)
    }

    private fun sendErrorResponse(destination: String, requestId: String, message: String) {
        val response = BrowseResponse(
            type = "error_response",
            requestId = requestId,
            error = message,
        )
        sendResponse(destination, response)
    }

    private fun resolvePath(path: String): String {
        return if (path == "0:\\") {
            Environment.getExternalStorageDirectory().absolutePath
        } else {
            path.replace("0:\\", Environment.getExternalStorageDirectory().absolutePath + "/")
                .replace("\\", "/")
        }
    }
}

@Serializable
data class BrowseResponse(
    val type: String,
    @SerialName("request_id") val requestId: String,
    val data: String? = null,
    val error: String? = null,
)

@Serializable
data class RootData(
    val letter: String,
    val label: String,
    @SerialName("drive_type") val driveType: String,
    @SerialName("total_bytes") val totalBytes: Long,
    @SerialName("free_bytes") val freeBytes: Long,
    @SerialName("used_bytes") val usedBytes: Long,
    @SerialName("file_system") val fileSystem: String,
    @SerialName("is_removable") val isRemovable: Boolean,
    @SerialName("is_ready") val isReady: Boolean,
)

@Serializable
data class DirEntryData(
    val name: String,
    @SerialName("full_path") val fullPath: String,
    @SerialName("is_directory") val isDirectory: Boolean,
    val size: Long,
    @SerialName("last_modified") val lastModified: Long,
    @SerialName("date_created") val dateCreated: Long,
    val hidden: Boolean,
    val readonly: Boolean,
    val extension: String,
)

@Serializable
data class HealthData(
    val status: String,
    val version: String,
    val platform: String,
    @SerialName("device_id") val deviceId: String,
)
