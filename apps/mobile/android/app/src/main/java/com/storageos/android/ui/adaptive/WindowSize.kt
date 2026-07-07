package com.storageos.android.ui.adaptive

import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.compositionLocalOf

val LocalWindowSizeClass = compositionLocalOf<WindowSizeClass> {
    error("WindowSizeClass not provided")
}

fun WindowSizeClass.isExpandedWidth(): Boolean =
    widthSizeClass == WindowWidthSizeClass.Expanded

fun WindowSizeClass.isMediumWidth(): Boolean =
    widthSizeClass == WindowWidthSizeClass.Medium

fun WindowSizeClass.isCompactWidth(): Boolean =
    widthSizeClass == WindowWidthSizeClass.Compact

fun WindowSizeClass.showNavigationRail(): Boolean =
    widthSizeClass != WindowWidthSizeClass.Compact
