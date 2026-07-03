package com.storageos.android.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class HealthResponse(
    val status: String,
    @SerialName("uptime_secs") val uptimeSecs: Long,
    val version: String,
    val platform: String,
    @SerialName("device_id") val deviceId: String = "",
)

@Serializable
data class DriveInfo(
    val letter: String,
    val label: String,
    @SerialName("drive_type") val driveType: String,
    @SerialName("total_bytes") val totalBytes: Long,
    @SerialName("free_bytes") val freeBytes: Long,
    @SerialName("used_bytes") val usedBytes: Long,
    @SerialName("file_system") val fileSystem: String,
    @SerialName("is_removable") val isRemovable: Boolean,
    @SerialName("is_ready") val isReady: Boolean,
)

@Serializable
data class DirectoryEntry(
    val name: String,
    @SerialName("full_path") val fullPath: String,
    @SerialName("is_directory") val isDirectory: Boolean,
    val size: Long,
    @SerialName("last_modified") val lastModified: Long,
    @SerialName("date_created") val dateCreated: Long,
    val hidden: Boolean,
    val readonly: Boolean,
    val extension: String,
)

@Serializable
data class ErrorResponse(
    val code: String,
    val message: String,
)

@Serializable
data class PairDeviceRequest(
    @SerialName("device_id") val deviceId: String,
    @SerialName("system_name") val systemName: String,
    @SerialName("device_type") val deviceType: String,
    val platform: String,
    val version: String,
    val address: String,
    @SerialName("pairing_token") val pairingToken: String,
)

@Serializable
data class MkdirRequest(
    val parent: String,
    val name: String,
)

@Serializable
data class RenameRequest(
    val path: String,
    @SerialName("new_name") val newName: String,
)

@Serializable
data class OperationResponse(
    val success: Boolean,
    val path: String,
)

@Serializable
data class PairDeviceResponse(
    @SerialName("device_id") val deviceId: String,
    @SerialName("system_name") val systemName: String,
    @SerialName("device_type") val deviceType: String,
    val platform: String,
    val version: String,
    val address: String,
    val paired: Boolean,
)
