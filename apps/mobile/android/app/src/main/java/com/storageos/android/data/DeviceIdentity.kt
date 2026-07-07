package com.storageos.android.data

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.bouncycastle.crypto.generators.Ed25519KeyPairGenerator
import org.bouncycastle.crypto.params.Ed25519KeyGenerationParameters
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.UUID

private const val PAIR_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

@Serializable
data class QrPayloadV2(
    val v: Int = 2,
    val id: String,
    val pk: String,
    val fp: String,
    val name: String,
    val code: String,
    val caps: List<String>,
    val relay: String? = null,
    val ts: Long,
    val sig: String? = null,
    val hint: QrLanHint? = null,
)

@Serializable
data class QrLanHint(
    val lan: String,
)

class DeviceIdentity(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("storageos_identity", Context.MODE_PRIVATE)

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    val deviceId: String get() = getOrCreate("device_id") { UUID.randomUUID().toString() }

    val publicKeyBase64: String get() {
        ensureKeypair()
        return prefs.getString("public_key_b64", "")!!
    }

    val fingerprint: String get() {
        ensureKeypair()
        return prefs.getString("fingerprint", "")!!
    }

    val displayName: String get() = Build.MODEL

    private fun ensureKeypair() {
        if (prefs.contains("private_key_hex")) return

        val gen = Ed25519KeyPairGenerator()
        gen.init(Ed25519KeyGenerationParameters(SecureRandom()))
        val pair = gen.generateKeyPair()

        val privKey = pair.private as Ed25519PrivateKeyParameters
        val pubKey = pair.public as Ed25519PublicKeyParameters

        val privHex = privKey.encoded.toHexString()
        val pubB64 = Base64.getEncoder().encodeToString(pubKey.encoded)
        val fp = computeFingerprint(pubKey.encoded)

        prefs.edit()
            .putString("private_key_hex", privHex)
            .putString("public_key_b64", pubB64)
            .putString("fingerprint", fp)
            .apply()
    }

    fun generatePairCode(): String {
        val bytes = ByteArray(12)
        SecureRandom().nextBytes(bytes)
        val sb = StringBuilder()
        for (b in bytes) {
            val idx = (b.toInt() and 0xFF) % PAIR_CODE_CHARSET.length
            sb.append(PAIR_CODE_CHARSET[idx])
        }
        return sb.toString()
    }

    fun formatPairCode(raw: String): String {
        val clean = raw.filter { it.isLetterOrDigit() }.uppercase()
        return if (clean.length >= 12) {
            "${clean.substring(0, 4)}-${clean.substring(4, 8)}-${clean.substring(8, 12)}"
        } else {
            clean
        }
    }

    fun generateQrPayload(pairCode: String, relayUrl: String?, lanHint: String?): String {
        ensureKeypair()
        val ts = System.currentTimeMillis() / 1000

        val payload = QrPayloadV2(
            id = deviceId,
            pk = publicKeyBase64,
            fp = fingerprint,
            name = displayName,
            code = formatPairCode(pairCode),
            caps = listOf("browse", "transfer"),
            relay = relayUrl,
            ts = ts,
            sig = sign("$deviceId|$publicKeyBase64|$fingerprint|$ts"),
            hint = lanHint?.let { QrLanHint(lan = it) },
        )

        return json.encodeToString(payload)
    }

    private fun sign(data: String): String? {
        val privHex = prefs.getString("private_key_hex", null) ?: return null
        val privBytes = privHex.hexToByteArray()
        val privKey = Ed25519PrivateKeyParameters(privBytes, 0)

        val signer = Ed25519Signer()
        signer.init(true, privKey)
        signer.update(data.toByteArray(Charsets.UTF_8), 0, data.toByteArray(Charsets.UTF_8).size)
        val sig = signer.generateSignature()

        return Base64.getEncoder().encodeToString(sig)
    }

    private fun getOrCreate(key: String, generator: () -> String): String {
        val existing = prefs.getString(key, null)
        if (existing != null) return existing
        val value = generator()
        prefs.edit().putString(key, value).apply()
        return value
    }

    private fun computeFingerprint(publicKeyBytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(publicKeyBytes)
        return hash.take(16).joinToString(":") { "%02x".format(it) }
    }

    private fun ByteArray.toHexString(): String =
        joinToString("") { "%02x".format(it) }

    private fun String.hexToByteArray(): ByteArray {
        val len = length
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            data[i / 2] = ((Character.digit(this[i], 16) shl 4) + Character.digit(this[i + 1], 16)).toByte()
            i += 2
        }
        return data
    }
}
