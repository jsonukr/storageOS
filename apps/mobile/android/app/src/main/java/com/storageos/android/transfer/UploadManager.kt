package com.storageos.android.transfer

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.storageos.android.network.RelayAgentApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import java.net.URLEncoder
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.roundToLong

class UploadManager(private val context: Context) {

    private val _jobs = MutableStateFlow<List<TransferJob>>(emptyList())
    val jobs: StateFlow<List<TransferJob>> = _jobs.asStateFlow()

    private val notifications = TransferNotifications(context)

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(0, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
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

    suspend fun upload(
        agentBaseUrl: String,
        destinationPath: String,
        uri: Uri,
    ): TransferJob {
        val resolver = context.contentResolver
        val fileName = getFileName(uri) ?: "upload_${System.currentTimeMillis()}"
        val fileSize = getFileSize(uri)

        val job = TransferJob(
            fileName = fileName,
            sourcePath = uri.toString(),
            totalBytes = fileSize,
        )
        _jobs.value = _jobs.value + job

        return withContext(Dispatchers.IO) {
            try {
                updateJob(job.id) { it.copy(status = TransferStatus.Running) }

                val inputStream = resolver.openInputStream(uri)
                    ?: throw Exception("Cannot read file")

                val mimeType = resolver.getType(uri) ?: "application/octet-stream"
                val startTime = System.currentTimeMillis()

                val requestBody = object : RequestBody() {
                    override fun contentType() = mimeType.toMediaType()
                    override fun contentLength() = fileSize
                    override fun writeTo(sink: BufferedSink) {
                        inputStream.use { input ->
                            val buffer = ByteArray(8192)
                            var bytesWritten = 0L
                            var lastUpdateTime = startTime
                            while (true) {
                                if (cancelledIds.contains(job.id)) return
                                val read = input.read(buffer)
                                if (read == -1) break
                                sink.write(buffer, 0, read)
                                bytesWritten += read

                                val now = System.currentTimeMillis()
                                if (now - lastUpdateTime >= 200) {
                                    val elapsed = (now - startTime).coerceAtLeast(1)
                                    val speed = (bytesWritten * 1000.0 / elapsed).roundToLong()
                                    val remaining = if (speed > 0 && fileSize > 0) {
                                        ((fileSize - bytesWritten) * 1000 / speed)
                                    } else 0

                                    val pct = if (fileSize > 0) (bytesWritten * 100 / fileSize).toInt() else 0
                                    updateJob(job.id) {
                                        it.copy(
                                            bytesTransferred = bytesWritten,
                                            totalBytes = fileSize,
                                            speedBytesPerSec = speed,
                                            estimatedRemainingMs = remaining,
                                        )
                                    }
                                    notifications.showUploadProgress(
                                        job.id, fileName, pct,
                                        "${formatSpeed(speed)} — ${pct}%",
                                    )
                                    lastUpdateTime = now
                                }
                            }
                        }
                    }
                }

                val multipartBody = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("file", fileName, requestBody)
                    .build()

                val encodedPath = URLEncoder.encode(destinationPath, "UTF-8")
                val request = Request.Builder()
                    .url("$agentBaseUrl/upload?path=$encodedPath")
                    .post(multipartBody)
                    .build()

                val response = client.newCall(request).execute()

                if (cancelledIds.contains(job.id)) {
                    return@withContext getJob(job.id)
                }

                if (!response.isSuccessful) {
                    val errMsg = "HTTP ${response.code}"
                    updateJob(job.id) { it.copy(status = TransferStatus.Failed, error = errMsg) }
                    notifications.showFailed(job.id, fileName, errMsg)
                } else {
                    updateJob(job.id) {
                        it.copy(
                            status = TransferStatus.Completed,
                            bytesTransferred = fileSize,
                            totalBytes = fileSize,
                            speedBytesPerSec = 0,
                            estimatedRemainingMs = 0,
                        )
                    }
                    notifications.showUploadComplete(job.id, fileName)
                }
            } catch (e: Exception) {
                if (!cancelledIds.contains(job.id)) {
                    updateJob(job.id) {
                        it.copy(status = TransferStatus.Failed, error = e.message ?: "Upload failed")
                    }
                    notifications.showFailed(job.id, fileName, e.message)
                } else {
                    notifications.cancel(job.id)
                }
            }
            getJob(job.id)
        }
    }

    suspend fun relayUpload(
        relayApi: RelayAgentApi,
        destinationPath: String,
        uri: Uri,
    ): TransferJob {
        val resolver = context.contentResolver
        val fileName = getFileName(uri) ?: "upload_${System.currentTimeMillis()}"
        val fileSize = getFileSize(uri)

        val job = TransferJob(
            fileName = fileName,
            sourcePath = uri.toString(),
            totalBytes = fileSize,
        )
        _jobs.value = _jobs.value + job

        return withContext(Dispatchers.IO) {
            try {
                updateJob(job.id) { it.copy(status = TransferStatus.Running) }

                val inputStream = resolver.openInputStream(uri)
                    ?: throw Exception("Cannot read file")
                val fileBytes = inputStream.use { it.readBytes() }
                val startTime = System.currentTimeMillis()

                notifications.showUploadProgress(job.id, fileName, 0, "Uploading via relay...")

                val result = relayApi.uploadFile(
                    destDir = destinationPath,
                    fileName = fileName,
                    fileBytes = fileBytes,
                    onProgress = { sent, total ->
                        val pct = if (total > 0) (sent * 100 / total).toInt() else 0
                        val elapsed = (System.currentTimeMillis() - startTime).coerceAtLeast(1)
                        val speed = (sent * 1000.0 / elapsed).roundToLong()
                        updateJob(job.id) {
                            it.copy(
                                bytesTransferred = sent,
                                totalBytes = total,
                                speedBytesPerSec = speed,
                            )
                        }
                        notifications.showUploadProgress(
                            job.id, fileName, pct,
                            "${formatSpeed(speed)} — ${pct}%",
                        )
                    },
                )

                if (result.success) {
                    updateJob(job.id) {
                        it.copy(
                            status = TransferStatus.Completed,
                            bytesTransferred = fileSize,
                            totalBytes = fileSize,
                        )
                    }
                    notifications.showUploadComplete(job.id, fileName)
                } else {
                    updateJob(job.id) {
                        it.copy(status = TransferStatus.Failed, error = "Upload failed on remote device")
                    }
                    notifications.showFailed(job.id, fileName, "Upload failed")
                }
            } catch (e: Exception) {
                updateJob(job.id) {
                    it.copy(status = TransferStatus.Failed, error = e.message ?: "Relay upload failed")
                }
                notifications.showFailed(job.id, fileName, e.message)
            }
            getJob(job.id)
        }
    }

    private fun getFileName(uri: Uri): String? {
        val cursor = context.contentResolver.query(uri, null, null, null, null)
        return cursor?.use {
            if (it.moveToFirst()) {
                val idx = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0) it.getString(idx) else null
            } else null
        }
    }

    private fun getFileSize(uri: Uri): Long {
        val cursor = context.contentResolver.query(uri, null, null, null, null)
        return cursor?.use {
            if (it.moveToFirst()) {
                val idx = it.getColumnIndex(OpenableColumns.SIZE)
                if (idx >= 0) it.getLong(idx) else 0L
            } else 0L
        } ?: 0L
    }

    private fun formatSpeed(bytesPerSec: Long): String {
        return when {
            bytesPerSec >= 1_073_741_824 -> "%.1f GB/s".format(bytesPerSec / 1_073_741_824.0)
            bytesPerSec >= 1_048_576 -> "%.1f MB/s".format(bytesPerSec / 1_048_576.0)
            bytesPerSec >= 1024 -> "%.0f KB/s".format(bytesPerSec / 1024.0)
            else -> "$bytesPerSec B/s"
        }
    }

    private fun updateJob(id: String, update: (TransferJob) -> TransferJob) {
        _jobs.value = _jobs.value.map { if (it.id == id) update(it) else it }
    }

    private fun getJob(id: String): TransferJob =
        _jobs.value.first { it.id == id }
}
