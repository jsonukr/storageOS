package com.storageos.android

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.content.ContextCompat
import com.storageos.android.server.StorageService
import com.storageos.android.ui.navigation.AppNavigation
import com.storageos.android.ui.theme.StorageOSTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        requestStorageAccess()
        startStorageService()

        setContent {
            StorageOSTheme {
                AppNavigation()
            }
        }
    }

    private fun requestStorageAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.data = Uri.parse("package:$packageName")
                startActivity(intent)
            }
        }
    }

    private fun startStorageService() {
        val intent = Intent(this, StorageService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }
}
