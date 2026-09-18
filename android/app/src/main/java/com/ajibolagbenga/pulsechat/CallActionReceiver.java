package com.ajibolagbenga.pulsechat;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class CallActionReceiver extends BroadcastReceiver {
    private static final String TAG = "CallActionReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "Received action: " + action);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(999);

        if ("ANSWER_CALL".equals(action)) {
            Intent appIntent = new Intent(context, MainActivity.class);
            appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            appIntent.putExtra("action", "answer_call");
            String callId = intent.getStringExtra("call_id");
            String convId = intent.getStringExtra("conversation_id");
            String callType = intent.getStringExtra("call_type");
            if (callId != null) appIntent.putExtra("call_id", callId);
            if (convId != null) appIntent.putExtra("conversation_id", convId);
            if (callType != null) appIntent.putExtra("call_type", callType);
            context.startActivity(appIntent);

        } else if ("DECLINE_CALL".equals(action)) {
            Intent appIntent = new Intent(context, MainActivity.class);
            appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            appIntent.putExtra("action", "decline_call");
            String callId = intent.getStringExtra("call_id");
            String convId = intent.getStringExtra("conversation_id");
            if (callId != null) appIntent.putExtra("call_id", callId);
            if (convId != null) appIntent.putExtra("conversation_id", convId);
            context.startActivity(appIntent);
        }
    }
}
