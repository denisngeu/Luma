package expo.modules.lumacallservice

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

// This service protects the existing WebRTC capture. It never creates another
// recorder, stores audio, or restarts microphone access after process death.
class LumaCallService : Service() {
  private var owner: String? = null

  companion object {
    const val CHANNEL = "luma-active-call"
    const val NOTIFICATION = 7140
    const val STOPPED = "app.luma.messenger.CALL_SERVICE_STOPPED"
    const val READY = "app.luma.messenger.CALL_SERVICE_READY"
    const val END = "app.luma.messenger.END_CALL"
    @Volatile var currentToken: String? = null
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null) { stopSelf(startId); return START_NOT_STICKY }
    val token = intent.getStringExtra("token")
    if (token.isNullOrEmpty() || token != currentToken) { stopSelf(startId); return START_NOT_STICKY }
    owner = token
    if (intent.action == END) {
      stopSelf()
      return START_NOT_STICKY
    }
    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      stopSelf()
      return START_NOT_STICKY
    }
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL, "Appels en cours", NotificationManager.IMPORTANCE_LOW))
    }
    val reopen = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val openIntent = reopen?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) }
    val endIntent = Intent(this, LumaCallService::class.java).setAction(END).putExtra("token", token)
    val endPending = PendingIntent.getService(this, 1, endIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    builder.setSmallIcon(android.R.drawable.stat_sys_phone_call).setContentTitle("Appel Luma en cours")
      .setContentText("Le microphone reste actif pendant cet appel.")
      .setCategory(Notification.CATEGORY_CALL).setOngoing(true).setOnlyAlertOnce(true)
      .addAction(Notification.Action.Builder(null, "Raccrocher", endPending).build())
    if (openIntent != null) builder.setContentIntent(openIntent)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        var types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
          if (intent.getBooleanExtra("camera", false) && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
          }
        }
        startForeground(NOTIFICATION, builder.build(), types)
      } else startForeground(NOTIFICATION, builder.build())
      sendBroadcast(Intent(READY).setPackage(packageName).putExtra("token", token))
    } catch (_: RuntimeException) { stopSelf() }
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) { stopSelf() }

  override fun onDestroy() {
    val token = owner
    if (currentToken == token) currentToken = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
    else @Suppress("DEPRECATION") stopForeground(true)
    if (token != null) sendBroadcast(Intent(STOPPED).setPackage(packageName).putExtra("token", token))
    super.onDestroy()
  }
}
