# Why Notifications Don't Work (And How to Fix It) 🔔

## The Problem

Your notifications (messages and calls) don't work because:

1. ❌ **No `google-services.json`** → FCM tokens never generated
2. ❌ **App falls back to Web Push** → unreliable on mobile
3. ❌ **Web Push requires service worker** → works in browser but not in native app

## How WhatsApp Does It (Research Summary)

Based on [technical analysis](https://csetutorials.com/push-notifications-whatsapp-architecture-flow.html) and [Stack Overflow discussions](https://stackoverflow.com/questions/37947541/what-is-the-difference-between-firebase-push-notifications-and-fcm-messages):

### WhatsApp's Architecture:

```
Message Sent
    ↓
WhatsApp Server
    ↓
Firebase Cloud Messaging (FCM)
    ↓
Google Play Services (persistent connection)
    ↓
Android OS receives notification
    ↓
OS shows notification (even if app is killed)
    ↓
User taps → App opens
```

### Key Technical Details:

1. **Persistent Connection**: FCM maintains an always-on lightweight connection through Google Play Services — not through the app itself

2. **Two Payload Types**:
   - **`notification` payload**: Handled by Android OS automatically (works when app is killed)
   - **`data` payload**: Delivered to `onMessageReceived()` only when app is alive

3. **Combined Payload** (What WhatsApp uses):
   ```json
   {
     "to": "fcm_token_here",
     "notification": {
       "title": "John Doe",
       "body": "Hey, how are you?",
       "sound": "default"
     },
     "data": {
       "conversation_id": "123",
       "message_id": "456",
       "type": "message"
     }
   }
   ```
   - When app is **killed**: OS shows the `notification` part automatically
   - When app is **alive**: `onMessageReceived()` gets both and can customize

4. **Battery Optimization**: FCM connection is managed by Google Play Services, not the app, so it survives aggressive battery optimization

## Your Current Setup (Why It Fails)

### What You Have:
```
Message Sent
    ↓
Supabase Edge Function
    ↓
Web Push (VAPID encryption)
    ↓
Service Worker (if browser)
    ↓
❌ Fails on native app (no service worker)
    ↓
❌ Unreliable on mobile browsers
```

### The Missing Piece:

**`google-services.json`** — This file contains your Firebase project configuration. Without it:
- FCM SDK can't initialize
- No FCM token is generated
- App falls back to Web Push
- Web Push doesn't work in Capacitor native apps

## The Solution (Step-by-Step)

### Option 1: Get Firebase Working (Recommended - 10 minutes)

#### Step 1: Create Firebase Project (3 minutes)

1. Go to https://console.firebase.google.com/
2. Click "Add project" or select existing
3. Enter project name: "Pulse Chat"
4. Disable Google Analytics (optional)
5. Click "Create project"

#### Step 2: Add Android App (2 minutes)

1. In Firebase Console, click Android icon
2. **Android package name**: `com.ajibolagbenga.pulsechat`
3. **App nickname**: Pulse Chat (optional)
4. Click "Register app"
5. **Download `google-services.json`**

#### Step 3: Place google-services.json (1 minute)

```bash
# Place the downloaded file here:
android/app/google-services.json
```

**CRITICAL**: The file MUST be in `android/app/` folder, not `android/`!

#### Step 4: Get FCM Server Key (2 minutes)

1. Firebase Console → Project Settings (⚙️ icon)
2. Click "Cloud Messaging" tab
3. Scroll to "Cloud Messaging API (Legacy)"
4. Copy the "Server key" (starts with `AAAA...`)

#### Step 5: Add to Supabase (2 minutes)

1. Go to your Supabase project dashboard
2. Settings → Edge Functions → Secrets
3. Click "New secret"
4. Name: `FCM_SERVER_KEY`
5. Value: [paste the server key]
6. Click "Save"

#### Step 6: Rebuild App (2 minutes)

```bash
# Sync Capacitor
npx cap sync android

# Build APK
cd android
./gradlew assembleDebug

# Install on device
adb install app/build/outputs/apk/debug/app-debug.apk
```

#### Step 7: Test (1 minute)

1. Open app and login
2. Check logs: `adb logcat | grep "FCM token"`
3. Should see: `New FCM token: [long token string]`
4. Lock phone
5. Send message from another account
6. ✅ Notification appears and wakes phone!

### Option 2: Fix Web Push for Browser (Temporary)

If you can't get Firebase right now, you can at least make notifications work in the **web browser**:

#### Check Service Worker Registration:

```javascript
// In browser console
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW registered:', !!reg);
  if (reg) {
    reg.pushManager.getSubscription().then(sub => {
      console.log('Push subscription:', !!sub);
    });
  }
});
```

#### Check Push Subscription:

```sql
-- In Supabase SQL Editor
SELECT user_id, endpoint, fcm_token, platform, created_at 
FROM push_subscriptions;

-- Should see rows with endpoint (web) or fcm_token (mobile)
```

## Why Your Current Approach Doesn't Work

### Problem 1: Web Push on Native App
- **Web Push** requires a service worker
- **Capacitor native apps** don't have service workers
- Result: Notifications never arrive

### Problem 2: No FCM Token
- Without `google-services.json`, FCM SDK can't initialize
- No token = no way for Firebase to reach your device
- Backend tries to send FCM but has no token to send to

### Problem 3: Battery Optimization
- Even if Web Push worked, Android kills background processes
- FCM survives because it's managed by Google Play Services (system-level)
- Web Push connections get killed by battery optimization

## How to Verify It's Working

### Check 1: FCM Token Generated
```bash
adb logcat | grep "FCM"
```

Look for:
```
[Native] Push registration success, token: dXYz...
[Native] FCM token saved successfully
```

### Check 2: Backend Sends FCM
```bash
# In Supabase Dashboard
# Edge Functions → notify-incoming-call → Logs
```

Look for:
```
Sending FCM notification to: android
FCM notification sent successfully
```

### Check 3: Notification Received
```bash
adb logcat | grep "PushNotificationService"
```

Look for:
```
Message received from: [sender-id]
Notification displayed with wake lock: [title]
```

### Check 4: Database Has Token
```sql
SELECT user_id, fcm_token, platform 
FROM push_subscriptions 
WHERE fcm_token IS NOT NULL;
```

Should return rows with `fcm_token` and `platform='android'`.

## Common Issues & Solutions

### Issue: "google-services.json not found"
**Solution**: Place file in `android/app/google-services.json` (not `android/`)

### Issue: "FCM token is null"
**Solution**: 
1. Check `google-services.json` is in correct location
2. Rebuild: `npx cap sync android`
3. Check Firebase project has Cloud Messaging enabled

### Issue: "Notifications work in browser but not in app"
**Solution**: This is expected! Browser uses Web Push, app needs FCM. Add `google-services.json`.

### Issue: "Backend says 'No push subscriptions'"
**Solution**: 
1. Check user is logged in
2. Check `push_subscriptions` table has rows for that user
3. Run migration: `supabase/migrations/20260427000000_add_fcm_token.sql`

### Issue: "FCM_SERVER_KEY not set"
**Solution**: Add it to Supabase Edge Functions secrets (see Step 5 above)

### Issue: "Notifications work sometimes but not always"
**Solution**: 
1. Disable battery optimization for your app
2. Add app to "Protected apps" list (Xiaomi/Huawei)
3. Ensure "Autostart" is enabled (some manufacturers)

## The Bottom Line

**Your code is correct!** The notification system is fully implemented:
- ✅ `PushNotificationService.java` handles background notifications
- ✅ `CallActionReceiver.java` handles Answer/Decline buttons
- ✅ Wake lock turns screen on
- ✅ Full-screen call notifications
- ✅ Backend sends FCM with correct payload
- ✅ Service worker handles Web Push

**What's missing:** Just the `google-services.json` file!

Without it, FCM tokens are never generated, so the backend has nothing to send to. It's like having a perfect postal system but no address to deliver to.

## Quick Test Without Firebase

Want to test if the notification system works before setting up Firebase?

### Test the Service Worker (Browser Only):

1. Open app in Chrome/Edge
2. Login
3. Open DevTools → Application → Service Workers
4. Check "Update on reload"
5. Reload page
6. Check "Push" subscription exists
7. Send a message from another account
8. ✅ Should see notification in browser

This proves the backend and service worker work. The native app just needs Firebase.

## Next Steps

1. **Get `google-services.json`** (10 minutes) - See steps above
2. **Place in `android/app/`**
3. **Get FCM Server Key** and add to Supabase
4. **Rebuild app**: `npx cap sync android && cd android && ./gradlew assembleDebug`
5. **Test**: Lock phone, send message, notification appears!

---

**TL;DR**: Your notification code is perfect. You just need to add `google-services.json` to enable FCM. Without it, the app can't get an FCM token, so Firebase has no way to reach your device.
