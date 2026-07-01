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
    surface = Color(0xFFF3F3F3),
    surfaceContainer = Color.White,
    surfaceContainerHigh = Color(0xFFF9F9F9),
    onSurface = Color(0xFF1A1A1A),
    onSurfaceVariant = Color(0xFF606060),
    outline = Color(0xFFE0E0E0),
    outlineVariant = Color(0xFFF0F0F0),
)

private val DarkColors = darkColorScheme(
    primary = BlueDark,
    onPrimary = Color(0xFF003258),
    surface = Color(0xFF202020),
    surfaceContainer = Color(0xFF2D2D2D),
    surfaceContainerHigh = Color(0xFF383838),
    onSurface = Color(0xFFE4E4E4),
    onSurfaceVariant = Color(0xFF9E9E9E),
    outline = Color(0xFF404040),
    outlineVariant = Color(0xFF333333),
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
