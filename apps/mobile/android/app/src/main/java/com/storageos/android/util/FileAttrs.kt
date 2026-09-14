package com.storageos.android.util

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.io.File
import java.nio.file.Files
import java.nio.file.attribute.BasicFileAttributes

/** File metadata read in a SINGLE filesystem stat. */
data class QuickAttrs(
    val isDirectory: Boolean,
    val size: Long,
    val lastModified: Long, // epoch seconds
    val created: Long,      // epoch seconds
)

/**
 * Read all needed metadata for a directory entry with ONE stat, instead of the
 * ~8 separate `File.isDirectory/isFile/length/lastModified/isHidden/canWrite`
 * syscalls. For a photo folder with thousands of files that's the difference
 * between ~20s and a couple of seconds. Falls back to the classic calls if the
 * nio read fails.
 */
fun File.quickAttrs(): QuickAttrs {
    return try {
        val a = Files.readAttributes(toPath(), BasicFileAttributes::class.java)
        val dir = a.isDirectory
        QuickAttrs(
            isDirectory = dir,
            size = if (dir) 0L else a.size(),
            lastModified = a.lastModifiedTime().toMillis() / 1000,
            created = a.creationTime().toMillis() / 1000,
        )
    } catch (_: Exception) {
        val dir = isDirectory
        val m = lastModified() / 1000
        QuickAttrs(dir, if (dir) 0L else length(), m, m)
    }
}

/**
 * Read attributes for many files CONCURRENTLY. Android's per-file stat is slow
 * on FUSE-backed storage (~3-4ms each), so a 2-3k file folder takes ~10s
 * serially; fanning the reads out across Dispatchers.IO cuts that to ~1-2s.
 */
suspend fun List<File>.quickAttrsAll(): List<Pair<File, QuickAttrs>> = coroutineScope {
    map { f -> async(Dispatchers.IO) { f to f.quickAttrs() } }.awaitAll()
}
