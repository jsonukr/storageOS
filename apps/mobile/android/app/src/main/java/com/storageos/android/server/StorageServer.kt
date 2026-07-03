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
import java.io.FileOutputStream

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
                uri == "/mkdir" && session.method == Method.POST -> serveMkdir(session)
                uri == "/rename" && session.method == Method.POST -> serveRename(session)
                uri == "/entry" && session.method == Method.DELETE -> serveDelete(params["path"])
                uri == "/upload" && session.method == Method.POST -> serveUpload(session, params["path"])
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

        val resolvedPath = resolvePath(path)
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

    private fun readJsonBody(session: IHTTPSession): Map<String, String> {
        val contentLength = session.headers["content-length"]?.toIntOrNull() ?: 0
        val buf = ByteArray(contentLength)
        session.inputStream.read(buf, 0, contentLength)
        val bodyStr = String(buf, Charsets.UTF_8)
        return try {
            @Suppress("UNCHECKED_CAST")
            json.decodeFromString<Map<String, String>>(bodyStr)
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun resolvePath(path: String): String {
        return if (path == "0:\\") {
            Environment.getExternalStorageDirectory().absolutePath
        } else {
            path.replace("0:\\", Environment.getExternalStorageDirectory().absolutePath + "/")
                .replace("\\", "/")
        }
    }

    private fun serveMkdir(session: IHTTPSession): Response {
        val body = readJsonBody(session)
        val parent = body["parent"] ?: return newFixedLengthResponse(
            Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing parent")
        )
        val name = body["name"] ?: return newFixedLengthResponse(
            Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing name")
        )

        val resolvedParent = resolvePath(parent)
        val parentDir = File(resolvedParent)
        if (!parentDir.exists() || !parentDir.isDirectory) {
            return newFixedLengthResponse(
                Response.Status.NOT_FOUND, MIME_JSON, errorJson("NOT_FOUND", "Parent directory not found")
            )
        }

        val newDir = File(parentDir, name)
        if (newDir.exists()) {
            return newFixedLengthResponse(
                Response.Status.FORBIDDEN, MIME_JSON, errorJson("ALREADY_EXISTS", "A folder named \"$name\" already exists")
            )
        }

        return if (newDir.mkdir()) {
            val resp = json.encodeToString(OperationResp(true, newDir.absolutePath))
            newFixedLengthResponse(Response.Status.OK, MIME_JSON, resp)
        } else {
            newFixedLengthResponse(
                Response.Status.INTERNAL_ERROR, MIME_JSON, errorJson("IO_ERROR", "Failed to create folder")
            )
        }
    }

    private fun serveRename(session: IHTTPSession): Response {
        val body = readJsonBody(session)
        val path = body["path"] ?: return newFixedLengthResponse(
            Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing path")
        )
        val newName = body["new_name"] ?: return newFixedLengthResponse(
            Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing new_name")
        )

        val resolvedPath = resolvePath(path)
        val file = File(resolvedPath)
        if (!file.exists()) {
            return newFixedLengthResponse(
                Response.Status.NOT_FOUND, MIME_JSON, errorJson("NOT_FOUND", "Item not found")
            )
        }

        val dest = File(file.parentFile, newName)
        if (dest.exists()) {
            return newFixedLengthResponse(
                Response.Status.FORBIDDEN, MIME_JSON, errorJson("ALREADY_EXISTS", "\"$newName\" already exists")
            )
        }

        return if (file.renameTo(dest)) {
            val resp = json.encodeToString(OperationResp(true, dest.absolutePath))
            newFixedLengthResponse(Response.Status.OK, MIME_JSON, resp)
        } else {
            newFixedLengthResponse(
                Response.Status.INTERNAL_ERROR, MIME_JSON, errorJson("IO_ERROR", "Failed to rename")
            )
        }
    }

    private fun serveDelete(path: String?): Response {
        if (path.isNullOrBlank()) {
            return newFixedLengthResponse(
                Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing path")
            )
        }

        val resolvedPath = resolvePath(path)
        val file = File(resolvedPath)
        if (!file.exists()) {
            return newFixedLengthResponse(
                Response.Status.NOT_FOUND, MIME_JSON, errorJson("NOT_FOUND", "Item not found")
            )
        }

        val success = if (file.isDirectory) file.deleteRecursively() else file.delete()
        return if (success) {
            val resp = json.encodeToString(OperationResp(true, resolvedPath))
            newFixedLengthResponse(Response.Status.OK, MIME_JSON, resp)
        } else {
            newFixedLengthResponse(
                Response.Status.INTERNAL_ERROR, MIME_JSON, errorJson("IO_ERROR", "Failed to delete")
            )
        }
    }

    private fun serveUpload(session: IHTTPSession, destPath: String?): Response {
        if (destPath.isNullOrBlank()) {
            return newFixedLengthResponse(
                Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing path query parameter")
            )
        }

        val resolvedDest = resolvePath(destPath)
        val destDir = File(resolvedDest)
        if (!destDir.exists() || !destDir.isDirectory) {
            return newFixedLengthResponse(
                Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Destination is not a directory")
            )
        }

        val files = HashMap<String, String>()
        session.parseBody(files)

        val tmpFilePath = files["file"] ?: return newFixedLengthResponse(
            Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "No file field in upload")
        )

        @Suppress("DEPRECATION")
        val fileName = session.parms?.get("filename")
            ?: File(tmpFilePath).name

        val destFile = resolveUploadName(destDir, fileName)
        File(tmpFilePath).copyTo(destFile, overwrite = false)

        val resp = json.encodeToString(OperationResp(true, destFile.absolutePath))
        return newFixedLengthResponse(Response.Status.OK, MIME_JSON, resp)
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
private data class OperationResp(
    val success: Boolean,
    val path: String,
)

@Serializable
private data class ErrorResp(
    val code: String,
    val message: String,
)
