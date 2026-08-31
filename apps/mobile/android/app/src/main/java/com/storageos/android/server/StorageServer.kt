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
    private val identityProvider: (() -> DeviceIdentityInfo)? = null,
    private val cacheDir: File? = null,
) : NanoHTTPD("0.0.0.0", port) {

    private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
    private val startTime = System.currentTimeMillis()

    init {
        val tmpDir = cacheDir ?: File(System.getProperty("java.io.tmpdir") ?: "/tmp")
        if (!tmpDir.exists()) tmpDir.mkdirs()
        setTempFileManagerFactory { DefaultTempFileManagerWithDir(tmpDir) }
    }

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
                uri == "/pair" && session.method == Method.GET -> servePairInfo()
                uri == "/pair/qr" && session.method == Method.GET -> servePairQr()
                uri == "/roots" -> serveRoots()
                uri == "/directory" -> serveDirectory(params["path"])
                uri == "/download" -> serveDownload(session, params["path"])
                uri == "/mkdir" && session.method == Method.POST -> serveMkdir(session)
                uri == "/rename" && session.method == Method.POST -> serveRename(session)
                uri == "/entry" && session.method == Method.DELETE -> serveDelete(params["path"])
                uri == "/upload" && session.method == Method.POST -> serveUpload(session, params["path"])
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_JSON, errorJson("NOT_FOUND", "Unknown endpoint"))
            }.withCors()
        } catch (e: Exception) {
            android.util.Log.e("StorageServer", "Error handling $uri: ${e.message}", e)
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_JSON, errorJson("INTERNAL", e.message ?: "Unknown error")).withCors()
        }
    }

    private fun Response.withCors(): Response {
        addHeader("Access-Control-Allow-Origin", "*")
        addHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        addHeader("Access-Control-Allow-Headers", "Content-Type, Range")
        addHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Disposition")
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

    private fun serveDownload(session: IHTTPSession, path: String?): Response {
        if (path.isNullOrBlank()) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing path parameter"))
        }

        val file = File(path)
        if (!file.exists() || !file.isFile) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_JSON, errorJson("NOT_FOUND", "File not found"))
        }

        val mime = getMimeType(file.name) ?: "application/octet-stream"
        val fileLen = file.length()

        // Range request: stream only the requested byte window so media players
        // can seek without downloading the whole file (mirrors the desktop agent).
        val rangeHeader = session.headers["range"]
        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            val range = parseByteRange(rangeHeader, fileLen)
            if (range == null) {
                val resp = newFixedLengthResponse(Response.Status.RANGE_NOT_SATISFIABLE, MIME_PLAINTEXT, "")
                resp.addHeader("Content-Range", "bytes */$fileLen")
                resp.addHeader("Accept-Ranges", "bytes")
                return resp
            }
            val (start, end) = range
            val length = end - start + 1
            val fis = FileInputStream(file)
            fis.channel.position(start)
            val resp = newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, mime, fis, length)
            resp.addHeader("Content-Range", "bytes $start-$end/$fileLen")
            resp.addHeader("Accept-Ranges", "bytes")
            resp.addHeader("Content-Disposition", "inline; filename=\"${file.name}\"")
            return resp
        }

        val fis = FileInputStream(file)
        val response = newFixedLengthResponse(Response.Status.OK, mime, fis, fileLen)
        response.addHeader("Accept-Ranges", "bytes")
        response.addHeader("Content-Disposition", "attachment; filename=\"${file.name}\"")
        return response
    }

    /** Parse an HTTP `Range: bytes=...` header against a file length; null if unsatisfiable. */
    private fun parseByteRange(value: String, fileLen: Long): Pair<Long, Long>? {
        if (fileLen == 0L) return null
        val spec = value.removePrefix("bytes=").split(",").firstOrNull()?.trim() ?: return null
        val dash = spec.indexOf('-')
        if (dash < 0) return null
        val startS = spec.substring(0, dash)
        val endS = spec.substring(dash + 1)
        if (startS.isEmpty()) {
            // Suffix range: last N bytes
            val n = endS.toLongOrNull() ?: return null
            if (n <= 0) return null
            return Pair((fileLen - n).coerceAtLeast(0), fileLen - 1)
        }
        val start = startS.toLongOrNull() ?: return null
        val end = if (endS.isEmpty()) fileLen - 1 else (endS.toLongOrNull() ?: return null).coerceAtMost(fileLen - 1)
        if (start > end || start >= fileLen) return null
        return Pair(start, end)
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
        android.util.Log.i("StorageServer", "serveUpload destPath=$destPath")
        if (destPath.isNullOrBlank()) {
            return newFixedLengthResponse(
                Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Missing path query parameter")
            )
        }

        val resolvedDest = resolvePath(destPath)
        val destDir = File(resolvedDest)
        android.util.Log.i("StorageServer", "resolvedDest=$resolvedDest exists=${destDir.exists()} isDir=${destDir.isDirectory}")
        if (!destDir.exists() || !destDir.isDirectory) {
            return newFixedLengthResponse(
                Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "Destination is not a directory: $resolvedDest")
            )
        }

        val files = HashMap<String, String>()
        try {
            session.parseBody(files)
        } catch (e: Exception) {
            android.util.Log.e("StorageServer", "parseBody failed: ${e.message}", e)
            return newFixedLengthResponse(
                Response.Status.INTERNAL_ERROR, MIME_JSON, errorJson("PARSE_ERROR", "Failed to parse upload body: ${e.message}")
            )
        }
        android.util.Log.i("StorageServer", "parseBody files=$files")

        val tmpFilePath = files["file"] ?: return newFixedLengthResponse(
            Response.Status.BAD_REQUEST, MIME_JSON, errorJson("INVALID_ARGUMENT", "No file field in upload")
        )

        @Suppress("DEPRECATION")
        val fileName = session.parms?.get("filename")
            ?: File(tmpFilePath).name

        val destFile = resolveUploadName(destDir, fileName)
        android.util.Log.i("StorageServer", "Copying $tmpFilePath -> ${destFile.absolutePath}")
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

    private fun servePairInfo(): Response {
        val provider = identityProvider ?: return newFixedLengthResponse(
            Response.Status.INTERNAL_ERROR, MIME_JSON, errorJson("NO_IDENTITY", "Identity not configured")
        )
        val info = provider()
        val body = json.encodeToString(info)
        return newFixedLengthResponse(Response.Status.OK, MIME_JSON, body)
    }

    private fun servePairQr(): Response {
        val provider = identityProvider ?: return newFixedLengthResponse(
            Response.Status.INTERNAL_ERROR, MIME_JSON, errorJson("NO_IDENTITY", "Identity not configured")
        )
        val info = provider()
        val body = json.encodeToString(info)

        val qrWriter = com.google.zxing.qrcode.QRCodeWriter()
        val matrix = qrWriter.encode(body, com.google.zxing.BarcodeFormat.QR_CODE, 256, 256)
        val w = matrix.width
        val h = matrix.height

        val svg = buildString {
            append("""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 $w $h" width="256" height="256">""")
            append("""<rect width="$w" height="$h" fill="white"/>""")
            for (y in 0 until h) {
                for (x in 0 until w) {
                    if (matrix[x, y]) {
                        append("""<rect x="$x" y="$y" width="1" height="1" fill="black"/>""")
                    }
                }
            }
            append("</svg>")
        }

        return newFixedLengthResponse(Response.Status.OK, "image/svg+xml", svg)
    }

    companion object {
        const val DEFAULT_PORT = 19743
        private const val MIME_JSON = "application/json"
    }
}

@Serializable
data class DeviceIdentityInfo(
    val v: Int = 2,
    val id: String,
    val pk: String,
    val fp: String,
    val name: String,
    val code: String,
    val caps: List<String> = listOf("browse", "transfer"),
    val relay: String? = null,
    val ts: Long = System.currentTimeMillis() / 1000,
    val sig: String? = null,
    val hint: LanHintInfo? = null,
)

@Serializable
data class LanHintInfo(
    val lan: String,
)

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

private class DefaultTempFileManagerWithDir(private val tmpDir: File) : fi.iki.elonen.NanoHTTPD.TempFileManager {
    private val tempFiles = mutableListOf<fi.iki.elonen.NanoHTTPD.TempFile>()

    override fun createTempFile(filename_hint: String?): fi.iki.elonen.NanoHTTPD.TempFile {
        val tempFile = File.createTempFile("NanoHTTPD-", "", tmpDir)
        val tf = object : fi.iki.elonen.NanoHTTPD.TempFile {
            override fun getName(): String = tempFile.absolutePath
            override fun open(): java.io.OutputStream = FileOutputStream(tempFile)
            override fun delete() { tempFile.delete() }
        }
        tempFiles.add(tf)
        return tf
    }

    override fun clear() {
        tempFiles.forEach { it.delete() }
        tempFiles.clear()
    }
}
