package com.storageos.android.ui.connect

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lan
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Tablet
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.storageos.android.api.AgentApi
import com.storageos.android.data.SavedDevice
import com.storageos.android.ui.adaptive.LocalWindowSizeClass
import com.storageos.android.ui.adaptive.isCompactWidth
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val TAB_LABELS = listOf("QR Code", "Pair Code", "Manual")

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ConnectScreen(
    onConnected: (AgentApi) -> Unit,
    onSharePairing: (() -> Unit)? = null,
    viewModel: ConnectViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }

    val scanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        result.contents?.let { viewModel.onQrScanned(it, onConnected) }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) scanLauncher.launch(scanOptions())
    }

    fun launchScanner() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) scanLauncher.launch(scanOptions())
        else cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
    }

    var deviceToRename by remember { mutableStateOf<SavedDevice?>(null) }
    var deviceToRemove by remember { mutableStateOf<SavedDevice?>(null) }
    var renameText by remember { mutableStateOf("") }

    if (deviceToRename != null) {
        RenameDeviceDialog(
            name = renameText,
            onNameChange = { renameText = it },
            onConfirm = {
                if (renameText.isNotBlank()) {
                    viewModel.renameDevice(deviceToRename!!.deviceId, renameText.trim())
                }
                deviceToRename = null
            },
            onDismiss = { deviceToRename = null },
        )
    }

    if (deviceToRemove != null) {
        RemoveDeviceDialog(
            deviceName = deviceToRemove!!.name,
            onConfirm = {
                viewModel.removeDevice(deviceToRemove!!.deviceId)
                deviceToRemove = null
            },
            onDismiss = { deviceToRemove = null },
        )
    }

    val windowSizeClass = LocalWindowSizeClass.current
    val isCompact = windowSizeClass.isCompactWidth()
    val contentMaxWidth = if (isCompact) Modifier.fillMaxWidth() else Modifier.width(480.dp)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Connect to Device",
                            fontWeight = FontWeight.SemiBold,
                        )
                        if (!isCompact) {
                            Text(
                                "Choose how you want to connect.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            )
        },
    ) { padding ->
        if (isCompact) {
            // Phone: single column scrollable
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState()),
            ) {
                PhoneConnectContent(
                    state = state,
                    viewModel = viewModel,
                    selectedTab = selectedTab,
                    onTabSelected = { selectedTab = it },
                    onConnected = onConnected,
                    onScanQr = { launchScanner() },
                    onSharePairing = onSharePairing,
                    onRenameDevice = { device ->
                        renameText = device.name
                        deviceToRename = device
                    },
                    onRemoveDevice = { deviceToRemove = it },
                )
            }
        } else {
            // Tablet: two-column side by side
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                // Left column: tabs + form
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                ) {
                    TabRow(
                        tabs = TAB_LABELS,
                        selectedIndex = selectedTab,
                        onTabSelected = { selectedTab = it },
                    )

                    Spacer(Modifier.height(20.dp))

                    when (selectedTab) {
                        0 -> QrCodeTab(state = state, onScanQr = { launchScanner() })
                        1 -> PairCodeTab(state = state, viewModel = viewModel, onConnected = onConnected, onSharePairing = onSharePairing)
                        2 -> ManualAddressTab(state = state, viewModel = viewModel, onConnected = onConnected)
                    }

                    if (state.error != null) {
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = state.error!!,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }

                // Right column: saved devices + tips
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                ) {
                    if (state.savedDevices.isNotEmpty()) {
                        Text(
                            text = "Saved devices",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )

                        Spacer(Modifier.height(8.dp))

                        state.savedDevices.forEach { device ->
                            LastConnectedCard(
                                device = device,
                                isConnecting = state.isConnecting,
                                onClick = { viewModel.connectToSaved(device, onConnected) },
                                onRename = {
                                    renameText = device.name
                                    deviceToRename = device
                                },
                                onRemove = { deviceToRemove = device },
                            )
                            Spacer(Modifier.height(8.dp))
                        }

                        Spacer(Modifier.height(16.dp))
                    }

                    Text(
                        text = "Connection tips",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    Spacer(Modifier.height(8.dp))

                    ConnectionTip(Icons.Default.Devices, "Ensure both devices are online")
                    ConnectionTip(Icons.Default.Lan, "Devices can be on different networks")
                    ConnectionTip(Icons.Default.QrCodeScanner, "Use Pair Code if camera is unavailable")
                }
            }
        }
    }
}

@Composable
private fun PhoneConnectContent(
    state: ConnectUiState,
    viewModel: ConnectViewModel,
    selectedTab: Int,
    onTabSelected: (Int) -> Unit,
    onConnected: (AgentApi) -> Unit,
    onScanQr: () -> Unit,
    onSharePairing: (() -> Unit)?,
    onRenameDevice: (SavedDevice) -> Unit,
    onRemoveDevice: (SavedDevice) -> Unit,
) {
    TabRow(
        tabs = TAB_LABELS,
        selectedIndex = selectedTab,
        onTabSelected = onTabSelected,
        modifier = Modifier.padding(horizontal = 20.dp),
    )

    Spacer(Modifier.height(20.dp))

    when (selectedTab) {
        0 -> QrCodeTab(state = state, onScanQr = onScanQr)
        1 -> PairCodeTab(state = state, viewModel = viewModel, onConnected = onConnected, onSharePairing = onSharePairing)
        2 -> ManualAddressTab(state = state, viewModel = viewModel, onConnected = onConnected)
    }

    if (state.savedDevices.isNotEmpty()) {
        Spacer(Modifier.height(24.dp))

        Text(
            text = "Saved devices",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 20.dp),
        )

        Spacer(Modifier.height(8.dp))

        state.savedDevices.forEach { device ->
            LastConnectedCard(
                device = device,
                isConnecting = state.isConnecting,
                onClick = { viewModel.connectToSaved(device, onConnected) },
                onRename = { onRenameDevice(device) },
                onRemove = { onRemoveDevice(device) },
                modifier = Modifier.padding(horizontal = 20.dp),
            )
            Spacer(Modifier.height(8.dp))
        }
    }

    Spacer(Modifier.height(24.dp))

    Text(
        text = "Connection tips",
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 20.dp),
    )

    Spacer(Modifier.height(8.dp))

    ConnectionTip(Icons.Default.Devices, "Ensure both devices are online")
    ConnectionTip(Icons.Default.Lan, "Devices can be on different networks")
    ConnectionTip(Icons.Default.QrCodeScanner, "Use Pair Code if camera is unavailable")

    if (state.error != null) {
        Spacer(Modifier.height(12.dp))
        Text(
            text = state.error!!,
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
    }

    Spacer(Modifier.height(32.dp))
}

@Composable
private fun TabRow(
    tabs: List<String>,
    selectedIndex: Int,
    onTabSelected: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            tabs.forEachIndexed { index, label ->
                val isSelected = index == selectedIndex
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = if (isSelected) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.surfaceContainerHigh,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .clickable { onTabSelected(index) },
                ) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (isSelected) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 10.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun QrCodeTab(
    state: ConnectUiState,
    onScanQr: () -> Unit,
) {
    Column(
        modifier = Modifier.padding(horizontal = 20.dp),
    ) {
        Text(
            text = "Scan the QR code on the device you want to connect.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(20.dp))

        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surfaceContainerLow,
            modifier = Modifier
                .fillMaxWidth()
                .height(260.dp)
                .clip(RoundedCornerShape(20.dp))
                .clickable(enabled = !state.isConnecting, onClick = onScanQr),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.QrCodeScanner,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(16.dp))
                    Text(
                        text = "Tap to scan QR code",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun PairCodeTab(
    state: ConnectUiState,
    viewModel: ConnectViewModel,
    onConnected: (AgentApi) -> Unit,
    onSharePairing: (() -> Unit)?,
) {
    Column(
        modifier = Modifier.padding(horizontal = 20.dp),
    ) {
        // ── Enter Code Section ──
        Text(
            text = "Enter a code",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = "Enter the pairing code from the other device.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = state.pairingCode,
            onValueChange = viewModel::onPairingCodeChanged,
            label = { Text("Pairing Code") },
            placeholder = { Text("XXXX-XXXX-XXXX") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Text,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(
                onDone = { viewModel.submitPairingCode(onConnected) },
            ),
            modifier = Modifier.fillMaxWidth(),
            enabled = !state.isConnecting,
            shape = RoundedCornerShape(12.dp),
        )

        Spacer(Modifier.height(12.dp))

        Button(
            onClick = { viewModel.submitPairingCode(onConnected) },
            modifier = Modifier.fillMaxWidth().height(44.dp),
            enabled = !state.isConnecting && state.pairingCode.replace("-", "").length >= 8,
            shape = RoundedCornerShape(12.dp),
        ) {
            if (state.isConnecting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp,
                )
                Spacer(Modifier.width(8.dp))
                Text("Connecting…")
            } else {
                Text("Connect")
            }
        }

        if (onSharePairing != null) {
            // ── Divider ──
            Spacer(Modifier.height(24.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.weight(1f).height(1.dp).background(MaterialTheme.colorScheme.outlineVariant))
                Text(
                    text = "  OR  ",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Box(Modifier.weight(1f).height(1.dp).background(MaterialTheme.colorScheme.outlineVariant))
            }
            Spacer(Modifier.height(24.dp))

            // ── Share Your Code Section (opens PairScreen, which owns the pairing session) ──
            Text(
                text = "Share your code",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Show a QR code and pairing code so other devices can connect to you.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(12.dp))

            OutlinedButton(
                onClick = onSharePairing,
                modifier = Modifier.fillMaxWidth().height(44.dp),
                shape = RoundedCornerShape(12.dp),
            ) {
                Icon(
                    imageVector = Icons.Default.QrCodeScanner,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text("Share Pairing Info")
            }
        }
    }
}

@Composable
private fun ManualAddressTab(
    state: ConnectUiState,
    viewModel: ConnectViewModel,
    onConnected: (AgentApi) -> Unit,
) {
    Column(
        modifier = Modifier.padding(horizontal = 20.dp),
    ) {
        Text(
            text = "Enter the IP address and port of the device.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(20.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedTextField(
                value = state.host,
                onValueChange = viewModel::onHostChanged,
                label = { Text("IP Address") },
                placeholder = { Text("192.168.1.100") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Decimal,
                    imeAction = ImeAction.Next,
                ),
                modifier = Modifier.weight(2f),
                enabled = !state.isConnecting,
                shape = RoundedCornerShape(12.dp),
            )

            OutlinedTextField(
                value = state.port,
                onValueChange = viewModel::onPortChanged,
                label = { Text("Port") },
                placeholder = { Text("19742") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Number,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(
                    onDone = { viewModel.connect(onConnected) },
                ),
                modifier = Modifier.weight(1f),
                enabled = !state.isConnecting,
                shape = RoundedCornerShape(12.dp),
            )
        }

        Spacer(Modifier.height(16.dp))

        Button(
            onClick = { viewModel.connect(onConnected) },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            enabled = !state.isConnecting,
            shape = RoundedCornerShape(12.dp),
        ) {
            if (state.isConnecting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp,
                )
                Spacer(Modifier.width(8.dp))
                Text("Connecting…")
            } else {
                Text("Connect")
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LastConnectedCard(
    device: SavedDevice,
    isConnecting: Boolean,
    onClick: () -> Unit,
    onRename: () -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var showMenu by remember { mutableStateOf(false) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = modifier
            .fillMaxWidth()
            .combinedClickable(
                enabled = !isConnecting,
                onClick = onClick,
                onLongClick = { showMenu = true },
            ),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(44.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = deviceIcon(device),
                        contentDescription = null,
                        modifier = Modifier.size(22.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = device.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = formatLastConnected(device.lastConnected),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Box {
                IconButton(onClick = { showMenu = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = "Options", Modifier.size(18.dp))
                }
                DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                    DropdownMenuItem(
                        text = { Text("Rename") },
                        leadingIcon = { Icon(Icons.Default.Edit, null, Modifier.size(20.dp)) },
                        onClick = { showMenu = false; onRename() },
                    )
                    DropdownMenuItem(
                        text = { Text("Remove", color = MaterialTheme.colorScheme.error) },
                        leadingIcon = { Icon(Icons.Default.Delete, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.error) },
                        onClick = { showMenu = false; onRemove() },
                    )
                }
            }

            Spacer(Modifier.width(4.dp))

            Button(
                onClick = onClick,
                enabled = !isConnecting,
                shape = RoundedCornerShape(10.dp),
                contentPadding = ButtonDefaults.ContentPadding,
            ) {
                if (isConnecting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("Reconnect", style = MaterialTheme.typography.labelMedium)
                }
            }
        }
    }
}

@Composable
private fun ConnectionTip(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(10.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun RenameDeviceDialog(
    name: String,
    onNameChange: (String) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Rename Device") },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = onNameChange,
                label = { Text("Device Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = name.isNotBlank()) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

@Composable
private fun RemoveDeviceDialog(
    deviceName: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Remove Device") },
        text = { Text("Remove \"$deviceName\"? You can re-pair later.") },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("Remove", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

private fun scanOptions() = ScanOptions()
    .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
    .setPrompt("Scan QR code from StorageOS Desktop")
    .setBeepEnabled(false)
    .setOrientationLocked(true)

private fun deviceIcon(device: SavedDevice) = when {
    device.deviceType.contains("phone", ignoreCase = true) ||
        device.deviceType.contains("android", ignoreCase = true) -> Icons.Default.PhoneAndroid
    device.deviceType.contains("tablet", ignoreCase = true) -> Icons.Default.Tablet
    else -> Icons.Default.Computer
}

private val lastConnectedFormat = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())

private fun formatLastConnected(timestamp: Long): String {
    if (timestamp <= 0) return ""
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    return when {
        diff < 60_000 -> "just now"
        diff < 3600_000 -> "${diff / 60_000}m ago"
        diff < 86400_000 -> "${diff / 3600_000}h ago"
        else -> lastConnectedFormat.format(Date(timestamp))
    }
}

