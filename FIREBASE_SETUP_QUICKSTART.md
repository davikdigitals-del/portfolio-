# 🚀 Firebase Setup - Quick Start Guide

## What You Need to Do Next

Your code is ready! Now you just need to connect Firebase to enable 24/7 notifications.

### Step 1: Get google-services.json (5 minutes)

1. **Go to:** https://console.firebase.google.com/

2. **Create or select your project**

3. **Click:** ⚙️ Project Settings → Add app → Android

4. **Enter package name:** `com.ajibolagbenga.pulsechat`

5. **Download** `google-services.json`

6. **Place it here:**
   ```
   android/app/google-services.json
   ```

### Step 2: Get FCM Server Key (2 minutes)

1. In Firebase Console: **Project Settings → Cloud Messaging**

2. **Copy** the "Server key" (starts with `AAAA...`)

3. **Add to Supabase:**
   - Go to your Supabase project
   - Settings → Edge Functions → Secrets
   - Add: `FCM_SERVER_KEY` = `[your-server-key]`

### Step 3: Build & Test (3 minutes)

```bash
# Sync the changes
npx cap sync android

# Open in Android Studio
npx cap open android

# Build and run on device
# (Click the green play button in Android Studio)
```

### Step 4: Test Notifications

1. **Login** to the app
2. **Close the app completely** (swipe away from recent apps)
3. **Send a message** from another account
4. ✅ **Notification appears** even though app is closed!

---

## That's It! 🎉

Your app now has:
- ✅ Notifications when app is closed
- ✅ Notifications when app is in background
- ✅ Notifications when phone is locked
- ✅ Full-screen call notifications
- ✅ Works 24/7 like WhatsApp

## Need Help?

See `PUSH_NOTIFICATIONS_SETUP.md` for detailed documentation and troubleshooting.
