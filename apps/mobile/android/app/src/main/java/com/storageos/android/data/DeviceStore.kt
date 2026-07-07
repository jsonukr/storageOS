package com.storageos.android.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID

@Serializable
data class SavedDevice(
    val deviceId: String,
    val host: String,
    val port: Int,
    val name: String,
    val systemName: String = "",
    val deviceType: String = "desktop",
    val platform: String = "",
    val version: String = "",
    val lastConnected: Long = System.currentTimeMillis(),
)

class DeviceStore(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("storageos_devices", Context.MODE_PRIVATE)

    private val json = Json { ignoreUnknownKeys = true }

    fun getOrCreateDeviceId(): String {
        val existing = prefs.getString(DEVICE_ID_KEY, null)
        if (existing != null) return existing
        val id = UUID.randomUUID().toString()
        prefs.edit().putString(DEVICE_ID_KEY, id).apply()
        return id
    }

    fun save(device: SavedDevice) {
        val devices = loadAll().toMutableList()
        devices.removeAll { it.deviceId == device.deviceId }
        devices.add(0, device.copy(lastConnected = System.currentTimeMillis()))
        prefs.edit().putString(KEY, json.encodeToString(devices)).apply()
    }

    fun remove(deviceId: String) {
        val devices = loadAll().toMutableList()
        devices.removeAll { it.deviceId == deviceId }
        prefs.edit().putString(KEY, json.encodeToString(devices)).apply()
    }

    fun findByDeviceId(deviceId: String): SavedDevice? {
        return loadAll().find { it.deviceId == deviceId }
    }

    fun loadAll(): List<SavedDevice> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return try {
            json.decodeFromString<List<SavedDevice>>(raw)
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun saveRelayUrl(url: String) {
        prefs.edit().putString(RELAY_URL_KEY, url).apply()
    }

    fun getRelayUrl(): String? {
        return prefs.getString(RELAY_URL_KEY, null)
    }

    fun clear() {
        prefs.edit().remove(KEY).apply()
    }

    companion object {
        private const val KEY = "paired_devices"
        private const val DEVICE_ID_KEY = "this_device_id"
        private const val RELAY_URL_KEY = "relay_url"
    }
}
