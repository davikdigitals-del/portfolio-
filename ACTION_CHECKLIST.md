# Action Checklist - What You Need to Do Now ✅

## 🎯 Quick Setup (5 minutes)

### Step 1: Run Database Migration
```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual SQL
# Go to Supabase Dashboard → SQL Editor
# Copy and paste content from: supabase/migrations/20260427000000_add_fcm_token.sql
# Click "Run"
```

**What this does:**
- Adds `fcm_token` column for native notifications
- Adds `platform` column (web/android/ios)
- Creates indexes for faster lookups

### Step 2: Add FCM Server Key
```bash
# Go to Supabase Dashboard
# Settings → Edge Functions → Secrets
# Click "New Secret"
# Name: FCM_SERVER_KEY
# Value: [paste your Firebase server key]
```

**Get your FCM Server Key:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Project Settings → Cloud Messaging
4. Copy "Server key" (starts with `AAAA...`)

### Step 3: Rebuild Mobile App
```bash
# Sync Capacitor
npx cap sync android

# Build APK
cd android
./gradlew assembleDebug

# Install on device
adb install app/build/outputs/apk/debug/app-debug.apk
```

## ✅ What's Now Working

### 1. Screen Sharing ✅
- **Location:** Three-dot menu (⋮) during video calls
- **How to use:** Click ⋮ → "Share screen"
- **Works:** Desktop and mobile (where supported)

### 2. Call Persistence ✅
- **Incoming calls:** Restored for 30 seconds
- **Active calls:** Restored for 5 minutes
- **How it works:** Automatically saved to localStorage
- **Benefit:** Navigate away and back without losing call

### 3. Native FCM ✅
- **Mobile apps:** Use Firebase Cloud Messaging
- **Web browsers:** Use Web Push
- **Automatic:** Backend detects and routes correctly
- **Benefit:** Reliable notifications even when app is closed

## 🧪 Testing

### Test Screen Sharing:
```
1. Start video call
2. Click ⋮ menu
3. Click "Share screen"
4. ✅ Other person sees your screen
```

### Test Call Persistence:
```
1. Receive incoming call
2. Navigate to /services page
3. Wait 5 seconds
4. Navigate back to /dashboard
5. ✅ Call still ringing
6. ✅ Can answer/decline
```

### Test Native FCM:
```
1. Install app on Android
2. Login
3. Check logs: adb logcat | grep "FCM token"
4. ✅ Should see: "FCM token saved successfully"
5. Lock phone
6. Send message from another account
7. ✅ Native notification appears
8. ✅ Screen wakes up
```

## 🔍 Verify Everything Works

### Check Database:
```sql
-- Check FCM tokens are being saved
SELECT user_id, fcm_token, platform, created_at 
FROM push_subscriptions 
WHERE fcm_token IS NOT NULL;

-- Should see rows with fcm_token and platform='android'
```

### Check Edge Function Logs:
```bash
# In Supabase Dashboard
# Edge Functions → notify-incoming-call → Logs

# Look for:
# "Sending FCM notification to: android"
# "FCM notification sent successfully"
```

### Check localStorage:
```javascript
// In browser console on /dashboard
localStorage.getItem('incomingCall')
localStorage.getItem('activeCall')

// Should show null or JSON with call data
```

## 🐛 Troubleshooting

### FCM Notifications Not Working?
1. ✅ Check FCM_SERVER_KEY is set in Supabase secrets
2. ✅ Check google-services.json is in android/app/
3. ✅ Rebuild app: `npx cap sync android`
4. ✅ Check logs: `adb logcat | grep FCM`

### Calls Not Persisting?
1. ✅ Check browser console for errors
2. ✅ Check localStorage: `localStorage.getItem('incomingCall')`
3. ✅ Verify call status in database (should be 'ringing')

### Screen Sharing Not Visible?
1. ✅ Must be in video call (not voice call)
2. ✅ Click three-dot menu (⋮) button
3. ✅ Should see "Share screen" option

## 📚 Documentation

- `FINAL_FIXES_SUMMARY.md` - Complete overview of all fixes
- `PUSH_NOTIFICATIONS_SETUP.md` - Push notification setup
- `FIREBASE_SETUP_QUICKSTART.md` - Firebase configuration
- `QUICK_BUILD_GUIDE.md` - Building without Android Studio

## 🎉 You're Done!

After completing the 3 steps above:
- ✅ Screen sharing works in video calls
- ✅ Calls persist when navigating
- ✅ Native FCM notifications on mobile
- ✅ Notifications wake phone
- ✅ Works when app is closed

**Everything is ready to go! Just run the migration and add the FCM key.** 🚀
