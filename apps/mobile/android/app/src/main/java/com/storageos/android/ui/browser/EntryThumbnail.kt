package com.storageos.android.ui.browser

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import com.storageos.android.api.AgentApi
import com.storageos.android.api.DirectoryEntry
import com.storageos.android.network.RelayAgentApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URLEncoder
import java.nio.ByteBuffer
import java.util.concurrent.ConcurrentHashMap

// Small bounded cache so scrolling doesn't re-decode the same video frame.
private val videoFrameCache = ConcurrentHashMap<String, Bitmap>()

/**
 * Thumbnail for a file-list entry. Falls back to [fallback] (the file-type
 * icon) for non-media, while loading, or on error.
 * - Images: agent /thumbnail over LAN, thumbnail bytes over relay.
 * - Videos: a frame grabbed with MediaMetadataRetriever (LAN only — relay has
 *   no streaming endpoint, so those keep the icon).
 */
@Composable
fun EntryThumbnail(
    entry: DirectoryEntry,
    api: AgentApi,
    agentBaseUrl: String,
    modifier: Modifier = Modifier,
    fallback: @Composable () -> Unit,
) {
    when {
        entry.isImage() -> ImageThumbnail(entry, api, agentBaseUrl, modifier, fallback)
        entry.isVideo() && api !is RelayAgentApi && agentBaseUrl.isNotBlank() ->
            VideoThumbnail(entry, agentBaseUrl, modifier, fallback)
        else -> fallback()
    }
}

@Composable
private fun ImageThumbnail(
    entry: DirectoryEntry,
    api: AgentApi,
    agentBaseUrl: String,
    modifier: Modifier,
    fallback: @Composable () -> Unit,
) {
    if (api is RelayAgentApi) {
        val bytes by produceState<ByteArray?>(null, entry.fullPath) {
            value = try {
                withContext(Dispatchers.IO) { api.thumbnailBytes(entry.fullPath, 256) }
            } catch (e: Exception) {
                null
            }
        }
        val bb = bytes
        if (bb != null) {
            SubcomposeAsyncImage(
                model = ByteBuffer.wrap(bb),
                contentDescription = entry.name,
                modifier = modifier,
                contentScale = ContentScale.Crop,
                loading = { fallback() },
                error = { fallback() },
            )
        } else {
            fallback()
        }
    } else {
        val enc = URLEncoder.encode(entry.fullPath, "UTF-8")
        val url = "$agentBaseUrl/thumbnail?path=$enc&max_size=256"
        SubcomposeAsyncImage(
            model = ImageRequest.Builder(LocalContext.current).data(url).crossfade(true).build(),
            contentDescription = entry.name,
            modifier = modifier,
            contentScale = ContentScale.Crop,
            loading = { fallback() },
            error = { fallback() },
        )
    }
}

@Composable
private fun VideoThumbnail(
    entry: DirectoryEntry,
    agentBaseUrl: String,
    modifier: Modifier,
    fallback: @Composable () -> Unit,
) {
    val frame by produceState<Bitmap?>(videoFrameCache[entry.fullPath], entry.fullPath) {
        if (value != null) return@produceState
        value = withContext(Dispatchers.IO) {
            try {
                val enc = URLEncoder.encode(entry.fullPath, "UTF-8")
                val retriever = MediaMetadataRetriever()
                retriever.setDataSource("$agentBaseUrl/download?path=$enc", HashMap<String, String>())
                val bmp = retriever.getFrameAtTime(1_000_000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                retriever.release()
                if (bmp != null && videoFrameCache.size < 200) {
                    videoFrameCache[entry.fullPath] = bmp
                }
                bmp
            } catch (e: Exception) {
                null
            }
        }
    }
    val bmp = frame
    if (bmp != null) {
        Image(
            bitmap = bmp.asImageBitmap(),
            contentDescription = entry.name,
            modifier = modifier,
            contentScale = ContentScale.Crop,
        )
    } else {
        fallback()
    }
}
