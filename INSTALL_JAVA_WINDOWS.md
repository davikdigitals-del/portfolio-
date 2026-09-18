# Install Java for Android Build (Windows) ☕

## Fastest Method: Winget (1 minute)

```powershell
# Install Java 17 (required for Android Gradle 8+)
winget install EclipseAdoptium.Temurin.17.JDK

# After install, close and reopen PowerShell, then verify:
java -version
```

Should show: `openjdk version "17.x.x"`

---

## Alternative: Manual Download (3 minutes)

1. **Download Java 17:**
   https://adoptium.net/temurin/releases/?version=17

2. **Select:**
   - Operating System: **Windows**
   - Architecture: **x64**
   - Package Type: **JDK**
   - Click **Download .msi**

3. **Install:**
   - Run the downloaded `.msi` file
   - ✅ Check **"Set JAVA_HOME variable"**
   - ✅ Check **"Add to PATH"**
   - Click **Install**

4. **Verify:**
   ```powershell
   # Close and reopen PowerShell
   java -version
   ```

---

## If JAVA_HOME Still Not Set

```powershell
# Set JAVA_HOME manually
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot"

# Add to PATH
setx PATH "%PATH%;%JAVA_HOME%\bin"

# Close and reopen PowerShell
java -version
```

---

## Then Build Your App

```bash
cd C:\Users\EMMAX\Downloads\chat-flow-ai-main\android
./gradlew assembleDebug
```

Output will be: `app/build/outputs/apk/debug/app-debug.apk`

---

## Install on Phone

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

Done! 🎉
