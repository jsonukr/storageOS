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
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SdStorage
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material.icons.filled.DriveFileRenameOutline
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
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
import com.storageos.android.transfer.DownloadEntry
import com.storageos.android.transfer.DownloadManager
import com.storageos.android.transfer.TransferStatus
import com.storageos.android.transfer.UploadManager
import com.storageos.android.ui.adaptive.LocalWindowSizeClass
import com.storageos.android.ui.adaptive.isExpandedWidth
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrowserScreen(
    api: AgentApi,
    agentBaseUrl: String = "",
    onDisconnect: () -> Unit,
    onOpenSettings: () -> Unit = {},
    onOpenDevices: () -> Unit = {},
    onOpenTransfers: () -> Unit = {},
    showNavigationActions: Boolean = true,
    downloadManager: DownloadManager,
    uploadManager: UploadManager,
    viewModel: BrowserViewModel = viewModel(),
) {
    LaunchedEffect(api) { viewModel.init(api, agentBaseUrl) }

    val state by viewModel.state.collectAsState()
    val canGoBack = state.currentPath != null
    var isGridView by rememberSaveable { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris ->
        val destPath = state.currentPath ?: return@rememberLauncherForActivityResult
        for (uri in uris) {
            scope.launch {
                val result = if (api is com.storageos.android.network.RelayAgentApi) {
                    uploadManager.relayUpload(
                        relayApi = api,
                        destinationPath = destPath,
                        uri = uri,
                    )
                } else {
                    uploadManager.upload(
                        agentBaseUrl = viewModel.agentBaseUrl,
                        destinationPath = destPath,
                        uri = uri,
                    )
                }
                when (result.status) {
                    TransferStatus.Completed -> {
                        snackbar.showSnackbar("${result.fileName} uploaded")
                        viewModel.refresh()
                    }
                    TransferStatus.Failed ->
                        snackbar.showSnackbar("Upload failed: ${result.error ?: "unknown error"}")
                    TransferStatus.Cancelled ->
                        snackbar.showSnackbar("Upload cancelled")
                    else -> {}
                }
            }
        }
    }

    var showNewFolderDialog by rememberSaveable { mutableStateOf(false) }
    var renameTarget by remember { mutableStateOf<DirectoryEntry?>(null) }
    var deleteTarget by remember { mutableStateOf<DirectoryEntry?>(null) }
    var contextEntry by remember { mutableStateOf<DirectoryEntry?>(null) }

    val onDownloadEntry = { entry: DirectoryEntry ->
        scope.launch {
            scope.launch { snackbar.showSnackbar("Downloading ${entry.name}…") }
            val result = downloadManager.download(
                agentBaseUrl = viewModel.agentBaseUrl,
                entry = DownloadEntry(
                    name = entry.name,
                    fullPath = entry.fullPath,
                    size = entry.size,
                ),
            )
            when (result.status) {
                TransferStatus.Completed ->
                    snackbar.showSnackbar("${entry.name} saved to Downloads")
                TransferStatus.Failed ->
                    snackbar.showSnackbar("Download failed: ${result.error ?: "unknown error"}")
                TransferStatus.Cancelled ->
                    snackbar.showSnackbar("Download cancelled")
                else -> {}
            }
        }
        Unit
    }

    if (state.previewIndex >= 0 && state.previewImages.isNotEmpty()) {
        androidx.activity.compose.BackHandler { viewModel.closePreview() }
        ImagePreviewScreen(
            images = state.previewImages,
            initialIndex = state.previewIndex,
            api = api,
            agentBaseUrl = viewModel.agentBaseUrl,
            onClose = { viewModel.closePreview() },
        )
        return
    }

    if (showNewFolderDialog) {
        NewFolderDialog(
            onDismiss = { showNewFolderDialog = false },
            onCreate = { name ->
                viewModel.createFolder(name) { ok, err ->
                    showNewFolderDialog = false
                    if (!ok) scope.launch { snackbar.showSnackbar(err ?: "Error") }
                }
            },
        )
    }

    if (renameTarget != null) {
        RenameDialog(
            entry = renameTarget!!,
            onDismiss = { renameTarget = null },
            onRename = { newName ->
                viewModel.renameEntry(renameTarget!!, newName) { ok, err ->
                    renameTarget = null
                    if (!ok) scope.launch { snackbar.showSnackbar(err ?: "Error") }
                }
            },
        )
    }

    if (deleteTarget != null) {
        DeleteDialog(
            entry = deleteTarget!!,
            onDismiss = { deleteTarget = null },
            onConfirm = {
                viewModel.deleteEntries(listOf(deleteTarget!!)) { ok, err ->
                    deleteTarget = null
                    if (!ok) scope.launch { snackbar.showSnackbar(err ?: "Error") }
                }
            },
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            if (state.currentPath != null) {
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    androidx.compose.material3.SmallFloatingActionButton(
                        onClick = { filePicker.launch(arrayOf("*/*")) },
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    ) {
                        Icon(Icons.Default.Upload, contentDescription = "Upload Files")
                    }
                    FloatingActionButton(
                        onClick = { showNewFolderDialog = true },
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                    ) {
                        Icon(Icons.Default.CreateNewFolder, contentDescription = "New Folder")
                    }
                }
            }
        },
        topBar = {
            TopAppBar(
                title = {
                    if (state.searchActive) {
                        OutlinedTextField(
                            value = state.searchQuery,
                            onValueChange = { viewModel.onSearchQueryChange(it) },
                            placeholder = { Text("Search in this folder") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(onSearch = { viewModel.runSearch() }),
                        )
                    } else {
                        Text(
                            text = if (state.currentPath != null)
                                state.currentPath!!.split("\\").lastOrNull()?.ifEmpty { state.currentPath!! } ?: "My Computer"
                            else "My Computer",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                },
                navigationIcon = {
                    if (state.searchActive) {
                        IconButton(onClick = { viewModel.closeSearch() }) {
                            Icon(Icons.Default.Close, contentDescription = "Close search")
                        }
                    } else if (canGoBack) {
                        IconButton(onClick = { viewModel.goBack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                actions = {
                    if (state.searchActive) {
                        IconButton(onClick = { viewModel.runSearch() }) {
                            Icon(Icons.Default.Search, contentDescription = "Search")
                        }
                    } else {
                        if (state.currentPath != null) {
                            IconButton(onClick = { viewModel.openSearch() }) {
                                Icon(Icons.Default.Search, contentDescription = "Search")
                            }
                        }
                        if (state.content is BrowserContent.Directory) {
                            IconButton(onClick = { isGridView = !isGridView }) {
                                Icon(
                                    imageVector = if (isGridView) Icons.AutoMirrored.Filled.ViewList else Icons.Default.GridView,
                                    contentDescription = if (isGridView) "List view" else "Grid view",
                                )
                            }
                        }
                        if (showNavigationActions) {
                            IconButton(onClick = onOpenTransfers) {
                                Icon(Icons.Default.SwapVert, contentDescription = "Transfers")
                            }
                            IconButton(onClick = onOpenDevices) {
                                Icon(Icons.Default.Devices, contentDescription = "Devices")
                            }
                            IconButton(onClick = onOpenSettings) {
                                Icon(Icons.Default.Settings, contentDescription = "Settings")
                            }
                        }
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
                        animState.content is BrowserContent.Drives -> HomeView(
                            drives = (animState.content as BrowserContent.Drives).drives,
                            onDriveTap = viewModel::openDrive,
                            onOpenDevices = onOpenDevices,
                        )
                        animState.content is BrowserContent.Directory -> {
                            val onTap = { entry: DirectoryEntry ->
                                if (entry.isImage()) viewModel.openImage(entry)
                                else viewModel.openEntry(entry)
                            }
                            if (isGridView) {
                                EntryGrid(
                                    entries = (animState.content as BrowserContent.Directory).entries,
                                    onEntryTap = onTap,
                                    onRename = { renameTarget = it },
                                    onDelete = { deleteTarget = it },
                                    onDownload = onDownloadEntry,
                                )
                            } else {
                                EntryList(
                                    entries = (animState.content as BrowserContent.Directory).entries,
                                    onEntryTap = onTap,
                                    onRename = { renameTarget = it },
                                    onDelete = { deleteTarget = it },
                                    onDownload = onDownloadEntry,
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
private fun HomeView(
    drives: List<DriveInfo>,
    onDriveTap: (DriveInfo) -> Unit,
    onOpenDevices: () -> Unit,
) {
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

    LazyColumn(contentPadding = PaddingValues(vertical = 4.dp)) {
        item(key = "header-storage") {
            SectionHeader(title = "Local Storage", icon = Icons.Default.Storage)
        }
        items(drives, key = { it.letter }) { drive ->
            DriveRow(drive = drive, onClick = { onDriveTap(drive) })
        }
        item(key = "spacer-bottom") {
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun SectionHeader(title: String, icon: ImageVector) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = title.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun DriveRow(drive: DriveInfo, onClick: () -> Unit) {
    val usedFraction = if (drive.totalBytes > 0) drive.usedBytes.toFloat() / drive.totalBytes.toFloat() else 0f
    val progressColor = when {
        usedFraction > 0.9f -> MaterialTheme.colorScheme.error
        usedFraction > 0.75f -> Color(0xFFE67E22)
        else -> MaterialTheme.colorScheme.primary
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(36.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = if (drive.isRemovable) Icons.Default.SdStorage else Icons.Default.Storage,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = if (drive.label.isNotEmpty()) "${drive.label} (${drive.letter}:)"
                    else "Local Disk (${drive.letter}:)",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
                if (drive.fileSystem.isNotEmpty()) {
                    Text(
                        text = drive.fileSystem,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (drive.totalBytes > 0) {
                Spacer(Modifier.height(6.dp))
                LinearProgressIndicator(
                    progress = { usedFraction },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp)),
                    color = progressColor,
                    trackColor = MaterialTheme.colorScheme.outlineVariant,
                )
                Spacer(Modifier.height(3.dp))
                Text(
                    text = "${formatBytes(drive.freeBytes)} free of ${formatBytes(drive.totalBytes)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun EntryList(
    entries: List<DirectoryEntry>,
    onEntryTap: (DirectoryEntry) -> Unit,
    onRename: (DirectoryEntry) -> Unit,
    onDelete: (DirectoryEntry) -> Unit,
    onDownload: (DirectoryEntry) -> Unit,
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
            EntryRow(
                entry = entry,
                onClick = { onEntryTap(entry) },
                onRename = { onRename(entry) },
                onDelete = { onDelete(entry) },
                onDownload = { onDownload(entry) },
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun EntryRow(
    entry: DirectoryEntry,
    onClick: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit,
    onDownload: () -> Unit,
) {
    val icon = getFileIcon(entry)
    val iconColor = getFileColor(entry)
    var showMenu by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onClick,
                onLongClick = { showMenu = true },
            )
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
        Box {
            IconButton(onClick = { showMenu = true }, modifier = Modifier.size(32.dp)) {
                Icon(
                    Icons.Default.MoreVert,
                    contentDescription = "More",
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                if (!entry.isDirectory) {
                    DropdownMenuItem(
                        text = { Text("Download") },
                        onClick = { showMenu = false; onDownload() },
                        leadingIcon = { Icon(Icons.Default.Download, null, Modifier.size(20.dp)) },
                    )
                }
                DropdownMenuItem(
                    text = { Text("Rename") },
                    onClick = { showMenu = false; onRename() },
                    leadingIcon = { Icon(Icons.Default.DriveFileRenameOutline, null, Modifier.size(20.dp)) },
                )
                DropdownMenuItem(
                    text = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                    onClick = { showMenu = false; onDelete() },
                    leadingIcon = { Icon(Icons.Default.Delete, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.error) },
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun EntryGrid(
    entries: List<DirectoryEntry>,
    onEntryTap: (DirectoryEntry) -> Unit,
    onRename: (DirectoryEntry) -> Unit,
    onDelete: (DirectoryEntry) -> Unit,
    onDownload: (DirectoryEntry) -> Unit,
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

    val windowSizeClass = LocalWindowSizeClass.current
    val columns = if (windowSizeClass.isExpandedWidth()) 4 else 3

    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(entries, key = { it.fullPath }) { entry ->
            val icon = getFileIcon(entry)
            val iconColor = getFileColor(entry)
            var showMenu by remember { mutableStateOf(false) }

            Box {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(0.85f)
                        .combinedClickable(
                            onClick = { onEntryTap(entry) },
                            onLongClick = { showMenu = true },
                        ),
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surfaceContainerLow,
                    tonalElevation = 1.dp,
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
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
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        )
                        if (!entry.isDirectory && entry.size > 0) {
                            Text(
                                text = formatBytes(entry.size),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        }
                    }
                }
                DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                    if (!entry.isDirectory) {
                        DropdownMenuItem(
                            text = { Text("Download") },
                            onClick = { showMenu = false; onDownload(entry) },
                            leadingIcon = { Icon(Icons.Default.Download, null, Modifier.size(20.dp)) },
                        )
                    }
                    DropdownMenuItem(
                        text = { Text("Rename") },
                        onClick = { showMenu = false; onRename(entry) },
                        leadingIcon = { Icon(Icons.Default.DriveFileRenameOutline, null, Modifier.size(20.dp)) },
                    )
                    DropdownMenuItem(
                        text = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                        onClick = { showMenu = false; onDelete(entry) },
                        leadingIcon = { Icon(Icons.Default.Delete, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.error) },
                    )
                }
            }
        }
    }
}

@Composable
private fun NewFolderDialog(
    onDismiss: () -> Unit,
    onCreate: (String) -> Unit,
) {
    var name by rememberSaveable { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.CreateNewFolder, null) },
        title = { Text("New Folder") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Folder name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = {
            TextButton(
                onClick = { if (name.isNotBlank()) onCreate(name.trim()) },
                enabled = name.isNotBlank(),
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

@Composable
private fun RenameDialog(
    entry: DirectoryEntry,
    onDismiss: () -> Unit,
    onRename: (String) -> Unit,
) {
    var name by rememberSaveable { mutableStateOf(entry.name) }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.DriveFileRenameOutline, null) },
        title = { Text("Rename") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("New name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = {
            TextButton(
                onClick = { if (name.isNotBlank() && name != entry.name) onRename(name.trim()) },
                enabled = name.isNotBlank() && name != entry.name,
            ) {
                Text("Rename")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

@Composable
private fun DeleteDialog(
    entry: DirectoryEntry,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error) },
        title = { Text("Delete") },
        text = {
            Column {
                Text("Are you sure you want to delete \"${entry.name}\"?")
                if (entry.isDirectory) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "This folder and all its contents will be permanently deleted.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("Delete", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
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
