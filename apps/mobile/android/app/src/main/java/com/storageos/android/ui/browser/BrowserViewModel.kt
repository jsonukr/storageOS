package com.storageos.android.ui.browser

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.storageos.android.api.AgentApi
import com.storageos.android.api.DirectoryEntry
import com.storageos.android.api.DriveInfo
import com.storageos.android.api.MkdirRequest
import com.storageos.android.api.RenameRequest
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface BrowserContent {
    data class Drives(val drives: List<DriveInfo>) : BrowserContent
    data class Directory(val entries: List<DirectoryEntry>) : BrowserContent
}

data class BrowserUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val content: BrowserContent? = null,
    val currentPath: String? = null,
    val pathHistory: List<String> = emptyList(),
    val previewImages: List<DirectoryEntry> = emptyList(),
    val previewIndex: Int = -1,
    val videoEntry: DirectoryEntry? = null,
    val searchActive: Boolean = false,
    val searchQuery: String = "",
    val isSearchResults: Boolean = false,
)

class BrowserViewModel : ViewModel() {

    private val _state = MutableStateFlow(BrowserUiState())
    val state: StateFlow<BrowserUiState> = _state.asStateFlow()

    private var api: AgentApi? = null
    private var pollJob: Job? = null
    var agentBaseUrl: String = ""
        private set

    fun init(agentApi: AgentApi, baseUrl: String = "") {
        // Re-initialize whenever a *different* connection is handed in. Using a
        // plain `if (api != null) return` guard meant that after disconnecting
        // and reconnecting (or connecting to another device) the browser kept
        // showing the previous connection's drives and files.
        if (api === agentApi) return
        api = agentApi
        agentBaseUrl = baseUrl
        loadRoots()
        startAutoRefresh()
    }

    /** Drop the active connection and clear all cached content. */
    fun reset() {
        pollJob?.cancel()
        pollJob = null
        api = null
        agentBaseUrl = ""
        _state.value = BrowserUiState()
    }

    /**
     * Poll the current directory in the background so changes made on the other
     * device (or by another app) show up without a manual reload. Silent: it
     * never toggles the loading state and only swaps content when it actually
     * changed, so it won't flicker or fight the user.
     */
    private fun startAutoRefresh() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (true) {
                delay(5_000)
                silentRefresh()
            }
        }
    }

    private suspend fun silentRefresh() {
        val client = api ?: return
        val s = _state.value
        val path = s.currentPath ?: return
        if (s.isLoading || s.searchActive || s.isSearchResults || s.previewIndex >= 0 || s.videoEntry != null) return
        val current = (s.content as? BrowserContent.Directory)?.entries ?: return
        if (current.size > 800) return // don't re-list very large folders every few seconds
        try {
            val entries = client.directory(path)
            if (_state.value.currentPath != path) return // navigated away mid-fetch
            val sorted = entries.sortedWith(
                compareByDescending<DirectoryEntry> { it.isDirectory }
                    .thenBy(String.CASE_INSENSITIVE_ORDER) { it.name }
            )
            val stillCurrent = (_state.value.content as? BrowserContent.Directory)?.entries
            if (stillCurrent != null && sorted != stillCurrent &&
                !_state.value.isSearchResults && _state.value.previewIndex < 0
            ) {
                _state.value = _state.value.copy(content = BrowserContent.Directory(sorted))
            }
        } catch (_: Exception) {
            // transient failure — try again next tick
        }
    }

    fun loadRoots() {
        val client = api ?: return
        _state.value = BrowserUiState(isLoading = true)
        viewModelScope.launch {
            try {
                val drives = client.roots()
                _state.value = BrowserUiState(
                    isLoading = false,
                    content = BrowserContent.Drives(drives),
                    currentPath = null,
                    pathHistory = emptyList(),
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Failed to load drives: ${e.message}",
                )
            }
        }
    }

    fun openSearch() {
        _state.value = _state.value.copy(searchActive = true)
    }

    fun onSearchQueryChange(query: String) {
        _state.value = _state.value.copy(searchQuery = query)
    }

    fun closeSearch() {
        val wasResults = _state.value.isSearchResults
        _state.value = _state.value.copy(searchActive = false, searchQuery = "", isSearchResults = false)
        if (wasResults) refresh()
    }

    fun runSearch() {
        val client = api ?: return
        val path = _state.value.currentPath ?: return
        val query = _state.value.searchQuery.trim()
        if (query.isBlank()) return
        _state.value = _state.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val results = client.search(path, query, true)
                val sorted = results.sortedWith(
                    compareByDescending<DirectoryEntry> { it.isDirectory }
                        .thenBy(String.CASE_INSENSITIVE_ORDER) { it.name }
                )
                _state.value = _state.value.copy(
                    isLoading = false,
                    content = BrowserContent.Directory(sorted),
                    isSearchResults = true,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Search failed: ${e.message}",
                )
            }
        }
    }

    fun openDrive(drive: DriveInfo) {
        val path = "${drive.letter}:\\"
        navigateTo(path, pushHistory = false)
    }

    fun openEntry(entry: DirectoryEntry) {
        if (!entry.isDirectory) return
        navigateTo(entry.fullPath, pushHistory = true)
    }

    fun navigateToPath(path: String) {
        loadDirectory(path, emptyList())
    }

    fun refresh() {
        val current = _state.value
        if (current.currentPath != null) {
            loadDirectory(current.currentPath!!, current.pathHistory)
        } else {
            loadRoots()
        }
    }

    fun goBack(): Boolean {
        val current = _state.value
        if (current.searchActive || current.isSearchResults) {
            closeSearch()
            return true
        }
        if (current.pathHistory.isEmpty()) {
            if (current.currentPath != null) {
                loadRoots()
                return true
            }
            return false
        }
        val previous = current.pathHistory.last()
        val newHistory = current.pathHistory.dropLast(1)
        _state.value = current.copy(pathHistory = newHistory)
        loadDirectory(previous, newHistory)
        return true
    }

    private fun navigateTo(path: String, pushHistory: Boolean) {
        val current = _state.value
        val newHistory = if (pushHistory && current.currentPath != null) {
            current.pathHistory + current.currentPath
        } else if (!pushHistory && current.currentPath != null) {
            listOf()
        } else {
            current.pathHistory
        }
        loadDirectory(path, newHistory)
    }

    private fun loadDirectory(path: String, history: List<String>) {
        val client = api ?: return
        _state.value = _state.value.copy(
            isLoading = true, error = null, currentPath = path, pathHistory = history,
            searchActive = false, searchQuery = "", isSearchResults = false,
        )
        viewModelScope.launch {
            try {
                val entries = client.directory(path)
                val sorted = entries.sortedWith(
                    compareByDescending<DirectoryEntry> { it.isDirectory }
                        .thenBy(String.CASE_INSENSITIVE_ORDER) { it.name }
                )
                _state.value = _state.value.copy(
                    isLoading = false,
                    content = BrowserContent.Directory(sorted),
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = friendlyError(e, path),
                )
            }
        }
    }

    fun openImage(entry: DirectoryEntry) {
        val content = _state.value.content
        if (content !is BrowserContent.Directory) return
        val images = content.entries.filter { it.isImage() }
        val index = images.indexOfFirst { it.fullPath == entry.fullPath }
        if (index >= 0) {
            _state.value = _state.value.copy(previewImages = images, previewIndex = index)
        }
    }

    fun closePreview() {
        _state.value = _state.value.copy(previewImages = emptyList(), previewIndex = -1)
    }

    fun openVideo(entry: DirectoryEntry) {
        if (entry.isDirectory) return
        _state.value = _state.value.copy(videoEntry = entry)
    }

    fun closeVideo() {
        _state.value = _state.value.copy(videoEntry = null)
    }

    private fun DirectoryEntry.isImage(): Boolean =
        !isDirectory && extension.lowercase() in setOf("jpg", "jpeg", "png", "gif", "bmp", "webp")

    fun createFolder(name: String, onResult: (Boolean, String?) -> Unit) {
        val client = api ?: return
        val path = _state.value.currentPath ?: return
        viewModelScope.launch {
            try {
                client.mkdir(MkdirRequest(parent = path, name = name))
                refresh()
                onResult(true, null)
            } catch (e: Exception) {
                onResult(false, e.message ?: "Failed to create folder")
            }
        }
    }

    fun renameEntry(entry: DirectoryEntry, newName: String, onResult: (Boolean, String?) -> Unit) {
        val client = api ?: return
        viewModelScope.launch {
            try {
                client.rename(RenameRequest(path = entry.fullPath, newName = newName))
                refresh()
                onResult(true, null)
            } catch (e: Exception) {
                onResult(false, e.message ?: "Failed to rename")
            }
        }
    }

    fun deleteEntries(entries: List<DirectoryEntry>, onResult: (Boolean, String?) -> Unit) {
        val client = api ?: return
        viewModelScope.launch {
            try {
                for (entry in entries) {
                    client.deleteEntry(entry.fullPath)
                }
                refresh()
                onResult(true, null)
            } catch (e: Exception) {
                onResult(false, e.message ?: "Failed to delete")
            }
        }
    }

    private fun friendlyError(e: Exception, path: String): String {
        val msg = e.message ?: "Unknown error"
        return when {
            "NOT_FOUND" in msg || "404" in msg -> "Folder not found: $path"
            "PERMISSION_DENIED" in msg || "403" in msg -> "Access denied: $path"
            e is java.net.ConnectException -> "Lost connection to Agent"
            e is java.net.SocketTimeoutException -> "Request timed out"
            else -> "Failed to load: $msg"
        }
    }
}
