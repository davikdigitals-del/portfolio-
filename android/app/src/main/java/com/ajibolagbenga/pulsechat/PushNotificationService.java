package com.ajibolagbenga.pulsechat;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Firebase Cloud Messaging Service
 * Handles push notifications when app is in background or killed
 * This ensures notifications work like WhatsApp, Telegram, etc.
 */
public class PushNotificationService extends FirebaseMessagingService {
    private static final String TAG = "PushNotificationService";
    
    // Notification channels
    private static final String CHANNEL_MESSAGES = "messages";
    private static final String CHANNEL_CALLS = "calls";
    private static final String CHANNEL_GENERAL = "general";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    /**
     * Called when a new FCM token is generated
     * Send this token to your backend to enable push notifications
     */
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token);
        
        // TODO: Send token to your backend server
        // You can use Capacitor's PushNotifications.addListener('registration') for this
    }

    /**
     * Called when a push notification is received while app is in background or killed
     * This is what makes notifications work even when app is closed
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());

        // Check if message contains data payload
        Map<String, String> data = remoteMessage.getData();
        if (!data.isEmpty()) {
            Log.d(TAG, "Message data payload: " + data);
            handleDataMessage(data);
        }

        // Check if message contains notification payload
        if (remoteMessage.getNotification() != null) {
            String title = remoteMessage.getNotification().getTitle();
            String body = remoteMessage.getNotification().getBody();
            Log.d(TAG, "Message Notification: " + title + " - " + body);
            
            // Determine channel based on data
            String channelId = determineChannel(data);
            showNotification(title, body, channelId, data);
        }
    }

    /**
     * Handle data-only messages (no notification payload)
     */
    private void handleDataMessage(Map<String, String> data) {
        String title = data.get("title");
        String body = data.get("body");
        String type = data.get("type");
        
        if (title != null && body != null) {
            String channelId = determineChannel(data);
            showNotification(title, body, channelId, data);
        }
    }

    /**
     * Determine which notification channel to use based on message type
     */
    private String determineChannel(Map<String, String> data) {
        String type = data.get("type");
        
        if ("call".equals(type) || "incoming_call".equals(type)) {
            return CHANNEL_CALLS;
        } else if ("message".equals(type) || "chat".equals(type)) {
            return CHANNEL_MESSAGES;
        }
        
        return CHANNEL_GENERAL;
    }

    /**
     * Display notification with proper channel and priority
     */
    private void showNotification(String title, String body, String channelId, Map<String, String> data) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        // Add data to intent for deep linking
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }
        }
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        // Use different sound for calls
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(
            CHANNEL_CALLS.equals(channelId) 
                ? RingtoneManager.TYPE_RINGTONE 
                : RingtoneManager.TYPE_NOTIFICATION
        );

        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentBody(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE);

        // For calls, make it full screen and high priority
        if (CHANNEL_CALLS.equals(channelId)) {
            notificationBuilder
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pendingIntent, true)
                .setVibrate(new long[]{0, 1000, 500, 1000});
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        
        // Use unique ID for each notification
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, notificationBuilder.build());
        
        Log.d(TAG, "Notification displayed: " + title);
    }

    /**
     * Create notification channels for Android 8.0+
     * Different channels for messages, calls, and general notifications
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);

            // Messages channel
            NotificationChannel messagesChannel = new NotificationChannel(
                CHANNEL_MESSAGES,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            messagesChannel.setDescription("New message notifications");
            messagesChannel.enableVibration(true);
            messagesChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(messagesChannel);

            // Calls channel - highest priority
            NotificationChannel callsChannel = new NotificationChannel(
                CHANNEL_CALLS,
                "Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            callsChannel.setDescription("Incoming call notifications");
            callsChannel.enableVibration(true);
            callsChannel.setShowBadge(true);
            callsChannel.setBypassDnd(true); // Bypass Do Not Disturb
            notificationManager.createNotificationChannel(callsChannel);

            // General channel
            NotificationChannel generalChannel = new NotificationChannel(
                CHANNEL_GENERAL,
                "General",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            generalChannel.setDescription("General notifications");
            generalChannel.enableVibration(true);
            generalChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(generalChannel);

            Log.d(TAG, "Notification channels created");
        }
    }
}
