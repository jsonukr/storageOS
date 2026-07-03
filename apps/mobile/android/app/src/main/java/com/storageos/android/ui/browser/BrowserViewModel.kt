package com.storageos.android.ui.browser

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.storageos.android.api.AgentApi
import com.storageos.android.api.DirectoryEntry
import com.storageos.android.api.DriveInfo
import com.storageos.android.api.MkdirRequest
import com.storageos.android.api.RenameRequest
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
)

class BrowserViewModel : ViewModel() {

    private val _state = MutableStateFlow(BrowserUiState())
    val state: StateFlow<BrowserUiState> = _state.asStateFlow()

    private var api: AgentApi? = null
    var agentBaseUrl: String = ""
        private set

    fun init(agentApi: AgentApi, baseUrl: String = "") {
        if (api != null) return
        api = agentApi
        agentBaseUrl = baseUrl
        loadRoots()
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
        _state.value = _state.value.copy(isLoading = true, error = null, currentPath = path, pathHistory = history)
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
