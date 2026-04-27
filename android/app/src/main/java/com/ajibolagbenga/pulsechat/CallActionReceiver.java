package com.ajibolagbenga.pulsechat;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Handles Answer/Decline actions from incoming call notifications
 * This allows users to answer or decline calls directly from the lock screen
 */
public class CallActionReceiver extends BroadcastReceiver {
    private static final String TAG = "CallActionReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "Received action: " + action);

        // Dismiss the notification
        NotificationManager notificationManager = 
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.cancel(999); // Call notification ID

        if ("ANSWER_CALL".equals(action)) {
            Log.d(TAG, "User answered call from notification");
            
            // Open the app with call data
            Intent appIntent = new Intent(context, MainActivity.class);
            appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            appIntent.putExtra("action", "answer_call");
            
            // Pass through all call data
            String callId = intent.getStringExtra("call_id");
            String conversationId = intent.getStringExtra("conversation_id");
            String callType = intent.getStringExtra("call_type");
            
            if (callId != null) appIntent.putExtra("call_id", callId);
            if (conversationId != null) appIntent.putExtra("conversation_id", conversationId);
            if (callType != null) appIntent.putExtra("call_type", callType);
            
            context.startActivity(appIntent);
            
        } else if ("DECLINE_CALL".equals(action)) {
            Log.d(TAG, "User declined call from notification");
            
            // Open the app with decline action
            Intent appIntent = new Intent(context, MainActivity.class);
            appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            appIntent.putExtra("action", "decline_call");
            
            // Pass through call data
            String callId = intent.getStringExtra("call_id");
            String conversationId = intent.getStringExtra("conversation_id");
            
            if (callId != null) appIntent.putExtra("call_id", callId);
            if (conversationId != null) appIntent.putExtra("conversation_id", conversationId);
            
            context.startActivity(appIntent);
        }
    }
}
