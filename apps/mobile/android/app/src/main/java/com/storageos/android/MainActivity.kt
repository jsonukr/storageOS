package com.storageos.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.storageos.android.ui.navigation.AppNavigation
import com.storageos.android.ui.theme.StorageOSTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            StorageOSTheme {
                AppNavigation()
            }
        }
    }
}
