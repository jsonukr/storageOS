package com.storageos.android.transfer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.storageos.android.MainActivity
import com.storageos.android.R

class TransferNotifications(private val context: Context) {

    private val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val progress = NotificationChannel(
                CHANNEL_PROGRESS,
                "Transfer Progress",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Shows progress for file transfers"
                setShowBadge(false)
            }
            val complete = NotificationChannel(
                CHANNEL_COMPLETE,
                "Transfer Complete",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Notifies when file transfers finish"
            }
            nm.createNotificationChannel(progress)
            nm.createNotificationChannel(complete)
        }
    }

    fun showProgress(jobId: String, fileName: String, progress: Int, speedText: String) {
        val id = notificationId(jobId)
        val builder = NotificationCompat.Builder(context, CHANNEL_PROGRESS)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("Downloading $fileName")
            .setContentText(speedText)
            .setProgress(100, progress, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openAppIntent())
            .setPriority(NotificationCompat.PRIORITY_LOW)
        nm.notify(id, builder.build())
    }

    fun showUploadProgress(jobId: String, fileName: String, progress: Int, speedText: String) {
        val id = notificationId(jobId)
        val builder = NotificationCompat.Builder(context, CHANNEL_PROGRESS)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle("Uploading $fileName")
            .setContentText(speedText)
            .setProgress(100, progress, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openAppIntent())
            .setPriority(NotificationCompat.PRIORITY_LOW)
        nm.notify(id, builder.build())
    }

    fun showComplete(jobId: String, fileName: String) {
        val id = notificationId(jobId)
        nm.cancel(id)
        val builder = NotificationCompat.Builder(context, CHANNEL_COMPLETE)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("Download complete")
            .setContentText(fileName)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        nm.notify(id + COMPLETE_OFFSET, builder.build())
    }

    fun showUploadComplete(jobId: String, fileName: String) {
        val id = notificationId(jobId)
        nm.cancel(id)
        val builder = NotificationCompat.Builder(context, CHANNEL_COMPLETE)
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle("Upload complete")
            .setContentText(fileName)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        nm.notify(id + COMPLETE_OFFSET, builder.build())
    }

    fun showFailed(jobId: String, fileName: String, error: String?) {
        val id = notificationId(jobId)
        nm.cancel(id)
        val builder = NotificationCompat.Builder(context, CHANNEL_COMPLETE)
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setContentTitle("Transfer failed")
            .setContentText("$fileName — ${error ?: "Unknown error"}")
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        nm.notify(id + COMPLETE_OFFSET, builder.build())
    }

    fun cancel(jobId: String) {
        val id = notificationId(jobId)
        nm.cancel(id)
        nm.cancel(id + COMPLETE_OFFSET)
    }

    private fun openAppIntent(): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        return PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    private fun notificationId(jobId: String): Int =
        (jobId.hashCode() and 0x7FFFFFFF) + NOTIFICATION_BASE

    companion object {
        const val CHANNEL_PROGRESS = "storageos_transfer_progress"
        const val CHANNEL_COMPLETE = "storageos_transfer_complete"
        private const val NOTIFICATION_BASE = 1000
        private const val COMPLETE_OFFSET = 500_000
    }
}
