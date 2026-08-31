package com.storageos.android.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
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
    val notes: String = "",
)

data class UpdateInfo(
    val latestVersion: String,
    val currentVersion: String,
    val downloadUrl: String,
)

/**
 * Checks the relay's `/version` manifest and reports whether a newer APK is
 * available. It never downloads or installs anything — the UI simply links the
 * user to the download website.
 */
object UpdateChecker {
    private const val MANIFEST_URL = "https://storageos.onrender.com/version"
    private val json = Json { ignoreUnknownKeys = true }
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    /** Returns update info when the manifest's android.versionCode is newer; null otherwise or on any error. */
    suspend fun check(context: Context): UpdateInfo? = withContext(Dispatchers.IO) {
        try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            @Suppress("DEPRECATION")
            val currentCode =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pInfo.longVersionCode.toInt()
                else pInfo.versionCode
            val currentName = pInfo.versionName ?: "0.0.0"

            val request = Request.Builder().url(MANIFEST_URL).build()
            client.newCall(request).execute().use { resp ->
                if (!resp.isSuccessful) return@withContext null
                val body = resp.body?.string() ?: return@withContext null
                val manifest = json.decodeFromString<UpdateManifest>(body)
                val a = manifest.android ?: return@withContext null
                if (a.versionCode > currentCode) {
                    UpdateInfo(
                        latestVersion = a.version.ifBlank { "a new version" },
                        currentVersion = currentName,
                        downloadUrl = manifest.downloadUrl,
                    )
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            null
        }
    }
}

/**
 * Runs the update check once on entry and, if a newer build exists, shows a
 * dialog that links to the download website. Drop into the top-level composable.
 */
@Composable
fun UpdateGate() {
    val context = LocalContext.current
    var info by remember { mutableStateOf<UpdateInfo?>(null) }
    var dismissed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        info = UpdateChecker.check(context)
    }

    val update = info
    if (update != null && !dismissed) {
        AlertDialog(
            onDismissRequest = { dismissed = true },
            title = { Text("Update available") },
            text = {
                Text(
                    "StorageOS ${update.latestVersion} is available (you have " +
                        "${update.currentVersion}). Please download the latest version " +
                        "from the website and install it."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    if (update.downloadUrl.isNotBlank()) {
                        runCatching {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, Uri.parse(update.downloadUrl))
                            )
                        }
                    }
                    dismissed = true
                }) { Text("Download") }
            },
            dismissButton = {
                TextButton(onClick = { dismissed = true }) { Text("Later") }
            },
        )
    }
}
