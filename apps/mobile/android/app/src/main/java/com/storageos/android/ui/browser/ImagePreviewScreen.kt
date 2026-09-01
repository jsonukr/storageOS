package com.storageos.android.ui.browser

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrokenImage
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import com.storageos.android.api.AgentApi
import com.storageos.android.api.DirectoryEntry
import com.storageos.android.network.RelayAgentApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URLEncoder
import java.nio.ByteBuffer

private val IMAGE_EXTENSIONS = setOf("jpg", "jpeg", "png", "gif", "bmp", "webp")
private val VIDEO_EXTENSIONS = setOf(
    "mp4", "webm", "mkv", "mov", "avi", "wmv", "flv", "m4v", "3gp", "mpg", "mpeg", "ts",
)

fun DirectoryEntry.isImage(): Boolean =
    !isDirectory && extension.lowercase() in IMAGE_EXTENSIONS

fun DirectoryEntry.isVideo(): Boolean =
    !isDirectory && extension.lowercase() in VIDEO_EXTENSIONS

@Composable
fun ImagePreviewScreen(
    images: List<DirectoryEntry>,
    initialIndex: Int,
    api: AgentApi,
    agentBaseUrl: String,
    onClose: () -> Unit,
) {
    if (images.isEmpty()) {
        onClose()
        return
    }

    val pagerState = rememberPagerState(
        initialPage = initialIndex.coerceIn(0, images.lastIndex),
        pageCount = { images.size },
    )

    var showOverlay by remember { mutableStateOf(true) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
            beyondViewportPageCount = 1,
            key = { images[it].fullPath },
        ) { page ->
            val entry = images[page]

            if (api is RelayAgentApi) {
                // No HTTP endpoint over relay — pull the image bytes through the
                // relay and hand them to Coil as a ByteBuffer.
                val result by produceState<Result<ByteArray>?>(null, entry.fullPath) {
                    value = runCatching {
                        withContext(Dispatchers.IO) { api.downloadBytes(entry.fullPath) }
                    }
                }
                when {
                    result == null -> PreviewLoading()
                    result?.isSuccess == true -> ZoomableImage(
                        model = ByteBuffer.wrap(result!!.getOrThrow()),
                        contentDescription = entry.name,
                        onTap = { showOverlay = !showOverlay },
                    )
                    else -> PreviewError()
                }
            } else {
                val encodedPath = URLEncoder.encode(entry.fullPath, "UTF-8")
                val imageUrl = "$agentBaseUrl/download?path=$encodedPath"
                ZoomableImage(
                    model = imageUrl,
                    contentDescription = entry.name,
                    onTap = { showOverlay = !showOverlay },
                )
            }
        }

        AnimatedVisibility(
            visible = showOverlay,
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.Black.copy(alpha = 0.6f))
                        .padding(horizontal = 8.dp, vertical = 12.dp)
                        .align(Alignment.TopCenter),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onClose) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color.White,
                        )
                    }
                    Column(modifier = Modifier.weight(1f).padding(horizontal = 8.dp)) {
                        Text(
                            text = images[pagerState.currentPage].name,
                            color = Color.White,
                            style = MaterialTheme.typography.titleSmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = "${pagerState.currentPage + 1} / ${images.size}",
                            color = Color.White.copy(alpha = 0.7f),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PreviewLoading() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Color.White)
    }
}

@Composable
private fun PreviewError() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            Icons.Default.BrokenImage,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = Color.White.copy(alpha = 0.5f),
        )
        Text(
            text = "Failed to load image",
            color = Color.White.copy(alpha = 0.5f),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun ZoomableImage(
    model: Any?,
    contentDescription: String,
    onTap: () -> Unit,
) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }

    val transformableState = rememberTransformableState { zoomChange, panChange, _ ->
        val newScale = (scale * zoomChange).coerceIn(1f, 5f)
        val maxX = (newScale - 1f) * 540f
        val maxY = (newScale - 1f) * 960f
        val newOffset = if (newScale > 1f) {
            Offset(
                x = (offset.x + panChange.x).coerceIn(-maxX, maxX),
                y = (offset.y + panChange.y).coerceIn(-maxY, maxY),
            )
        } else {
            Offset.Zero
        }
        scale = newScale
        offset = newOffset
    }

    LaunchedEffect(model) {
        snapshotFlow { model }.collect {
            scale = 1f
            offset = Offset.Zero
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onTap() },
                    onDoubleTap = { tapOffset ->
                        if (scale > 1.1f) {
                            scale = 1f
                            offset = Offset.Zero
                        } else {
                            scale = 3f
                            val centerX = size.width / 2f
                            val centerY = size.height / 2f
                            offset = Offset(
                                x = (centerX - tapOffset.x) * 2f,
                                y = (centerY - tapOffset.y) * 2f,
                            )
                        }
                    },
                )
            }
            .transformable(state = transformableState),
        contentAlignment = Alignment.Center,
    ) {
        SubcomposeAsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(model)
                .crossfade(true)
                .build(),
            contentDescription = contentDescription,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationX = offset.x
                    translationY = offset.y
                },
            contentScale = ContentScale.Fit,
            loading = {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = Color.White)
                }
            },
            error = {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        Icons.Default.BrokenImage,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = Color.White.copy(alpha = 0.5f),
                    )
                    Text(
                        text = "Failed to load image",
                        color = Color.White.copy(alpha = 0.5f),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            },
        )
    }
}
