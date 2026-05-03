# App Launch Fix Bugfix Design

## Overview

The PulseChat Android app fails to launch because the Capacitor configuration (`capacitor.config.ts`) contains a `server.url` property pointing to a remote server (`https://ajibola-gbenga-joseph.onrender.com/auth`). This causes the app to attempt loading content from the remote URL instead of using the bundled local assets in `android/app/src/main/assets/public`. The fix involves removing the `server.url` property to allow Capacitor to use its default behavior of loading local assets, enabling the app to launch successfully and function offline.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the Capacitor configuration contains a `server.url` property, causing the app to attempt remote content loading instead of local asset loading
- **Property (P)**: The desired behavior - the app should launch successfully by loading bundled local assets from the `android/app/src/main/assets/public` directory
- **Preservation**: Existing build process, splash screen configuration, plugin settings, and APK generation that must remain unchanged by the fix
- **Capacitor Config**: The configuration file `capacitor.config.ts` that controls how the Capacitor runtime initializes and loads web content
- **webDir**: The directory containing the built web assets (`dist/client`) that get copied to the Android assets folder during `npx cap sync`
- **Local Assets**: The bundled web application files (HTML, CSS, JS) stored in `android/app/src/main/assets/public` that should be loaded by the app
- **Remote Server Mode**: A Capacitor development feature where the app loads content from a remote URL instead of local assets, typically used for live reload during development

## Bug Details

### Bug Condition

The bug manifests when the Capacitor configuration contains a `server.url` property. This property instructs the Capacitor WebView to load content from the specified remote URL instead of the bundled local assets. When the app launches, it attempts to connect to `https://ajibola-gbenga-joseph.onrender.com/auth`, which may be unreachable, misconfigured for mobile, or not serving the correct content, causing the app to fail silently or display a blank screen.

**Formal Specification:**
```
FUNCTION isBugCondition(config)
  INPUT: config of type CapacitorConfig
  OUTPUT: boolean
  
  RETURN config.server EXISTS
         AND config.server.url EXISTS
         AND config.server.url IS NOT NULL
         AND config.server.url IS NOT EMPTY
         AND app attempts to launch
END FUNCTION
```

### Examples

- **Example 1**: User installs `pulsechat.apk` on Android device, taps app icon
  - **Expected**: App launches, shows splash screen, then displays authentication screen
  - **Actual**: App fails to launch (blank screen or silent crash) because it tries to load from remote URL

- **Example 2**: User installs app while offline (no internet connection)
  - **Expected**: App launches successfully using local assets, displays authentication screen
  - **Actual**: App fails to launch because it cannot reach the remote server URL

- **Example 3**: Remote server is online but serves web content not optimized for mobile
  - **Expected**: App launches with mobile-optimized local assets
  - **Actual**: App may display incorrectly formatted content or fail to load properly

- **Edge Case**: User has internet connection but remote server returns 404 or 500 error
  - **Expected**: App launches using local assets as fallback
  - **Actual**: App fails to launch with no fallback mechanism

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- GitHub Actions build workflow must continue to produce a valid APK file (9.8 MB)
- Splash screen must continue to display Capacitor icon on black background with "from Edgebrook Solutions" text for 2 seconds
- Native permissions (camera, microphone, storage) must continue to be requested at appropriate times
- Firebase Cloud Messaging must continue to support push notifications
- App icon must continue to display correctly on the device launcher
- Plugin configurations (SplashScreen, PushNotifications, StatusBar, Camera) must continue to work as configured
- The `npx cap sync android` command must continue to copy web assets to the Android assets directory

**Scope:**
All functionality that does NOT involve the initial app launch and content loading should be completely unaffected by this fix. This includes:
- Build process and APK generation
- Splash screen display and timing
- Plugin configurations and native functionality
- Firebase integration
- App metadata and icons
- Android manifest permissions and components

## Hypothesized Root Cause

Based on the bug description and configuration analysis, the root cause is:

1. **Development Configuration Left in Production**: The `server.url` property in `capacitor.config.ts` is a development feature intended for live reload during development. It was likely added for testing but never removed before building the production APK. This causes the production app to behave like a development build, attempting to load from a remote server.

2. **Incorrect Capacitor Initialization**: When `server.url` is present, Capacitor's WebView initialization prioritizes loading from the remote URL over local assets. The WebView attempts to navigate to the remote URL, and if this fails (network error, server error, CORS issues, or incorrect content), the app has no fallback mechanism.

3. **Missing Local Asset Loading**: With `server.url` configured, Capacitor never attempts to load the bundled assets from `android/app/src/main/assets/public`, even though these assets are correctly synced during the build process (as evidenced by the file tree showing all assets are present).

4. **Silent Failure**: When the remote URL fails to load, the app doesn't display an error message or fallback to local assets. Instead, it shows a blank screen or crashes silently, providing no feedback to the user.

## Correctness Properties

Property 1: Bug Condition - App Launches with Local Assets

_For any_ Capacitor configuration where the `server.url` property is removed (or the entire `server` object is removed except for `androidScheme` and `iosScheme`), the fixed app SHALL launch successfully by loading bundled local assets from `android/app/src/main/assets/public`, displaying the splash screen followed by the authentication screen, and functioning independently of network connectivity.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Build Process and Plugin Configuration

_For any_ build process execution, splash screen display, plugin usage, or native functionality that does NOT involve the initial content loading mechanism, the fixed configuration SHALL produce exactly the same behavior as the original configuration, preserving APK generation, splash screen timing, Firebase integration, and all plugin settings.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `capacitor.config.ts`

**Object**: `config` (CapacitorConfig)

**Specific Changes**:
1. **Remove `server.url` Property**: Remove the `url: 'https://ajibola-gbenga-joseph.onrender.com/auth'` line from the `server` configuration object
   - This prevents Capacitor from attempting to load remote content
   - Allows Capacitor to use its default behavior of loading local assets

2. **Preserve `androidScheme` and `iosScheme`**: Keep `androidScheme: 'https'` and `iosScheme: 'https'` in the `server` object
   - These properties control the URL scheme used for local asset loading
   - They are required for proper HTTPS handling in the WebView

3. **Remove `cleartext` Property**: Remove the `cleartext: false` line as it's only relevant when using a remote URL
   - This property controls whether cleartext (HTTP) traffic is allowed
   - Not needed when loading local assets via HTTPS scheme

4. **Preserve All Plugin Configurations**: Keep all plugin configurations unchanged
   - SplashScreen, PushNotifications, StatusBar, Camera settings remain identical
   - These are independent of the content loading mechanism

5. **Verify `webDir` Property**: Ensure `webDir: 'dist/client'` remains unchanged
   - This tells Capacitor where to find the built web assets to copy during sync
   - Critical for the `npx cap sync android` command to work correctly

### Expected Configuration After Fix

```typescript
const config: CapacitorConfig = {
  appId: 'com.ajibolagbenga.pulsechat',
  appName: 'PulseChat',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    // ... all plugin configurations remain unchanged
  }
};
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (app fails to launch with `server.url` present), then verify the fix works correctly (app launches with `server.url` removed) and preserves existing behavior (build process, splash screen, plugins all work identically).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Build the APK with the current configuration (containing `server.url`), install it on an Android device or emulator, and attempt to launch the app. Observe the failure behavior and confirm it matches the bug description. Use Android Debug Bridge (adb) to capture logcat output during launch to identify specific error messages related to remote URL loading failures.

**Test Cases**:
1. **Launch with Remote URL (Online)**: Install APK on device with internet connection, tap app icon (will fail on unfixed code - blank screen or crash)
2. **Launch with Remote URL (Offline)**: Install APK on device without internet connection, tap app icon (will fail on unfixed code - immediate failure due to network unavailability)
3. **Logcat Analysis**: Capture logcat output during launch attempt to identify WebView errors related to remote URL loading (will show connection errors, CORS errors, or content loading failures on unfixed code)
4. **Asset Verification**: Verify that local assets exist in `android/app/src/main/assets/public` directory within the APK (should pass - assets are correctly bundled, but not being used)

**Expected Counterexamples**:
- App fails to launch when `server.url` is present in configuration
- Logcat shows WebView attempting to load from `https://ajibola-gbenga-joseph.onrender.com/auth`
- Possible error messages: "net::ERR_CONNECTION_REFUSED", "net::ERR_NAME_NOT_RESOLVED", "net::ERR_CONNECTION_TIMED_OUT", or CORS-related errors
- Local assets are present in APK but never loaded by the WebView

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (configuration with `server.url`), the fixed configuration (without `server.url`) produces the expected behavior (successful app launch with local assets).

**Pseudocode:**
```
FOR ALL config WHERE isBugCondition(config) DO
  fixed_config := removeServerUrl(config)
  result := buildAndLaunchApp(fixed_config)
  ASSERT appLaunchesSuccessfully(result)
  ASSERT splashScreenDisplays(result)
  ASSERT authScreenDisplays(result)
  ASSERT localAssetsLoaded(result)
END FOR
```

**Test Plan**: 
1. Remove `server.url` from `capacitor.config.ts`
2. Run `npx cap sync android` to update the configuration in the Android project
3. Build APK using GitHub Actions workflow or local Gradle build
4. Install APK on Android device/emulator
5. Launch app and verify:
   - Splash screen displays for 2 seconds
   - Authentication screen appears after splash screen
   - App functions without internet connection
   - Logcat shows local asset loading (capacitor:// or https://localhost URLs)

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (build process, splash screen, plugins, native functionality), the fixed configuration produces the same result as the original configuration.

**Pseudocode:**
```
FOR ALL functionality WHERE NOT relatedToContentLoading(functionality) DO
  ASSERT originalBehavior(functionality) = fixedBehavior(functionality)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different build scenarios
- It catches edge cases that manual testing might miss (different Android versions, device configurations)
- It provides strong guarantees that behavior is unchanged for all non-content-loading functionality

**Test Plan**: Observe behavior on UNFIXED code first for build process, splash screen, and plugins, then verify identical behavior after fix.

**Test Cases**:
1. **Build Process Preservation**: 
   - Unfixed: GitHub Actions produces 9.8 MB APK successfully
   - Fixed: Verify GitHub Actions produces APK of similar size successfully
   - Assert: Build logs show identical steps, APK structure is identical except for config file

2. **Splash Screen Preservation**:
   - Unfixed: Splash screen configuration shows Capacitor icon for 2 seconds (observable in code/config)
   - Fixed: Verify splash screen displays identically (same icon, duration, background color)
   - Assert: SplashScreen plugin configuration unchanged, visual appearance identical

3. **Plugin Configuration Preservation**:
   - Unfixed: PushNotifications, StatusBar, Camera plugins configured with specific settings
   - Fixed: Verify all plugin configurations remain byte-for-byte identical
   - Assert: Plugin behavior unchanged (notifications work, status bar styling correct, camera quality settings preserved)

4. **Native Permissions Preservation**:
   - Unfixed: AndroidManifest.xml requests specific permissions
   - Fixed: Verify AndroidManifest.xml unchanged
   - Assert: Permission requests occur at same times, same permissions granted

5. **Firebase Integration Preservation**:
   - Unfixed: Firebase Cloud Messaging configured with specific settings
   - Fixed: Verify Firebase configuration unchanged
   - Assert: Push notifications continue to work identically

6. **App Metadata Preservation**:
   - Unfixed: App icon, app name, package ID configured
   - Fixed: Verify all metadata unchanged
   - Assert: Launcher icon identical, app name identical, package ID identical

### Unit Tests

- Test that `capacitor.config.ts` does not contain `server.url` property after fix
- Test that `server.androidScheme` and `server.iosScheme` remain set to 'https'
- Test that `webDir` property remains set to 'dist/client'
- Test that all plugin configurations remain unchanged (deep equality check)
- Test that `npx cap sync android` successfully copies assets to Android project

### Property-Based Tests

- Generate random plugin configurations and verify they are preserved after config change
- Generate random build scenarios (different Node versions, Java versions) and verify APK builds successfully
- Generate random device configurations (different Android versions, screen sizes) and verify app launches successfully
- Test that app launches successfully across many different network conditions (online, offline, slow connection)

### Integration Tests

- Test full build-to-launch flow: modify config → sync → build → install → launch
- Test app functionality after launch: navigate between screens, use camera, receive notifications
- Test that app works completely offline after installation (no network requests to remote server)
- Test that logcat shows local asset loading (capacitor:// or https://localhost URLs) instead of remote URL attempts
- Test on multiple Android versions (API 24+) to ensure compatibility
- Test on physical devices and emulators to ensure consistent behavior
