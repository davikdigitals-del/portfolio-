# Quick Setup Guide - Native Push Notifications

## ✅ What's Already Done

The code is ready! The notification system automatically detects if it's running as:
- **Native app** → Uses FCM/APNs
- **Web app** → Uses Web Push

## 🚀 Quick Start (3 Steps)

### Step 1: Set Up Firebase (for Android)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Click "Add project" or use existing

2. **Add Android App**
   - Click "Add app" → Android icon
   - Package name: `com.ajibolagbenga.pulsechat`
   - App nickname: `Pulse Chat`
   - Click "Register app"

3. **Download google-services.json**
   - Download the file
   - Place it in: `android/app/google-services.json`

4. **Get FCM Server Key**
   - Firebase Console → Project Settings → Cloud Messaging
   - Copy "Server key"
   - Save for Step 3

### Step 2: Set Up APNs (for iOS)

1. **Apple Developer Portal**
   - Go to: https://developer.apple.com/account
   - Certificates, Identifiers & Profiles → Keys
   - Create new key with "Apple Push Notifications service (APNs)"
   - Download the .p8 file

2. **Upload to Firebase**
   - Firebase Console → Project Settings → Cloud Messaging → iOS
   - Upload APNs Authentication Key (.p8 file)
   - Enter Key ID and Team ID

3. **Configure Xcode**
   - Open: `ios/App/App.xcworkspace`
   - Select target → Signing & Capabilities
   - Add capability: "Push Notifications"
   - Add capability: "Background Modes" → Check "Remote notifications"

### Step 3: Update Supabase Edge Function

Create or update `supabase/functions/send-push/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")!;
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID")!;
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID")!;
const APNS_KEY = Deno.env.get("APNS_KEY")!; // .p8 file content

serve(async (req) => {
  try {
    const { user_id, title, body, url, platform } = await req.json();

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's push subscriptions
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ error: "No subscriptions found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const sub of subscriptions) {
      try {
        // Determine platform
        const subPlatform = sub.subscription?.platform || platform;

        if (subPlatform === "android") {
          // Send via FCM
          const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `key=${FCM_SERVER_KEY}`,
            },
            body: JSON.stringify({
              to: sub.subscription.token,
              notification: {
                title,
                body,
                icon: "/me.webp",
                click_action: url || "/dashboard/chat",
                sound: "default",
              },
              data: {
                url: url || "/dashboard/chat",
                type: "message",
              },
              priority: "high",
            }),
          });

          results.push({ platform: "android", success: fcmResponse.ok });
        } else if (subPlatform === "ios") {
          // Send via APNs (simplified - use a proper APNs library in production)
          // For now, use FCM for iOS too (Firebase handles both)
          const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `key=${FCM_SERVER_KEY}`,
            },
            body: JSON.stringify({
              to: sub.subscription.token,
              notification: {
                title,
                body,
                sound: "default",
              },
              data: {
                url: url || "/dashboard/chat",
              },
              priority: "high",
            }),
          });

          results.push({ platform: "ios", success: fcmResponse.ok });
        } else {
          // Send via Web Push
          const webpush = await import("https://esm.sh/web-push@3.6.3");
          
          webpush.setVapidDetails(
            "mailto:your-email@example.com",
            Deno.env.get("VITE_VAPID_PUBLIC_KEY")!,
            Deno.env.get("VAPID_PRIVATE_KEY")!
          );

          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({
              title,
              body,
              icon: "/me.webp",
              data: { url: url || "/dashboard/chat" },
            })
          );

          results.push({ platform: "web", success: true });
        }
      } catch (err) {
        console.error("Push error:", err);
        results.push({ platform: subPlatform, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

**Set environment variables:**
```bash
# In Supabase Dashboard → Edge Functions → Configuration
FCM_SERVER_KEY=your_fcm_server_key_from_firebase
APNS_KEY_ID=your_apns_key_id
APNS_TEAM_ID=your_apple_team_id
APNS_KEY=your_apns_key_content
```

**Deploy the function:**
```bash
supabase functions deploy send-push
```

## 🧪 Testing

### Test on Web (Easiest)
```bash
npm run dev
```
1. Open in browser
2. Grant notification permission
3. Send a test message
4. Should see browser notification

### Test on Android
```bash
# Build and sync
npm run build
npx cap sync android

# Open in Android Studio
npx cap open android

# Run on device (not emulator for push)
# Grant notification permission
# Close app completely
# Send test message from another account
# Should see system notification
```

### Test on iOS
```bash
# Build and sync
npm run build
npx cap sync ios

# Open in Xcode
npx cap open ios

# Configure signing
# Run on real device (not simulator)
# Grant notification permission
# Close app
# Send test message
# Should see system notification
```

## 📱 Build Native Apps

### Android APK
```bash
# Build web assets
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# In Android Studio:
# Build → Generate Signed Bundle / APK
# Choose APK
# Create keystore or use existing
# Build release APK
```

### iOS IPA
```bash
# Build web assets
npm run build

# Sync to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios

# In Xcode:
# Product → Archive
# Distribute App
# Choose distribution method
# Follow wizard to create IPA
```

## ✅ Verification Checklist

- [ ] Firebase project created
- [ ] google-services.json downloaded and placed
- [ ] FCM Server Key copied
- [ ] APNs key created and uploaded to Firebase
- [ ] Xcode capabilities configured
- [ ] Edge function updated and deployed
- [ ] Environment variables set in Supabase
- [ ] Tested on web browser
- [ ] Tested on Android device
- [ ] Tested on iOS device
- [ ] Notifications work when app is closed
- [ ] Deep links work (tapping notification opens correct screen)

## 🎉 Done!

Your app now has real native push notifications that work even when the app is completely closed!

## 📚 Resources

- [Firebase Console](https://console.firebase.google.com)
- [Apple Developer Portal](https://developer.apple.com/account)
- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---
**Need Help?** Check `NATIVE_NOTIFICATIONS_COMPLETE.md` for detailed documentation.
