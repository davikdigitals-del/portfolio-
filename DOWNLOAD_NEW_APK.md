# How to Download and Replace the APK

## Option 1: Download from GitHub Actions (Recommended)

### Step 1: Go to GitHub Actions
1. Open your browser and go to your GitHub repository
2. Click on the **"Actions"** tab at the top
3. You should see a workflow run called **"Build Android APK"**
4. Look for the most recent run (should be running or completed)

### Step 2: Wait for Build to Complete
- If the workflow shows a yellow circle (🟡), it's still building - wait for it to finish
- If it shows a green checkmark (✅), the build is complete
- If it shows a red X (❌), the build failed - let me know

### Step 3: Download the APK
1. Click on the completed workflow run
2. Scroll down to the **"Artifacts"** section at the bottom
3. Click on **"PulseChat-Android"** to download it
4. Extract the ZIP file - you'll find `app-debug.apk` inside

### Step 4: Replace the APK on Website
Once you have the `app-debug.apk` file:

```bash
# Navigate to your project folder
cd C:\Users\EMMAX\Downloads\chat-flow-ai-main

# Copy the new APK to the public folder (replace the path with where you downloaded it)
cp C:\Users\EMMAX\Downloads\app-debug.apk public\pulsechat.apk

# Commit and push
git add public\pulsechat.apk
git commit -m "Update PulseChat APK with native permissions and splash screen fix"
git push origin main
```

---

## Option 2: Build Locally (If You Have Enough Resources)

**WARNING**: Your machine has only 3GB RAM and may run out of memory during build.

```bash
cd android
./gradlew assembleDebug --no-daemon
```

If successful, the APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Then copy it:
```bash
cp android/app/build/outputs/apk/debug/app-debug.apk public/pulsechat.apk
git add public/pulsechat.apk
git commit -m "Update PulseChat APK"
git push origin main
```

---

## What's in the New APK?

✅ Opens directly to `/auth` (chat login) instead of portfolio  
✅ Native permissions for camera, microphone, storage  
✅ Fixed splash screen that doesn't block notifications  
✅ Proper push notification support  
✅ Custom splash screen with "from Edgebrook Solutions"  

---

## Quick Check: Is the Build Ready?

Go to: https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/actions

Look for the latest "Build Android APK" workflow run.

---

## Need Help?

If the build failed or you can't find the APK, let me know and I'll help troubleshoot!
