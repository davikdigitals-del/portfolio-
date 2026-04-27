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
     * WAKES THE PHONE even when screen is off
     * For incoming calls, shows full-screen notification with Answer/Decline buttons
     */
    private void showNotification(String title, String body, String channelId, Map<String, String> data) {
        // WAKE THE PHONE - acquire wake lock to turn screen on
        android.os.PowerManager powerManager = (android.os.PowerManager) getSystemService(POWER_SERVICE);
        android.os.PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
            android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK | 
            android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "PulseChat::NotificationWakeLock"
        );
        wakeLock.acquire(30000); // Keep screen on for 30 seconds for calls
        
        // Main intent - opens the app
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        
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
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
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
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // Show on lock screen
            .setDefaults(NotificationCompat.DEFAULT_ALL); // Sound, vibrate, lights

        // For calls, make it full screen with Answer/Decline buttons
        if (CHANNEL_CALLS.equals(channelId)) {
            // Answer action
            Intent answerIntent = new Intent(this, CallActionReceiver.class);
            answerIntent.setAction("ANSWER_CALL");
            if (data != null) {
                for (Map.Entry<String, String> entry : data.entrySet()) {
                    answerIntent.putExtra(entry.getKey(), entry.getValue());
                }
            }
            PendingIntent answerPendingIntent = PendingIntent.getBroadcast(
                this, 
                1, 
                answerIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Decline action
            Intent declineIntent = new Intent(this, CallActionReceiver.class);
            declineIntent.setAction("DECLINE_CALL");
            if (data != null) {
                for (Map.Entry<String, String> entry : data.entrySet()) {
                    declineIntent.putExtra(entry.getKey(), entry.getValue());
                }
            }
            PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
                this, 
                2, 
                declineIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            notificationBuilder
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pendingIntent, true) // Full screen on lock screen
                .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000}) // Longer vibration
                .setOngoing(true) // Can't be dismissed by swiping
                .setTimeoutAfter(30000) // Auto-dismiss after 30 seconds
                // Add action buttons
                .addAction(R.mipmap.ic_launcher, "Decline", declinePendingIntent)
                .addAction(R.mipmap.ic_launcher, "Answer", answerPendingIntent)
                // Style for incoming call
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setColorized(true)
                .setColor(0x00a884); // Green color
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        
        // Use unique ID for each notification (or fixed ID for calls to replace previous)
        int notificationId = CHANNEL_CALLS.equals(channelId) ? 999 : (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, notificationBuilder.build());
        
        Log.d(TAG, "Notification displayed with wake lock: " + title);
        
        // Release wake lock after a delay (30 seconds for calls, 5 for messages)
        int wakeTime = CHANNEL_CALLS.equals(channelId) ? 30000 : 5000;
        new android.os.Handler().postDelayed(() -> {
            if (wakeLock.isHeld()) {
                wakeLock.release();
                Log.d(TAG, "Wake lock released");
            }
        }, wakeTime);
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
