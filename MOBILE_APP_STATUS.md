# PulseChat Mobile App - Current Status

## ✅ Completed Changes

### 1. App Configuration
- **App opens directly to chat/auth** (`/auth`) instead of portfolio homepage
- **App name**: Changed from "Pulse Chat" to "PulseChat"
- **Package ID**: `com.ajibolagbenga.pulsechat`
- **Server URL**: `https://ajibola-gbenga-joseph.onrender.com/auth`

### 2. Native Permissions Added
The app now requests the following native Android permissions:

#### Core Permissions
- ✅ `INTERNET` - Network access
- ✅ `POST_NOTIFICATIONS` - Push notifications
- ✅ `VIBRATE` - Notification vibration
- ✅ `WAKE_LOCK` - Keep device awake during calls
- ✅ `RECEIVE_BOOT_COMPLETED` - Auto-start on device boot
- ✅ `USE_FULL_SCREEN_INTENT` - Full-screen incoming call notifications
- ✅ `FOREGROUND_SERVICE` - Background call service

#### Camera & Audio (for video/voice calls)
- ✅ `CAMERA` - Video calls
- ✅ `RECORD_AUDIO` - Voice/video calls
- ✅ `MODIFY_AUDIO_SETTINGS` - Audio routing control

#### Storage (for file uploads/downloads)
- ✅ `READ_EXTERNAL_STORAGE` - Read files (Android 12 and below)
- ✅ `WRITE_EXTERNAL_STORAGE` - Write files (Android 12 and below)
- ✅ `READ_MEDIA_IMAGES` - Read images (Android 13+)
- ✅ `READ_MEDIA_VIDEO` - Read videos (Android 13+)
- ✅ `READ_MEDIA_AUDIO` - Read audio (Android 13+)

#### Network
- ✅ `ACCESS_NETWORK_STATE` - Check network connectivity

### 3. Hardware Features Declared
- ✅ Camera (optional)
- ✅ Camera autofocus (optional)
- ✅ Microphone (optional)

### 4. GitHub Actions Build Workflow
- ✅ Workflow file created: `.github/workflows/build-android.yml`
- ✅ Updated to use actions v4 (fixed deprecation errors)
- ✅ Builds APK automatically when `android/` or `capacitor.config.ts` changes
- ✅ Can be manually triggered via GitHub Actions UI

### 5. Website Download Button
- ✅ "Download App" button added to homepage hero section
- ✅ Always visible (not device-dependent)
- ✅ Downloads `/pulsechat.apk` file

## 🔄 In Progress

### APK Build
- **Status**: GitHub Actions workflow triggered
- **Action**: Building new APK with all native permissions
- **Location**: Check GitHub Actions tab in your repository
- **Expected output**: `app-debug.apk` in workflow artifacts

## 📋 Next Steps

### 1. Download the New APK (After Build Completes)
1. Go to your GitHub repository
2. Click "Actions" tab
3. Find the latest "Build Android APK" workflow run
4. Wait for it to complete (green checkmark)
5. Download the "PulseChat-Android" artifact
6. Extract the `app-debug.apk` file

### 2. Update Website APK
```bash
# Replace the old APK with the new one
cp path/to/downloaded/app-debug.apk public/pulsechat.apk

# Commit and push
git add public/pulsechat.apk
git commit -m "Update PulseChat APK with native permissions"
git push origin main
```

### 3. Test the New APK
- Install on Android device
- Verify app opens to `/auth` page (not portfolio)
- Test that app requests permissions:
  - Camera permission (when starting video call)
  - Microphone permission (when starting voice/video call)
  - Storage permission (when uploading files)
- Verify video/voice calls work
- Verify file uploads work

### 4. iOS App (Future)
To create an iOS version:
- Requires a Mac with Xcode
- Requires Apple Developer account ($99/year)
- Run: `npx cap add ios`
- Build in Xcode

## 🔧 Technical Details

### Files Modified
- `capacitor.config.ts` - App configuration
- `android/app/src/main/AndroidManifest.xml` - Permissions
- `.github/workflows/build-android.yml` - Build automation
- `src/routes/index.tsx` - Download button

### Build Command (Local)
```bash
cd android
./gradlew assembleDebug --no-daemon
```

### APK Location (Local Build)
```
android/app/build/outputs/apk/debug/app-debug.apk
```

## ⚠️ Important Notes

1. **This is a native app**, not just a web wrapper. Capacitor provides native APIs and permissions.
2. **Permissions are requested at runtime** when the user tries to use a feature (camera, mic, storage).
3. **The app loads your web app** but has access to native device features through Capacitor plugins.
4. **GitHub Actions builds in the cloud** to avoid local resource constraints (RAM/disk space).

## 📱 App Behavior

### On First Launch
1. Shows custom splash screen (PulseChat logo + "from Edgebrook Solutions")
2. Opens directly to `/auth` page
3. User can login or register

### When Using Features
- **Video call**: Requests camera + microphone permissions
- **Voice call**: Requests microphone permission
- **Upload file**: Requests storage permissions
- **Notifications**: Requests notification permission

### Permissions Dialog
Android will show native permission dialogs like:
- "Allow PulseChat to access your camera?"
- "Allow PulseChat to record audio?"
- "Allow PulseChat to access photos and media?"

These are **native Android dialogs**, not browser prompts.

## 🎯 Current Status Summary

✅ App configured to open to chat  
✅ All native permissions added  
✅ GitHub Actions workflow ready  
🔄 Building new APK with permissions  
⏳ Waiting for build to complete  
⏳ Need to download and replace APK on website  

---

**Last Updated**: May 2, 2026  
**Build Status**: Check GitHub Actions for latest build
