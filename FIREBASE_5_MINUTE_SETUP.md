# Firebase Setup in 5 Minutes 🚀

## The Truth About Android Notifications

Every Android push notification service (OneSignal, Pusher, Courier, etc.) 
ALL use Firebase/FCM underneath. Google mandates it for Play Store apps.
There is NO alternative for Android — FCM IS the Android notification system.

**The good news: Firebase is 100% FREE and takes 5 minutes.**

---

## Step 1: Go to Firebase Console (1 min)

Open: https://console.firebase.google.com/

- Sign in with any Google account
- Click **"Add project"**
- Name it: `pulse-chat`
- Disable Google Analytics (click the toggle OFF)
- Click **"Create project"**
- Wait ~30 seconds, then click **"Continue"**

---

## Step 2: Add Your Android App (2 min)

1. On the project overview page, click the **Android icon** (looks like a robot)

2. Fill in:
   - **Android package name**: `com.ajibolagbenga.pulsechat`
   - **App nickname**: Pulse Chat
   - **Debug signing certificate**: leave blank

3. Click **"Register app"**

4. Click **"Download google-services.json"**

5. Click **"Next"** → **"Next"** → **"Continue to console"**
   (skip the SDK setup steps — your app already has it)

---

## Step 3: Place the File (30 sec)

Move the downloaded `google-services.json` into:

```
android/app/google-services.json
```

**IMPORTANT**: Must be in `android/app/` NOT `android/`

---

## Step 4: Get Server Key (1 min)

1. In Firebase Console, click the **⚙️ gear icon** → **"Project settings"**
2. Click the **"Cloud Messaging"** tab
3. Under **"Cloud Messaging API (Legacy)"**, copy the **Server key**
   - It starts with `AAAA...` and is very long
   - If you see "Enable" button, click it first

---

## Step 5: Add to Supabase (1 min)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click **"Edge Functions"** in the left sidebar
3. Click **"Secrets"** tab
4. Click **"New secret"**
5. Name: `FCM_SERVER_KEY`
6. Value: paste the server key from Step 4
7. Click **"Save"**

---

## Step 6: Rebuild App (30 sec)

```bash
npx cap sync android
cd android
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## ✅ Done! Test It:

1. Install the new APK on your phone
2. Open app and login
3. Lock your phone
4. Send a message from another account
5. **Notification appears and wakes the screen!**

---

## Why Firebase is the Only Option

| Service | Uses FCM? | Requires Firebase? |
|---------|-----------|-------------------|
| Firebase (direct) | ✅ Yes | ✅ Yes |
| OneSignal | ✅ Yes (underneath) | ✅ Yes |
| Pusher Beams | ✅ Yes (underneath) | ✅ Yes |
| Courier | ✅ Yes (underneath) | ✅ Yes |
| AWS SNS | ✅ Yes (underneath) | ✅ Yes |

**All roads lead to FCM for Android.** The difference is just whether you 
use Firebase directly (free, simple) or pay a middleman to use it for you.

---

## Firebase is Free Forever

Firebase free tier includes:
- ✅ Unlimited push notifications
- ✅ No credit card required
- ✅ No expiry
- ✅ Works for millions of users

You only pay if you use other Firebase services (database, hosting, etc.)
Push notifications (FCM) are always free.
