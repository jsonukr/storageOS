package com.storageos.android.ui.transfers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ClearAll
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.storageos.android.transfer.DownloadManager
import com.storageos.android.transfer.TransferJob
import com.storageos.android.transfer.TransferStatus
import com.storageos.android.transfer.UploadManager

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransfersScreen(
    downloadManager: DownloadManager,
    uploadManager: UploadManager,
    onBack: () -> Unit,
) {
    val downloads by downloadManager.jobs.collectAsState()
    val uploads by uploadManager.jobs.collectAsState()

    val allJobs = buildList {
        addAll(downloads.map { TransferItem(it, isUpload = false) })
        addAll(uploads.map { TransferItem(it, isUpload = true) })
    }.sortedByDescending { it.job.id }

    val hasCompleted = allJobs.any {
        it.job.status == TransferStatus.Completed ||
        it.job.status == TransferStatus.Failed ||
        it.job.status == TransferStatus.Cancelled
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Transfers") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (hasCompleted) {
                        TextButton(onClick = {
                            downloadManager.clearCompleted()
                            uploadManager.clearCompleted()
                        }) {
                            Icon(
                                Icons.Default.ClearAll,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(Modifier.width(4.dp))
                            Text("Clear")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainer,
                ),
            )
        },
    ) { padding ->
        if (allJobs.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.AutoMirrored.Filled.InsertDriveFile,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "No transfers yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                items(allJobs, key = { "${it.isUpload}-${it.job.id}" }) { item ->
                    TransferRow(
                        item = item,
                        onCancel = {
                            if (item.isUpload) uploadManager.cancelJob(item.job.id)
                            else downloadManager.cancelJob(item.job.id)
                        },
                        onRemove = {
                            if (item.isUpload) uploadManager.removeJob(item.job.id)
                            else downloadManager.removeJob(item.job.id)
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun TransferRow(
    item: TransferItem,
    onCancel: () -> Unit,
    onRemove: () -> Unit,
) {
    val job = item.job
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            imageVector = when {
                job.status == TransferStatus.Completed -> Icons.Default.CheckCircle
                job.status == TransferStatus.Failed -> Icons.Default.Error
                job.status == TransferStatus.Cancelled -> Icons.Default.Cancel
                item.isUpload -> Icons.Default.CloudUpload
                else -> Icons.Default.CloudDownload
            },
            contentDescription = null,
            modifier = Modifier
                .size(32.dp)
                .padding(top = 2.dp),
            tint = when (job.status) {
                TransferStatus.Completed -> MaterialTheme.colorScheme.primary
                TransferStatus.Failed -> MaterialTheme.colorScheme.error
                TransferStatus.Cancelled -> MaterialTheme.colorScheme.onSurfaceVariant
                else -> MaterialTheme.colorScheme.onSurface
            },
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = job.fileName,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))

            when (job.status) {
                TransferStatus.Queued -> {
                    Text(
                        "Queued",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                TransferStatus.Running -> {
                    val progress = if (job.totalBytes > 0) {
                        (job.bytesTransferred.toFloat() / job.totalBytes).coerceIn(0f, 1f)
                    } else 0f

                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                    )
                    Spacer(Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            "${formatSize(job.bytesTransferred)} / ${formatSize(job.totalBytes)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            buildString {
                                append(formatSpeed(job.speedBytesPerSec))
                                if (job.estimatedRemainingMs > 0) {
                                    append(" — ")
                                    append(formatEta(job.estimatedRemainingMs))
                                }
                            },
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                TransferStatus.Paused -> {
                    Text(
                        "Paused",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                TransferStatus.Completed -> {
                    Text(
                        "${if (item.isUpload) "Uploaded" else "Downloaded"} — ${formatSize(job.totalBytes)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                TransferStatus.Failed -> {
                    Text(
                        job.error ?: "Transfer failed",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                TransferStatus.Cancelled -> {
                    Text(
                        "Cancelled",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        Spacer(Modifier.width(8.dp))
        when (job.status) {
            TransferStatus.Queued, TransferStatus.Running -> {
                IconButton(onClick = onCancel, modifier = Modifier.size(36.dp)) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Cancel",
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
            TransferStatus.Completed, TransferStatus.Failed, TransferStatus.Cancelled -> {
                IconButton(onClick = onRemove, modifier = Modifier.size(36.dp)) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Remove",
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            else -> {}
        }
    }
}

private data class TransferItem(
    val job: TransferJob,
    val isUpload: Boolean,
)

private fun formatSize(bytes: Long): String = when {
    bytes >= 1_073_741_824 -> "%.1f GB".format(bytes / 1_073_741_824.0)
    bytes >= 1_048_576 -> "%.1f MB".format(bytes / 1_048_576.0)
    bytes >= 1024 -> "%.0f KB".format(bytes / 1024.0)
    else -> "$bytes B"
}

private fun formatSpeed(bytesPerSec: Long): String = when {
    bytesPerSec >= 1_073_741_824 -> "%.1f GB/s".format(bytesPerSec / 1_073_741_824.0)
    bytesPerSec >= 1_048_576 -> "%.1f MB/s".format(bytesPerSec / 1_048_576.0)
    bytesPerSec >= 1024 -> "%.0f KB/s".format(bytesPerSec / 1024.0)
    else -> "$bytesPerSec B/s"
}

private fun formatEta(ms: Long): String {
    val totalSec = ms / 1000
    return when {
        totalSec >= 3600 -> "%dh %dm".format(totalSec / 3600, (totalSec % 3600) / 60)
        totalSec >= 60 -> "%dm %ds".format(totalSec / 60, totalSec % 60)
        else -> "${totalSec}s"
    }
}
