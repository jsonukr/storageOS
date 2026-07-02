package com.storageos.android.ui.browser

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.SdStorage
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.storageos.android.api.AgentApi
import com.storageos.android.api.DirectoryEntry
import com.storageos.android.api.DriveInfo
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrowserScreen(
    api: AgentApi,
    onDisconnect: () -> Unit,
    onOpenSettings: () -> Unit = {},
    onOpenDevices: () -> Unit = {},
    viewModel: BrowserViewModel = viewModel(),
) {
    LaunchedEffect(api) { viewModel.init(api) }

    val state by viewModel.state.collectAsState()
    val canGoBack = state.currentPath != null
    var isGridView by rememberSaveable { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (state.currentPath != null)
                            state.currentPath!!.split("\\").lastOrNull()?.ifEmpty { state.currentPath!! } ?: "My Computer"
                        else "My Computer",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                },
                navigationIcon = {
                    if (canGoBack) {
                        IconButton(onClick = { viewModel.goBack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                actions = {
                    if (state.content is BrowserContent.Directory) {
                        IconButton(onClick = { isGridView = !isGridView }) {
                            Icon(
                                imageVector = if (isGridView) Icons.AutoMirrored.Filled.ViewList else Icons.Default.GridView,
                                contentDescription = if (isGridView) "List view" else "Grid view",
                            )
                        }
                    }
                    IconButton(onClick = onOpenDevices) {
                        Icon(Icons.Default.Devices, contentDescription = "Devices")
                    }
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            if (state.currentPath != null) {
                Breadcrumbs(
                    path = state.currentPath!!,
                    onNavigate = { viewModel.navigateToPath(it) },
                    onHome = { viewModel.loadRoots() },
                )
            }

            val count = when (val content = state.content) {
                is BrowserContent.Directory -> content.entries.size
                is BrowserContent.Drives -> content.drives.size
                null -> 0
            }
            if (!state.isLoading && state.error == null && state.currentPath != null) {
                Text(
                    text = "$count items",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                )
            }

            PullToRefreshBox(
                isRefreshing = state.isLoading && state.content != null,
                onRefresh = { viewModel.refresh() },
                modifier = Modifier.fillMaxSize(),
            ) {
                AnimatedContent(
                    targetState = state,
                    transitionSpec = {
                        (fadeIn(tween(200)) + slideInVertically(tween(200)) { it / 16 })
                            .togetherWith(fadeOut(tween(150)))
                    },
                    contentKey = { Triple(it.isLoading && it.content == null, it.error, it.currentPath) },
                    label = "browser-content",
                ) { animState ->
                    when {
                        animState.isLoading && animState.content == null -> ShimmerLoading()
                        animState.error != null -> ErrorState(animState.error!!, onRetry = {
                            if (animState.currentPath != null) viewModel.goBack()
                            else viewModel.loadRoots()
                        })
                        animState.content is BrowserContent.Drives -> DriveList(
                            drives = (animState.content as BrowserContent.Drives).drives,
                            onDriveTap = viewModel::openDrive,
                        )
                        animState.content is BrowserContent.Directory -> {
                            if (isGridView) {
                                EntryGrid(
                                    entries = (animState.content as BrowserContent.Directory).entries,
                                    onEntryTap = viewModel::openEntry,
                                )
                            } else {
                                EntryList(
                                    entries = (animState.content as BrowserContent.Directory).entries,
                                    onEntryTap = viewModel::openEntry,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Breadcrumbs(
    path: String,
    onNavigate: (String) -> Unit,
    onHome: () -> Unit,
) {
    val scrollState = rememberScrollState()
    val segments = path.split("\\").filter { it.isNotEmpty() }

    LaunchedEffect(path) {
        scrollState.animateScrollTo(scrollState.maxValue)
    }

    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        tonalElevation = 1.dp,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(scrollState)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(
                onClick = onHome,
                contentPadding = PaddingValues(horizontal = 8.dp),
            ) {
                Icon(
                    Icons.Default.Home,
                    contentDescription = "Home",
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(4.dp))
                Text("Home", style = MaterialTheme.typography.labelMedium)
            }

            segments.forEachIndexed { index, segment ->
                Text(
                    text = " / ",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
                val segmentPath = segments.take(index + 1).joinToString("\\") + "\\"
                val isLast = index == segments.size - 1
                TextButton(
                    onClick = { if (!isLast) onNavigate(segmentPath) },
                    contentPadding = PaddingValues(horizontal = 6.dp),
                ) {
                    Text(
                        text = segment.ifEmpty { path.take(3) },
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (isLast) FontWeight.Bold else FontWeight.Normal,
                        color = if (isLast) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.primary,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

@Composable
private fun ShimmerLoading() {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Restart),
        label = "shimmer-translate",
    )

    val shimmerBrush = Brush.linearGradient(
        colors = listOf(
            MaterialTheme.colorScheme.surfaceContainerLow,
            MaterialTheme.colorScheme.surfaceContainerHigh,
            MaterialTheme.colorScheme.surfaceContainerLow,
        ),
        start = Offset(translateAnim - 200f, 0f),
        end = Offset(translateAnim + 200f, 0f),
    )

    Column(modifier = Modifier.padding(16.dp)) {
        repeat(8) {
            Row(
                modifier = Modifier.padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(shimmerBrush),
                )
                Spacer(Modifier.width(14.dp))
                Column {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.55f)
                            .height(14.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(shimmerBrush),
                    )
                    Spacer(Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.30f)
                            .height(10.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(shimmerBrush),
                    )
                }
            }
        }
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.errorContainer,
            modifier = Modifier.size(64.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    modifier = Modifier.size(32.dp),
                    tint = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
        }
        Spacer(Modifier.height(20.dp))
        Text(
            text = "Something went wrong",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
        TextButton(onClick = onRetry) {
            Text("Go back")
        }
    }
}

@Composable
private fun DriveList(drives: List<DriveInfo>, onDriveTap: (DriveInfo) -> Unit) {
    if (drives.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.Storage,
                    null,
                    Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                )
                Spacer(Modifier.height(12.dp))
                Text("No drives found", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        return
    }

    LazyColumn(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp)) {
        items(drives, key = { it.letter }) { drive ->
            DriveCard(drive = drive, onClick = { onDriveTap(drive) })
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun DriveCard(drive: DriveInfo, onClick: () -> Unit) {
    val usedFraction = if (drive.totalBytes > 0) drive.usedBytes.toFloat() / drive.totalBytes.toFloat() else 0f
    val progressColor = when {
        usedFraction > 0.9f -> MaterialTheme.colorScheme.error
        usedFraction > 0.75f -> Color(0xFFE67E22)
        else -> MaterialTheme.colorScheme.primary
    }

    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        tonalElevation = 1.dp,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(48.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (drive.isRemovable) Icons.Default.SdStorage else Icons.Default.Storage,
                        contentDescription = null,
                        modifier = Modifier.size(24.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (drive.label.isNotEmpty()) "${drive.label} (${drive.letter}:)"
                    else "Local Disk (${drive.letter}:)",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                if (drive.totalBytes > 0) {
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { usedFraction },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp)),
                        color = progressColor,
                        trackColor = MaterialTheme.colorScheme.outlineVariant,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "${formatBytes(drive.freeBytes)} free of ${formatBytes(drive.totalBytes)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun EntryList(
    entries: List<DirectoryEntry>,
    onEntryTap: (DirectoryEntry) -> Unit,
) {
    if (entries.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.Folder,
                    null,
                    Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                )
                Spacer(Modifier.height(12.dp))
                Text(
                    "This folder is empty",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        return
    }

    LazyColumn(contentPadding = PaddingValues(vertical = 4.dp)) {
        items(entries, key = { it.fullPath }) { entry ->
            EntryRow(entry = entry, onClick = { onEntryTap(entry) })
        }
    }
}

@Composable
private fun EntryRow(entry: DirectoryEntry, onClick: () -> Unit) {
    val icon = getFileIcon(entry)
    val iconColor = getFileColor(entry)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = iconColor.copy(alpha = 0.12f),
            modifier = Modifier.size(40.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(22.dp),
                    tint = iconColor,
                )
            }
        }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = entry.name,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (!entry.isDirectory && entry.size > 0) {
                    Text(
                        text = formatBytes(entry.size),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (entry.lastModified > 0) {
                    if (!entry.isDirectory && entry.size > 0) {
                        Text(
                            "·",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.outline,
                        )
                    }
                    Text(
                        text = formatDate(entry.lastModified),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun EntryGrid(
    entries: List<DirectoryEntry>,
    onEntryTap: (DirectoryEntry) -> Unit,
) {
    if (entries.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.Folder,
                    null,
                    Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                )
                Spacer(Modifier.height(12.dp))
                Text("This folder is empty", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        return
    }

    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 100.dp),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(entries, key = { it.fullPath }) { entry ->
            val icon = getFileIcon(entry)
            val iconColor = getFileColor(entry)

            Surface(
                onClick = { onEntryTap(entry) },
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surfaceContainerLow,
                tonalElevation = 1.dp,
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = iconColor.copy(alpha = 0.12f),
                        modifier = Modifier.size(44.dp),
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = icon,
                                contentDescription = null,
                                modifier = Modifier.size(24.dp),
                                tint = iconColor,
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = entry.name,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                    )
                    if (!entry.isDirectory && entry.size > 0) {
                        Text(
                            text = formatBytes(entry.size),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.align(Alignment.CenterHorizontally),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun getFileColor(entry: DirectoryEntry): Color {
    if (entry.isDirectory) return MaterialTheme.colorScheme.primary
    return when (entry.extension.lowercase()) {
        "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp" -> Color(0xFF43A047)
        "mp4", "mkv", "avi", "mov", "webm" -> Color(0xFFE53935)
        "mp3", "wav", "flac", "aac", "ogg", "m4a" -> Color(0xFFFF6F00)
        "pdf" -> Color(0xFFD32F2F)
        "doc", "docx", "txt", "rtf" -> Color(0xFF1565C0)
        "xls", "xlsx", "csv" -> Color(0xFF2E7D32)
        "zip", "rar", "7z", "tar", "gz" -> Color(0xFF6D4C41)
        "apk" -> Color(0xFF00897B)
        "kt", "java", "py", "js", "ts", "json", "xml", "html", "css" -> Color(0xFF7B1FA2)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
}

private fun getFileIcon(entry: DirectoryEntry): ImageVector {
    if (entry.isDirectory) return Icons.Default.Folder
    return when (entry.extension.lowercase()) {
        "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp" -> Icons.Default.Image
        "mp4", "mkv", "avi", "mov", "webm" -> Icons.Default.VideoFile
        "mp3", "wav", "flac", "aac", "ogg", "m4a" -> Icons.Default.AudioFile
        "pdf" -> Icons.Default.PictureAsPdf
        "doc", "docx", "txt", "rtf" -> Icons.Default.Description
        "zip", "rar", "7z", "tar", "gz" -> Icons.Default.Archive
        "kt", "java", "py", "js", "ts", "json", "xml", "html", "css" -> Icons.Default.Code
        else -> Icons.AutoMirrored.Filled.InsertDriveFile
    }
}

private fun formatBytes(bytes: Long): String = when {
    bytes < 1024 -> "$bytes B"
    bytes < 1024 * 1024 -> "${"%.1f".format(bytes / 1024.0)} KB"
    bytes < 1024 * 1024 * 1024 -> "${"%.1f".format(bytes / (1024.0 * 1024.0))} MB"
    else -> "${"%.2f".format(bytes / (1024.0 * 1024.0 * 1024.0))} GB"
}

private val dateFormat = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())

private fun formatDate(epochSecs: Long): String =
    dateFormat.format(Date(epochSecs * 1000))
