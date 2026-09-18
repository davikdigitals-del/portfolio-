# Quick Build Guide - Android App 🚀

## Prerequisites

You don't need Android Studio! You can build using command line.

### Install Required Tools:

1. **Java JDK 17** (required for Gradle)
   - Download: https://adoptium.net/
   - Or use: `choco install temurin17` (Windows with Chocolatey)

2. **Android SDK Command Line Tools**
   - Download: https://developer.android.com/studio#command-tools
   - Extract to: `C:\Android\cmdline-tools\latest\`

3. **Set Environment Variables:**
   ```powershell
   # Add to System Environment Variables
   ANDROID_HOME = C:\Android
   JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.x.x
   
   # Add to PATH:
   %ANDROID_HOME%\cmdline-tools\latest\bin
   %ANDROID_HOME%\platform-tools
   %JAVA_HOME%\bin
   ```

4. **Install Android SDK Packages:**
   ```bash
   sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
   ```

## Build Steps

### 1. Sync Capacitor
```bash
npx cap sync android
```

### 2. Build APK (Debug)
```bash
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Build APK (Release)
```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

### 4. Install on Device
```bash
# Connect phone via USB with USB Debugging enabled
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Alternative: Use Android Studio

If you prefer a GUI:

1. **Download Android Studio:**
   https://developer.android.com/studio

2. **Open Project:**
   ```bash
   npx cap open android
   ```

3. **Build & Run:**
   - Click green play button
   - Select your device
   - Wait for build and install

## Testing Notifications

### 1. Enable USB Debugging on Phone
```
Settings → About Phone → Tap "Build Number" 7 times
Settings → Developer Options → Enable USB Debugging
```

### 2. Connect Phone
```bash
adb devices
# Should show your device
```

### 3. View Logs
```bash
# All logs
adb logcat

# Filter for app
adb logcat | grep PulseChat

# Filter for notifications
adb logcat | grep PushNotificationService

# Filter for call actions
adb logcat | grep CallActionReceiver
```

### 4. Test Incoming Call
1. Install app on two devices
2. Login with different accounts
3. Lock one device
4. Call from the other device
5. ✅ Screen should turn on
6. ✅ Full-screen notification with Answer/Decline buttons
7. ✅ Tap Answer → Call starts
8. ✅ Tap Decline → Call declined

## Common Issues

### "SDK location not found"
```bash
# Create local.properties in android/ folder
echo "sdk.dir=C:\\Android" > android/local.properties
```

### "Java version mismatch"
```bash
# Check Java version
java -version
# Should be 17.x.x

# Set JAVA_HOME
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.x.x
```

### "gradlew: command not found"
```bash
# Use Windows version
cd android
.\gradlew.bat assembleDebug
```

### "google-services.json not found"
This is expected! The app will build without it, but push notifications won't work until you add Firebase configuration.

See `FIREBASE_SETUP_QUICKSTART.md` for Firebase setup.

## Build Without Android Studio

Complete command sequence:

```bash
# 1. Sync Capacitor
npx cap sync android

# 2. Build debug APK
cd android
./gradlew assembleDebug

# 3. Install on connected device
adb install app/build/outputs/apk/debug/app-debug.apk

# 4. View logs
adb logcat | grep PulseChat
```

## File Locations

- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release-unsigned.apk`
- **Logs**: `adb logcat`
- **App on device**: Settings → Apps → Pulse Chat

## Next Steps

1. ✅ Build the app
2. ✅ Install on device
3. ✅ Test lock screen notifications
4. ✅ Test Answer/Decline buttons
5. 📱 Add Firebase for production push notifications
6. 🚀 Deploy to Google Play Store

---

**You're all set! Build and test your app with full-screen incoming call notifications! 🎉**
