package com.storageos.android.network

import android.os.Environment
import android.os.StatFs
import android.util.Base64
import android.util.Log
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.long
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import kotlinx.serialization.json.addJsonObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap

private const val TAG = "RelayBrowseHandler"

data class UploadContext(
    val tempFile: File,
    val outputStream: FileOutputStream,
    val destDir: String,
    val fileName: String,
)

class RelayBrowseHandler(
    private val relay: RelayClient,
    private val json: Json = Json { ignoreUnknownKeys = true; encodeDefaults = true },
) {
    private val activeUploads = ConcurrentHashMap<String, UploadContext>()

    fun handleMessage(msg: RelayMessage) {
        val payloadType = msg.payload["type"]?.jsonPrimitive?.content ?: return
        val source = msg.source
        val originalRequestId = msg.id

        Log.d(TAG, "handleMessage type=$payloadType from=$source requestId=$originalRequestId")

        when (payloadType) {
            "roots_request" -> handleRootsRequest(source, originalRequestId)
            "directory_request" -> handleDirectoryRequest(source, originalRequestId, msg.payload)
            "health_request" -> handleHealthRequest(source, originalRequestId)
            "mkdir_request", "create_folder_request" -> handleMkdirRequest(source, originalRequestId, msg.payload)
            "rename_request" -> handleRenameRequest(source, originalRequestId, msg.payload)
            "delete_request" -> handleDeleteRequest(source, originalRequestId, msg.payload)
            "upload_start" -> handleUploadStart(source, originalRequestId, msg.payload)
            "upload_data" -> handleUploadData(source, msg.payload)
            "upload_complete" -> handleUploadComplete(source, originalRequestId, msg.payload)
            else -> Log.d(TAG, "Unknown browse request type: $payloadType")
        }
    }

    private fun handleRootsRequest(destination: String, requestId: String) {
        val roots = mutableListOf<JsonObject>()
        val internal = Environment.getExternalStorageDirectory()
        if (internal.exists()) {
            val stat = StatFs(internal.absolutePath)
            roots.add(buildJsonObject {
                put("letter", "0")
                put("label", "Internal Storage")
                put("drive_type", "Fixed")
                put("total_bytes", stat.totalBytes)
                put("free_bytes", stat.availableBytes)
                put("used_bytes", stat.totalBytes - stat.availableBytes)
                put("file_system", "ext4")
                put("is_removable", false)
                put("is_ready", true)
            })
        }
        val payload = buildJsonObject {
            put("type", "roots_response")
            put("request_id", requestId)
            put("data", json.encodeToString(kotlinx.serialization.builtins.ListSerializer(JsonObject.serializer()), roots))
        }
        sendResponse(destination, requestId, payload)
    }

    private fun handleDirectoryRequest(destination: String, requestId: String, reqPayload: JsonObject) {
        val path = reqPayload["path"]?.jsonPrimitive?.content ?: ""
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
                buildJsonObject {
                    put("name", file.name)
                    put("full_path", file.absolutePath)
                    put("is_directory", file.isDirectory)
                    put("size", if (file.isFile) file.length() else 0L)
                    put("last_modified", file.lastModified() / 1000)
                    put("date_created", file.lastModified() / 1000)
                    put("hidden", file.isHidden)
                    put("readonly", !file.canWrite())
                    put("extension", if (file.isFile) file.extension else "")
                }
            }

        val payload = buildJsonObject {
            put("type", "directory_response")
            put("request_id", requestId)
            put("data", json.encodeToString(kotlinx.serialization.builtins.ListSerializer(JsonObject.serializer()), entries))
        }
        sendResponse(destination, requestId, payload)
    }

    private fun handleHealthRequest(destination: String, requestId: String) {
        val healthJson = buildJsonObject {
            put("status", "ok")
            put("version", "0.1.0")
            put("platform", "Android ${android.os.Build.VERSION.RELEASE}")
            put("device_id", relay.deviceId)
        }
        val payload = buildJsonObject {
            put("type", "health_response")
            put("request_id", requestId)
            put("data", json.encodeToString(JsonObject.serializer(), healthJson))
        }
        sendResponse(destination, requestId, payload)
    }

    private fun handleMkdirRequest(destination: String, requestId: String, reqPayload: JsonObject) {
        val parent = reqPayload["parent"]?.jsonPrimitive?.content ?: ""
        val name = reqPayload["name"]?.jsonPrimitive?.content ?: ""
        if (parent.isBlank() || name.isBlank()) {
            sendErrorResponse(destination, requestId, "Missing parent or name")
            return
        }

        val resolvedParent = resolvePath(parent)
        val parentDir = File(resolvedParent)
        if (!parentDir.exists() || !parentDir.isDirectory) {
            sendErrorResponse(destination, requestId, "Parent directory not found")
            return
        }

        val newDir = File(parentDir, name)
        if (newDir.exists()) {
            sendErrorResponse(destination, requestId, "Folder already exists")
            return
        }

        if (newDir.mkdir()) {
            sendOperationResponse(destination, requestId, true, newDir.absolutePath)
        } else {
            sendErrorResponse(destination, requestId, "Failed to create folder")
        }
    }

    private fun handleRenameRequest(destination: String, requestId: String, reqPayload: JsonObject) {
        val path = reqPayload["path"]?.jsonPrimitive?.content ?: ""
        val newName = reqPayload["new_name"]?.jsonPrimitive?.content ?: ""
        if (path.isBlank() || newName.isBlank()) {
            sendErrorResponse(destination, requestId, "Missing path or new_name")
            return
        }

        val resolvedPath = resolvePath(path)
        val file = File(resolvedPath)
        if (!file.exists()) {
            sendErrorResponse(destination, requestId, "Item not found")
            return
        }

        val dest = File(file.parentFile, newName)
        if (dest.exists()) {
            sendErrorResponse(destination, requestId, "\"$newName\" already exists")
            return
        }

        if (file.renameTo(dest)) {
            sendOperationResponse(destination, requestId, true, dest.absolutePath)
        } else {
            sendErrorResponse(destination, requestId, "Failed to rename")
        }
    }

    private fun handleDeleteRequest(destination: String, requestId: String, reqPayload: JsonObject) {
        val path = reqPayload["path"]?.jsonPrimitive?.content ?: ""
        if (path.isBlank()) {
            sendErrorResponse(destination, requestId, "Missing path")
            return
        }

        val resolvedPath = resolvePath(path)
        val file = File(resolvedPath)
        if (!file.exists()) {
            sendErrorResponse(destination, requestId, "Item not found")
            return
        }

        val success = if (file.isDirectory) file.deleteRecursively() else file.delete()
        if (success) {
            sendOperationResponse(destination, requestId, true, resolvedPath)
        } else {
            sendErrorResponse(destination, requestId, "Failed to delete")
        }
    }

    private fun handleUploadStart(destination: String, requestId: String, reqPayload: JsonObject) {
        val transferId = reqPayload["transfer_id"]?.jsonPrimitive?.content ?: ""
        val path = reqPayload["path"]?.jsonPrimitive?.content ?: ""
        val fileName = reqPayload["file_name"]?.jsonPrimitive?.content ?: ""
        val totalBytes = reqPayload["total_bytes"]?.jsonPrimitive?.long ?: 0L

        Log.i(TAG, "upload_start transferId=$transferId path=$path fileName=$fileName totalBytes=$totalBytes")

        if (transferId.isBlank() || path.isBlank() || fileName.isBlank()) {
            sendErrorResponse(destination, requestId, "Missing transfer_id, path, or file_name")
            return
        }

        val resolvedPath = resolvePath(path)
        val destDir = File(resolvedPath)
        if (!destDir.exists() || !destDir.isDirectory) {
            sendErrorResponse(destination, requestId, "Destination directory not found: $path")
            return
        }

        try {
            val tempFile = File.createTempFile("relay-upload-", ".tmp", destDir)
            val outputStream = FileOutputStream(tempFile)
            activeUploads[transferId] = UploadContext(tempFile, outputStream, resolvedPath, fileName)

            val payload = buildJsonObject {
                put("type", "upload_ready")
                put("transfer_id", transferId)
            }
            sendResponse(destination, requestId, payload)
            Log.i(TAG, "upload_ready sent for transferId=$transferId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create temp file for upload", e)
            sendErrorResponse(destination, requestId, "Failed to prepare upload: ${e.message}")
        }
    }

    private fun handleUploadData(source: String, reqPayload: JsonObject) {
        val transferId = reqPayload["transfer_id"]?.jsonPrimitive?.content ?: return
        val dataBase64 = reqPayload["data"]?.jsonPrimitive?.content ?: return
        val offset = reqPayload["offset"]?.jsonPrimitive?.long ?: 0L
        val isLast = reqPayload["is_last"]?.jsonPrimitive?.boolean ?: false

        val ctx = activeUploads[transferId] ?: run {
            Log.w(TAG, "upload_data for unknown transferId=$transferId")
            return
        }

        try {
            val decoded = Base64.decode(dataBase64, Base64.DEFAULT)
            ctx.outputStream.write(decoded)
            Log.d(TAG, "upload_data transferId=$transferId offset=$offset bytes=${decoded.size} isLast=$isLast")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to write upload data", e)
            ctx.outputStream.close()
            ctx.tempFile.delete()
            activeUploads.remove(transferId)
        }
    }

    private fun handleUploadComplete(destination: String, requestId: String, reqPayload: JsonObject) {
        val transferId = reqPayload["transfer_id"]?.jsonPrimitive?.content ?: ""
        val path = reqPayload["path"]?.jsonPrimitive?.content ?: ""

        Log.i(TAG, "upload_complete transferId=$transferId path=$path")

        val ctx = activeUploads.remove(transferId)
        if (ctx == null) {
            sendErrorResponse(destination, requestId, "Unknown transfer: $transferId")
            return
        }

        try {
            ctx.outputStream.flush()
            ctx.outputStream.close()

            val destDir = File(ctx.destDir)
            val destFile = resolveUploadName(destDir, ctx.fileName)
            ctx.tempFile.renameTo(destFile)

            Log.i(TAG, "Upload complete: ${destFile.absolutePath}")
            sendOperationResponse(destination, requestId, true, destFile.absolutePath)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to finalize upload", e)
            ctx.tempFile.delete()
            sendErrorResponse(destination, requestId, "Failed to complete upload: ${e.message}")
        }
    }

    private fun resolveUploadName(dir: File, name: String): File {
        val candidate = File(dir, name)
        if (!candidate.exists()) return candidate
        val dotIdx = name.lastIndexOf('.')
        val stem = if (dotIdx > 0) name.substring(0, dotIdx) else name
        val ext = if (dotIdx > 0) name.substring(dotIdx) else ""
        var counter = 1
        while (true) {
            val newFile = File(dir, "$stem ($counter)$ext")
            if (!newFile.exists()) return newFile
            counter++
        }
    }

    private fun sendResponse(destination: String, requestId: String, payload: JsonObject) {
        relay.sendMessage(destination, payload, kind = "response", requestId = requestId)
    }

    private fun sendOperationResponse(destination: String, requestId: String, success: Boolean, path: String) {
        val payload = buildJsonObject {
            put("type", "operation_response")
            put("success", success)
            put("path", path)
        }
        sendResponse(destination, requestId, payload)
    }

    private fun sendErrorResponse(destination: String, requestId: String, message: String) {
        val payload = buildJsonObject {
            put("type", "error_response")
            put("request_id", requestId)
            put("error", message)
        }
        sendResponse(destination, requestId, payload)
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
