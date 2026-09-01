package com.storageos.android.ui.browser

import android.net.Uri
import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.storageos.android.api.AgentApi
import com.storageos.android.api.DirectoryEntry
import com.storageos.android.network.RelayAgentApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URLEncoder

// Relay has no HTTP streaming endpoint, so we download the whole file into the
// cache first. Cap it so we don't try to hold a huge video in memory.
private const val RELAY_VIDEO_MAX_BYTES = 100L * 1024 * 1024 // 100 MB

@Composable
fun VideoPlayerScreen(
    entry: DirectoryEntry,
    api: AgentApi,
    agentBaseUrl: String,
    onClose: () -> Unit,
) {
    val context = LocalContext.current

    // LAN streams straight from the agent (HTTP Range → seekable). Relay has no
    // streaming endpoint, so pull the bytes to a cache file and play that.
    val source by produceState<Result<Uri>?>(null, entry.fullPath) {
        value = if (api is RelayAgentApi) {
            try {
                if (entry.size > RELAY_VIDEO_MAX_BYTES) {
                    Result.failure(RuntimeException("This video is too large to stream over relay. Download it to watch."))
                } else {
                    val ext = entry.extension.ifBlank { "mp4" }
                    val file = File(context.cacheDir, "relay-video.$ext")
                    withContext(Dispatchers.IO) {
                        val bytes = api.downloadBytes(entry.fullPath)
                        file.writeBytes(bytes)
                    }
                    Result.success(Uri.fromFile(file))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        } else {
            val encoded = URLEncoder.encode(entry.fullPath, "UTF-8")
            Result.success(Uri.parse("$agentBaseUrl/download?path=$encoded"))
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        when {
            source == null -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = Color.White)
            }

            source?.isSuccess == true -> {
                val uri = source!!.getOrThrow()
                AndroidView(
                    factory = { ctx ->
                        VideoView(ctx).apply {
                            val controller = MediaController(ctx)
                            controller.setAnchorView(this)
                            setMediaController(controller)
                            setVideoURI(uri)
                            setOnPreparedListener { it.start() }
                        }
                    },
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth(),
                )
            }

            else -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = source?.exceptionOrNull()?.message ?: "Failed to play video",
                    color = Color.White.copy(alpha = 0.8f),
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                )
            }
        }

        IconButton(
            onClick = onClose,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(8.dp),
        ) {
            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
        }
    }

    // Best-effort cleanup of the cached relay file on exit.
    DisposableEffect(entry.fullPath) {
        onDispose {
            if (api is RelayAgentApi) {
                val ext = entry.extension.ifBlank { "mp4" }
                File(context.cacheDir, "relay-video.$ext").delete()
            }
        }
    }
}
