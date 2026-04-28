package com.ajibolagbenga.pulsechat;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class PushNotificationService extends FirebaseMessagingService {
    private static final String TAG = "PushNotifService";
    private static final String CHANNEL_MESSAGES = "messages";
    private static final String CHANNEL_CALLS = "calls";
    private static final String CHANNEL_GENERAL = "general";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        String title = "Pulse Chat";
        String body = "You have a new notification";

        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null)
                title = remoteMessage.getNotification().getTitle();
            if (remoteMessage.getNotification().getBody() != null)
                body = remoteMessage.getNotification().getBody();
        } else if (!data.isEmpty()) {
            if (data.containsKey("title")) title = data.get("title");
            if (data.containsKey("body")) body = data.get("body");
        }

        String channelId = determineChannel(data);
        showNotification(title, body, channelId, data);
    }

    private String determineChannel(Map<String, String> data) {
        String type = data.get("type");
        if ("call".equals(type) || "incoming_call".equals(type)) return CHANNEL_CALLS;
        if ("message".equals(type) || "chat".equals(type)) return CHANNEL_MESSAGES;
        return CHANNEL_GENERAL;
    }

    private void showNotification(String title, String body, String channelId, Map<String, String> data) {
        Context context = getApplicationContext();

        // Wake the screen
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "PulseChat::WakeLock"
            );
            wl.acquire(CHANNEL_CALLS.equals(channelId) ? 30000 : 5000);
            wl.release();
        }

        // Main intent
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        if (data != null) {
            for (Map.Entry<String, String> e : data.entrySet()) {
                intent.putExtra(e.getKey(), e.getValue());
            }
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri soundUri = RingtoneManager.getDefaultUri(
            CHANNEL_CALLS.equals(channelId) ? RingtoneManager.TYPE_RINGTONE : RingtoneManager.TYPE_NOTIFICATION
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL);

        if (CHANNEL_CALLS.equals(channelId)) {
            // Answer action
            Intent answerIntent = new Intent(context, CallActionReceiver.class);
            answerIntent.setAction("ANSWER_CALL");
            if (data != null) for (Map.Entry<String, String> e : data.entrySet()) answerIntent.putExtra(e.getKey(), e.getValue());
            PendingIntent answerPI = PendingIntent.getBroadcast(context, 1, answerIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            // Decline action
            Intent declineIntent = new Intent(context, CallActionReceiver.class);
            declineIntent.setAction("DECLINE_CALL");
            if (data != null) for (Map.Entry<String, String> e : data.entrySet()) declineIntent.putExtra(e.getKey(), e.getValue());
            PendingIntent declinePI = PendingIntent.getBroadcast(context, 2, declineIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            builder.setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pendingIntent, true)
                .setOngoing(true)
                .setTimeoutAfter(30000)
                .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
                .addAction(R.mipmap.ic_launcher, "Decline", declinePI)
                .addAction(R.mipmap.ic_launcher, "Answer", answerPI);
        }

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        int notifId = CHANNEL_CALLS.equals(channelId) ? 999 : (int) System.currentTimeMillis();
        if (nm != null) nm.notify(notifId, builder.build());
        Log.d(TAG, "Notification shown: " + title);
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            NotificationChannel messages = new NotificationChannel(CHANNEL_MESSAGES, "Messages", NotificationManager.IMPORTANCE_HIGH);
            messages.setDescription("New message notifications");
            messages.enableVibration(true);
            messages.setShowBadge(true);
            nm.createNotificationChannel(messages);

            NotificationChannel calls = new NotificationChannel(CHANNEL_CALLS, "Calls", NotificationManager.IMPORTANCE_HIGH);
            calls.setDescription("Incoming call notifications");
            calls.enableVibration(true);
            calls.setShowBadge(true);
            calls.setBypassDnd(true);
            nm.createNotificationChannel(calls);

            NotificationChannel general = new NotificationChannel(CHANNEL_GENERAL, "General", NotificationManager.IMPORTANCE_DEFAULT);
            general.setDescription("General notifications");
            general.enableVibration(true);
            nm.createNotificationChannel(general);
        }
    }
}
