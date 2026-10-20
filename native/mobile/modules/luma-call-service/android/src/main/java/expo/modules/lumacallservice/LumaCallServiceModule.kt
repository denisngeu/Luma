package expo.modules.lumacallservice

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LumaCallServiceModule : Module() {
  private var receiver: BroadcastReceiver? = null
  private var registeredContext: Context? = null
  private val starts = java.util.concurrent.ConcurrentHashMap<String, Promise>()
  private val handler = Handler(Looper.getMainLooper())
  private val context: Context get() = requireNotNull(appContext.reactContext) { "Application indisponible." }

  override fun definition() = ModuleDefinition {
    Name("LumaCallService")
    Events("onCallEnded")
    OnCreate {
      receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (intent == null) return
          val token = intent.getStringExtra("token") ?: return
          if (intent.action == LumaCallService.READY) {
            starts.remove(token)?.resolve()
            return
          }
          starts.remove(token)?.reject("CALL_SERVICE_STOPPED", "Le service d’appel Android n’a pas pu démarrer.", null)
          sendEvent("onCallEnded", mapOf("token" to token))
        }
      }
      val filter = IntentFilter(LumaCallService.STOPPED)
      filter.addAction(LumaCallService.READY)
      registeredContext = context
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      else @Suppress("DEPRECATION") context.registerReceiver(receiver, filter)
    }
    AsyncFunction("start") { token: String, camera: Boolean, promise: Promise ->
      require(token.length in 1..120) { "Identifiant d’appel invalide." }
      check(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { "Autorisez le microphone avant de rejoindre l’appel." }
      check(appContext.currentActivity != null) { "Ouvrez Luma avant de rejoindre l’appel." }
      LumaCallService.currentToken = token
      starts.put(token, promise)?.reject("CALL_SERVICE_REPLACED", "Cette demande a été remplacée.", null)
      val intent = Intent(context, LumaCallService::class.java).putExtra("token", token).putExtra("camera", camera)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      } catch (error: Exception) {
        if (LumaCallService.currentToken == token) LumaCallService.currentToken = null
        starts.remove(token)?.reject("CALL_SERVICE_START_FAILED", "Impossible de maintenir cet appel Android en arrière-plan.", error)
      }
      handler.postDelayed({
        if (starts.remove(token, promise)) {
          promise.reject("CALL_SERVICE_TIMEOUT", "Le service d’appel Android ne répond pas.", null)
          if (LumaCallService.currentToken == token) {
            LumaCallService.currentToken = null
            registeredContext?.let { it.stopService(Intent(it, LumaCallService::class.java)) }
          }
        }
      }, 5000)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stop") { token: String ->
      starts.remove(token)?.reject("CALL_SERVICE_CANCELLED", "Appel terminé.", null)
      if (LumaCallService.currentToken == token) {
        LumaCallService.currentToken = null
        context.stopService(Intent(context, LumaCallService::class.java))
      }
    }.runOnQueue(Queues.MAIN)
    OnDestroy {
      val savedContext = registeredContext
      if (savedContext != null) receiver?.let { savedContext.unregisterReceiver(it) }; receiver = null
      LumaCallService.currentToken = null
      savedContext?.stopService(Intent(savedContext, LumaCallService::class.java))
      starts.values.forEach { it.reject("CALL_SERVICE_DESTROYED", "Luma a fermé le service d’appel.", null) }; starts.clear()
      handler.removeCallbacksAndMessages(null); registeredContext = null
    }
  }
}
