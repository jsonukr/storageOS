package com.storageos.android.transfer

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.net.URLEncoder
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.roundToLong

data class TransferJob(
    val id: String = UUID.randomUUID().toString(),
    val fileName: String,
    val sourcePath: String,
    val status: TransferStatus = TransferStatus.Queued,
    val bytesTransferred: Long = 0,
    val totalBytes: Long = 0,
    val speedBytesPerSec: Long = 0,
    val estimatedRemainingMs: Long = 0,
    val error: String? = null,
)

enum class TransferStatus {
    Queued, Running, Paused, Completed, Failed, Cancelled
}

class DownloadManager(private val context: Context) {

    private val _jobs = MutableStateFlow<List<TransferJob>>(emptyList())
    val jobs: StateFlow<List<TransferJob>> = _jobs.asStateFlow()

    private val notifications = TransferNotifications(context)

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var cancelledIds = mutableSetOf<String>()

    fun cancelJob(jobId: String) {
        cancelledIds.add(jobId)
        updateJob(jobId) { it.copy(status = TransferStatus.Cancelled) }
    }

    fun removeJob(jobId: String) {
        _jobs.value = _jobs.value.filter { it.id != jobId }
    }

    fun clearCompleted() {
        _jobs.value = _jobs.value.filter {
            it.status != TransferStatus.Completed &&
            it.status != TransferStatus.Failed &&
            it.status != TransferStatus.Cancelled
        }
    }

    suspend fun download(agentBaseUrl: String, entry: DownloadEntry): TransferJob {
        val job = TransferJob(
            fileName = entry.name,
            sourcePath = entry.fullPath,
            totalBytes = entry.size,
        )
        _jobs.value = _jobs.value + job

        return withContext(Dispatchers.IO) {
            try {
                updateJob(job.id) { it.copy(status = TransferStatus.Running) }

                val encodedPath = URLEncoder.encode(entry.fullPath, "UTF-8")
                val url = "$agentBaseUrl/download?path=$encodedPath"

                val request = Request.Builder().url(url).build()
                val response = client.newCall(request).execute()

                if (!response.isSuccessful) {
                    val errMsg = "HTTP ${response.code}"
                    updateJob(job.id) { it.copy(status = TransferStatus.Failed, error = errMsg) }
                    return@withContext getJob(job.id)
                }

                val body = response.body ?: run {
                    updateJob(job.id) { it.copy(status = TransferStatus.Failed, error = "Empty response") }
                    return@withContext getJob(job.id)
                }

                val totalBytes = body.contentLength().takeIf { it > 0 } ?: entry.size

                val uniqueName = resolveUniqueName(entry.name)

                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, uniqueName)
                    put(MediaStore.Downloads.MIME_TYPE, guessMimeType(uniqueName))
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                }

                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: run {
                        updateJob(job.id) { it.copy(status = TransferStatus.Failed, error = "Failed to create file in Downloads") }
                        return@withContext getJob(job.id)
                    }

                try {
                    resolver.openOutputStream(uri)?.use { output ->
                        body.byteStream().use { input ->
                            val buffer = ByteArray(8192)
                            var bytesRead: Long = 0
                            val startTime = System.currentTimeMillis()
                            var lastUpdateTime = startTime

                            while (true) {
                                if (cancelledIds.contains(job.id)) {
                                    resolver.delete(uri, null, null)
                                    return@withContext getJob(job.id)
                                }

                                val read = input.read(buffer)
                                if (read == -1) break

                                output.write(buffer, 0, read)
                                bytesRead += read

                                val now = System.currentTimeMillis()
                                if (now - lastUpdateTime >= 200) {
                                    val elapsed = (now - startTime).coerceAtLeast(1)
                                    val speed = (bytesRead * 1000.0 / elapsed).roundToLong()
                                    val remaining = if (speed > 0 && totalBytes > 0) {
                                        ((totalBytes - bytesRead) * 1000 / speed)
                                    } else 0

                                    val pct = if (totalBytes > 0) (bytesRead * 100 / totalBytes).toInt() else 0
                                    updateJob(job.id) {
                                        it.copy(
                                            bytesTransferred = bytesRead,
                                            totalBytes = totalBytes,
                                            speedBytesPerSec = speed,
                                            estimatedRemainingMs = remaining,
                                        )
                                    }
                                    notifications.showProgress(
                                        job.id, entry.name, pct,
                                        "${formatSpeed(speed)} — ${pct}%",
                                    )
                                    lastUpdateTime = now
                                }
                            }
                        }
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        contentValues.clear()
                        contentValues.put(MediaStore.Downloads.IS_PENDING, 0)
                        resolver.update(uri, contentValues, null, null)
                    }

                    updateJob(job.id) {
                        it.copy(
                            status = TransferStatus.Completed,
                            bytesTransferred = totalBytes,
                            totalBytes = totalBytes,
                            speedBytesPerSec = 0,
                            estimatedRemainingMs = 0,
                        )
                    }
                    notifications.showComplete(job.id, entry.name)
                } catch (e: Exception) {
                    resolver.delete(uri, null, null)
                    throw e
                }
            } catch (e: Exception) {
                if (!cancelledIds.contains(job.id)) {
                    updateJob(job.id) {
                        it.copy(status = TransferStatus.Failed, error = e.message ?: "Download failed")
                    }
                    notifications.showFailed(job.id, entry.name, e.message)
                } else {
                    notifications.cancel(job.id)
                }
            }
            getJob(job.id)
        }
    }

    private fun updateJob(id: String, update: (TransferJob) -> TransferJob) {
        _jobs.value = _jobs.value.map { if (it.id == id) update(it) else it }
    }

    private fun getJob(id: String): TransferJob =
        _jobs.value.first { it.id == id }

    private fun resolveUniqueName(name: String): String {
        val resolver = context.contentResolver
        val existing = mutableSetOf<String>()
        resolver.query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            arrayOf(MediaStore.Downloads.DISPLAY_NAME),
            "${MediaStore.Downloads.DISPLAY_NAME} LIKE ?",
            arrayOf("${name.substringBeforeLast('.')}%"),
            null,
        )?.use { cursor ->
            val col = cursor.getColumnIndexOrThrow(MediaStore.Downloads.DISPLAY_NAME)
            while (cursor.moveToNext()) {
                existing.add(cursor.getString(col))
            }
        }
        if (name !in existing) return name
        val base = name.substringBeforeLast('.', name)
        val ext = if (name.contains('.')) ".${name.substringAfterLast('.')}" else ""
        var counter = 1
        while ("$base ($counter)$ext" in existing) counter++
        return "$base ($counter)$ext"
    }

    private fun formatSpeed(bytesPerSec: Long): String {
        return when {
            bytesPerSec >= 1_073_741_824 -> "%.1f GB/s".format(bytesPerSec / 1_073_741_824.0)
            bytesPerSec >= 1_048_576 -> "%.1f MB/s".format(bytesPerSec / 1_048_576.0)
            bytesPerSec >= 1024 -> "%.0f KB/s".format(bytesPerSec / 1024.0)
            else -> "$bytesPerSec B/s"
        }
    }

    private fun guessMimeType(name: String): String {
        val ext = name.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "bmp" -> "image/bmp"
            "mp4" -> "video/mp4"
            "mkv" -> "video/x-matroska"
            "mp3" -> "audio/mpeg"
            "pdf" -> "application/pdf"
            "zip" -> "application/zip"
            "txt" -> "text/plain"
            else -> "application/octet-stream"
        }
    }
}

data class DownloadEntry(
    val name: String,
    val fullPath: String,
    val size: Long,
)
