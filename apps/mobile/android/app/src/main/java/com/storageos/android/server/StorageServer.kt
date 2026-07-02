package com.storageos.android.server

import android.os.Build
import android.os.Environment
import android.os.StatFs
import fi.iki.elonen.NanoHTTPD
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileInputStream

class StorageServer(
    private val deviceId: String,
    port: Int = DEFAULT_PORT,
) : NanoHTTPD("0.0.0.0", port) {

    private val json = Json { encodeDefaults = true }
    private val startTime = System.currentTimeMillis()

    override fun serve(session: IHTTPSession): Response {
        if (session.method == Method.OPTIONS) {
            return newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, "").withCors()
        }

        val uri = session.uri
        @Suppress("DEPRECATION")
        val params = session.parms ?: emptyMap()

        return try {
            when {
                uri == "/health" -> serveHealth()
                uri == "/presence" -> servePresence()
                uri == "/roots" -> serveRoots()
                uri == "/directory" -> serveDirectory(params["path"])
                uri == "/download" -> serveDownload(params["path"])
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_JSON, errorJson("NOT_FOUND", "Unknown endpoint"))
            }.withCors()
        } catch (e: Exception) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_JSON, errorJson("INTERNAL", e.message ?: "Unknown error")).withCors()
        }
    }

    private fun Response.withCors(): Response {
        addHeader("Access-Control-Allow-Origin", "*")
        addHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
        addHeader("Access-Control-Allow-Headers", "Content-Type")
        return this
    }

    private fun serveHealth(): Response {
        val uptime = (System.currentTimeMillis() - startTime) / 1000
        val body = json.encodeToString(HealthResp(
            status = "ok",
            uptimeSecs = uptime,
            version = "0.1.0",
            platform = "Android ${Build.VERSION.RELEASE}",
            deviceId = deviceId,
        ))
        return newFixedLengthResponse(Response.Status.OK, MIME_JSON, body)
    }

    private fun servePresence(): Response {
        val uptime = (System.currentTimeMillis() - startTime) / 1000
        val body = json.encodeToString(PresenceResp(
            deviceId = deviceId,
            systemName = Build.MODEL,
            status = "online",
            address = "",
            version = "0.1.0",
            platform = "Android ${Build.VERSION.RELEASE}",
            capabilities = "{}",
            uptimeSecs = uptime,
            timestamp = System.currentTimeMillis() / 1000,
        ))
        return newFixedLengthResponse(Response.Status.OK, MIME_JSON, body)
    }

    private fun serveRoots(): Response {
        val roots = mutableListOf<RootInfo>()

        val internal = Environment.getExternalStorageDirectory()
        if (internal.exists()) {
            val stat = StatFs(internal.absolutePath)
            val total = stat.totalBytes
            val free = stat.availableBytes
            roots.add(RootInfo(
                letter = "0",
                label = "Internal Storage",
                driveType = "Fixed",
                totalBytes = total,
                freeBytes = free,
                usedBytes = total - free,
                fileSystem = "ext4",
                isRemovable = false,
                isReady = true,
            ))
        }

        val body = json.encodeToString(roots)
        return newFixedLengthResponse(Response.Status.OK, MIME_JSON, body)
    }

    private fun serveDirectory(path: String?): Response {
        if (path.isNullOrBlank()) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing path parameter"))
        }

        val resolvedPath = if (path == "0:\\") {
            Environment.getExternalStorageDirectory().absolutePath
        } else {
            path.replace("0:\\", Environment.getExternalStorageDirectory().absolutePath + "/")
                .replace("\\", "/")
        }

        val dir = File(resolvedPath)
        if (!dir.exists()) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_JSON, errorJson("NOT_FOUND", "Directory not found"))
        }
        if (!dir.isDirectory) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Path is not a directory"))
        }

        val entries = (dir.listFiles() ?: emptyArray())
            .filter { !it.name.startsWith(".") }
            .sortedWith(compareBy<File> { !it.isDirectory }.thenBy { it.name.lowercase() })
            .map { file ->
                DirEntry(
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

        val body = json.encodeToString(entries)
        return newFixedLengthResponse(Response.Status.OK, MIME_JSON, body)
    }

    private fun serveDownload(path: String?): Response {
        if (path.isNullOrBlank()) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing path parameter"))
        }

        val file = File(path)
        if (!file.exists() || !file.isFile) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_JSON, errorJson("NOT_FOUND", "File not found"))
        }

        val mime = getMimeType(file.name) ?: "application/octet-stream"
        val fis = FileInputStream(file)
        val response = newFixedLengthResponse(Response.Status.OK, mime, fis, file.length())
        response.addHeader("Content-Disposition", "attachment; filename=\"${file.name}\"")
        return response
    }

    private fun getMimeType(fileName: String): String? {
        val ext = fileName.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "mp4" -> "video/mp4"
            "mp3" -> "audio/mpeg"
            "pdf" -> "application/pdf"
            "txt" -> "text/plain"
            "json" -> "application/json"
            "zip" -> "application/zip"
            else -> null
        }
    }

    private fun errorJson(code: String, message: String): String {
        return json.encodeToString(ErrorResp(code, message))
    }

    companion object {
        const val DEFAULT_PORT = 19743
        private const val MIME_JSON = "application/json"
    }
}

@Serializable
private data class HealthResp(
    val status: String,
    @SerialName("uptime_secs") val uptimeSecs: Long,
    val version: String,
    val platform: String,
    @SerialName("device_id") val deviceId: String,
)

@Serializable
private data class PresenceResp(
    @SerialName("device_id") val deviceId: String,
    @SerialName("system_name") val systemName: String,
    val status: String,
    val address: String,
    val version: String,
    val platform: String,
    val capabilities: String,
    @SerialName("uptime_secs") val uptimeSecs: Long,
    val timestamp: Long,
)

@Serializable
private data class RootInfo(
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
private data class DirEntry(
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
private data class ErrorResp(
    val code: String,
    val message: String,
)
