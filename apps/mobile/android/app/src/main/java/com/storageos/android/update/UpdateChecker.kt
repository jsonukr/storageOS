package com.storageos.android.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

@Serializable
private data class UpdateManifest(
    val android: AndroidUpdate? = null,
    val downloadUrl: String = "",
)

@Serializable
private data class AndroidUpdate(
    val version: String = "",
    val versionCode: Int = 0,
    val url: String = "",
    val notes: String = "",
)

data class UpdateInfo(
    val latestVersion: String,
    val currentVersion: String,
    val installUrl: String,   // direct APK asset
    val downloadUrl: String,  // website / releases page (fallback)
)

/**
 * Checks the relay's `/version` manifest, and (on request) downloads the update
 * APK and hands it to the system installer. Android always shows its own install
 * confirmation for sideloaded APKs — this just gets the file there.
 */
object UpdateChecker {
    private const val MANIFEST_URL = "https://storageos.onrender.com/version"
    private val json = Json { ignoreUnknownKeys = true }
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun check(context: Context): UpdateInfo? = withContext(Dispatchers.IO) {
        try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            @Suppress("DEPRECATION")
            val currentCode =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pInfo.longVersionCode.toInt()
                else pInfo.versionCode
            val currentName = pInfo.versionName ?: "0.0.0"

            client.newCall(Request.Builder().url(MANIFEST_URL).build()).execute().use { resp ->
                if (!resp.isSuccessful) return@withContext null
                val body = resp.body?.string() ?: return@withContext null
                val manifest = json.decodeFromString<UpdateManifest>(body)
                val a = manifest.android ?: return@withContext null
                if (a.versionCode > currentCode) {
                    UpdateInfo(
                        latestVersion = a.version.ifBlank { "a new version" },
                        currentVersion = currentName,
                        installUrl = a.url,
                        downloadUrl = manifest.downloadUrl,
                    )
                } else null
            }
        } catch (e: Exception) {
            null
        }
    }

    /** Streams the APK to internal cache, reporting 0..1 progress. Returns the file or null. */
    suspend fun downloadApk(context: Context, url: String, onProgress: (Float) -> Unit): File? =
        withContext(Dispatchers.IO) {
            try {
                val dir = File(context.cacheDir, "updates").apply { mkdirs() }
                val apk = File(dir, "StorageOS-update.apk")
                client.newCall(Request.Builder().url(url).build()).execute().use { resp ->
                    if (!resp.isSuccessful) return@withContext null
                    val body = resp.body ?: return@withContext null
                    val total = body.contentLength()
                    body.byteStream().use { input ->
                        apk.outputStream().use { output ->
                            val buf = ByteArray(64 * 1024)
                            var done = 0L
                            while (true) {
                                val n = input.read(buf)
                                if (n < 0) break
                                output.write(buf, 0, n)
                                done += n
                                if (total > 0) onProgress((done.toFloat() / total).coerceIn(0f, 1f))
                            }
                        }
                    }
                }
                if (apk.length() < 100_000) null else apk
            } catch (e: Exception) {
                null
            }
        }

    /**
     * Launches the system package installer for the downloaded APK. On Android 8+
     * the app first needs "install unknown apps"; if it isn't granted yet we send
     * the user to that settings screen (they grant it, then tap Install again).
     */
    fun installApk(context: Context, apk: File) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !context.packageManager.canRequestPackageInstalls()
        ) {
            runCatching {
                context.startActivity(
                    Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
            return
        }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apk)
        runCatching {
            context.startActivity(
                Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        }
    }
}

/**
 * A top banner shown when a newer build is available. "Install" downloads the
 * APK (with progress) and opens the system installer; "Later" dismisses it.
 * Renders nothing when up to date. Drop at the top of the app content column.
 */
@Composable
fun UpdateBanner() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var info by remember { mutableStateOf<UpdateInfo?>(null) }
    var dismissed by remember { mutableStateOf(false) }
    var downloading by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }

    LaunchedEffect(Unit) { info = UpdateChecker.check(context) }

    val update = info
    if (update == null || dismissed) return

    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = when {
                        failed -> "Update failed to download."
                        downloading -> "Downloading StorageOS ${update.latestVersion}…"
                        else -> "StorageOS ${update.latestVersion} is available (you have ${update.currentVersion})."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (downloading) {
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            if (!downloading) {
                Spacer(Modifier.width(8.dp))
                if (failed) {
                    TextButton(onClick = {
                        if (update.downloadUrl.isNotBlank()) {
                            runCatching {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(update.downloadUrl)))
                            }
                        }
                        dismissed = true
                    }) { Text("Website") }
                    TextButton(onClick = { dismissed = true }) { Text("Later") }
                } else {
                    TextButton(onClick = {
                        if (update.installUrl.isBlank()) {
                            if (update.downloadUrl.isNotBlank()) {
                                runCatching {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(update.downloadUrl)))
                                }
                            }
                            return@TextButton
                        }
                        downloading = true
                        failed = false
                        scope.launch {
                            val apk = UpdateChecker.downloadApk(context, update.installUrl) { progress = it }
                            downloading = false
                            if (apk != null) UpdateChecker.installApk(context, apk) else failed = true
                        }
                    }) { Text("Install") }
                    TextButton(onClick = { dismissed = true }) { Text("Later") }
                }
            }
        }
    }
}
