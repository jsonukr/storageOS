package com.storageos.android.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val Blue = Color(0xFF0078D4)
private val BlueDark = Color(0xFF60CDFF)

private val LightColors = lightColorScheme(
    primary = Blue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD4E8FF),
    onPrimaryContainer = Color(0xFF001D36),
    secondaryContainer = Color(0xFFDDE5F0),
    onSecondaryContainer = Color(0xFF151C24),
    surface = Color(0xFFF8F8FA),
    surfaceContainer = Color.White,
    surfaceContainerHigh = Color(0xFFF2F4F6),
    onSurface = Color(0xFF1A1A1A),
    onSurfaceVariant = Color(0xFF5A5A5A),
    outline = Color(0xFFD8D8D8),
    outlineVariant = Color(0xFFEEEEEE),
    error = Color(0xFFDC2626),
    onError = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = BlueDark,
    onPrimary = Color(0xFF003258),
    primaryContainer = Color(0xFF004A77),
    onPrimaryContainer = Color(0xFFCDE5FF),
    secondaryContainer = Color(0xFF3B4858),
    onSecondaryContainer = Color(0xFFD4E2F4),
    surface = Color(0xFF1C1C1E),
    surfaceContainer = Color(0xFF2C2C2E),
    surfaceContainerHigh = Color(0xFF3A3A3C),
    onSurface = Color(0xFFE5E5E7),
    onSurfaceVariant = Color(0xFF9E9EA0),
    outline = Color(0xFF48484A),
    outlineVariant = Color(0xFF38383A),
    error = Color(0xFFEF4444),
    onError = Color.White,
)

@Composable
fun StorageOSTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
