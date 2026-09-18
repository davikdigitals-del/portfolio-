# Replace APK - Simple Instructions

## Your machine doesn't have enough RAM to build locally, so we'll use GitHub Actions.

---

## Step 1: Check GitHub Actions Build

1. Open your browser
2. Go to your GitHub repository
3. Click the **"Actions"** tab
4. Look for **"Build Android APK"** workflow
5. Find the most recent run (should be from today)

**Build Status:**
- 🟡 Yellow circle = Still building (wait a few minutes)
- ✅ Green checkmark = Build complete (proceed to Step 2)
- ❌ Red X = Build failed (let me know)

---

## Step 2: Download the New APK

1. Click on the completed workflow run (green checkmark)
2. Scroll to the bottom of the page
3. Under **"Artifacts"**, click **"PulseChat-Android"**
4. A ZIP file will download
5. Extract the ZIP file
6. You'll find **`app-debug.apk`** inside

---

## Step 3: Replace the Old APK

Open PowerShell in your project folder and run:

```powershell
# Replace with the actual path where you extracted the APK
Copy-Item "C:\Users\EMMAX\Downloads\app-debug.apk" -Destination "public\pulsechat.apk" -Force

# Commit and push
git add public\pulsechat.apk
git commit -m "Update PulseChat APK with native permissions and splash screen fix"
git push origin main
```

---

## Step 4: Verify

After pushing, the download button on your website will serve the new APK with:
- ✅ Opens to chat/auth (not portfolio)
- ✅ Native camera, mic, storage permissions
- ✅ Fixed splash screen
- ✅ Working notifications

---

## Quick Copy-Paste Commands

**After you download and extract the APK:**

```powershell
# Adjust the path to where you extracted the APK
$apkPath = "C:\Users\EMMAX\Downloads\PulseChat-Android\app-debug.apk"
Copy-Item $apkPath -Destination "public\pulsechat.apk" -Force
git add public\pulsechat.apk
git commit -m "Update PulseChat APK"
git push origin main
```

---

## Need the GitHub URL?

If you don't know your GitHub repository URL, run:
```powershell
git remote get-url origin
```

Then open that URL in your browser and add `/actions` at the end.

---

## What if the build is still running?

Just wait 5-10 minutes. The build takes time because it's compiling the entire Android app in the cloud.

You can refresh the Actions page to see when it's done.
