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
    secondary = Color(0xFF545F70),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFDDE5F0),
    onSecondaryContainer = Color(0xFF151C24),
    tertiary = Color(0xFF6B5778),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFF2DAFF),
    onTertiaryContainer = Color(0xFF251431),
    surface = Color(0xFFF8F8FA),
    surfaceContainer = Color.White,
    surfaceContainerLow = Color(0xFFF5F5F7),
    surfaceContainerHigh = Color(0xFFEFEFF1),
    surfaceContainerHighest = Color(0xFFE8E8EA),
    onSurface = Color(0xFF1A1A1A),
    onSurfaceVariant = Color(0xFF5A5A5A),
    outline = Color(0xFFD0D0D0),
    outlineVariant = Color(0xFFE8E8E8),
    error = Color(0xFFDC2626),
    onError = Color.White,
    errorContainer = Color(0xFFFDE7E9),
    onErrorContainer = Color(0xFF410002),
    inverseSurface = Color(0xFF2E2E2E),
    inverseOnSurface = Color(0xFFF0F0F0),
    inversePrimary = Color(0xFF9ECAFF),
    surfaceTint = Blue,
)

private val DarkColors = darkColorScheme(
    primary = BlueDark,
    onPrimary = Color(0xFF003258),
    primaryContainer = Color(0xFF004A77),
    onPrimaryContainer = Color(0xFFCDE5FF),
    secondary = Color(0xFFBBC7DB),
    onSecondary = Color(0xFF263141),
    secondaryContainer = Color(0xFF3B4858),
    onSecondaryContainer = Color(0xFFD4E2F4),
    tertiary = Color(0xFFD7BDE3),
    onTertiary = Color(0xFF3B2948),
    tertiaryContainer = Color(0xFF533F5F),
    onTertiaryContainer = Color(0xFFF2DAFF),
    surface = Color(0xFF1C1C1E),
    surfaceContainer = Color(0xFF2C2C2E),
    surfaceContainerLow = Color(0xFF242426),
    surfaceContainerHigh = Color(0xFF3A3A3C),
    surfaceContainerHighest = Color(0xFF444446),
    onSurface = Color(0xFFE5E5E7),
    onSurfaceVariant = Color(0xFF9E9EA0),
    outline = Color(0xFF48484A),
    outlineVariant = Color(0xFF38383A),
    error = Color(0xFFEF4444),
    onError = Color.White,
    errorContainer = Color(0xFF442726),
    onErrorContainer = Color(0xFFFFDAD6),
    inverseSurface = Color(0xFFE5E5E7),
    inverseOnSurface = Color(0xFF2E2E2E),
    inversePrimary = Color(0xFF0060A9),
    surfaceTint = BlueDark,
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
        typography = StorageOSTypography,
        shapes = StorageOSShapes,
        content = content,
    )
}
