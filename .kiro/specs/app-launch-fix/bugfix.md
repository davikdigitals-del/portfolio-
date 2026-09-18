# Bugfix Requirements Document

## Introduction

The PulseChat Android app (pulsechat.apk) fails to launch after installation on Android devices. The app builds successfully via GitHub Actions (9.8 MB APK), installs without errors, but does not open when tapped. This prevents users from accessing any app functionality.

The root cause is identified as the Capacitor configuration pointing to a remote server URL (`https://ajibola-gbenga-joseph.onrender.com/auth`) instead of loading bundled local assets. When the app attempts to launch, it tries to load content from this remote URL, which may be unreachable, misconfigured, or not serving the correct mobile app content, causing the app to fail silently or crash during initialization.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user installs the APK and taps the app icon THEN the system fails to launch the app (no UI appears, app may crash silently or show a blank screen)

1.2 WHEN the app attempts to initialize THEN the system tries to load content from the remote URL `https://ajibola-gbenga-joseph.onrender.com/auth` instead of using bundled local assets

1.3 WHEN the remote server is unreachable, misconfigured, or serves incorrect content THEN the system fails to display any app interface

1.4 WHEN the app fails to load remote content THEN the system provides no fallback to local assets, leaving the user with a non-functional app

### Expected Behavior (Correct)

2.1 WHEN the user installs the APK and taps the app icon THEN the system SHALL launch the app successfully, displaying the splash screen followed by the authentication screen

2.2 WHEN the app initializes THEN the system SHALL load the bundled local web assets from `android/app/src/main/assets/public` directory

2.3 WHEN the app loads local assets THEN the system SHALL display the splash screen with Capacitor icon for 2 seconds, then navigate to the /auth route

2.4 WHEN the app uses local assets THEN the system SHALL function independently of network connectivity or remote server availability

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the app is built via GitHub Actions THEN the system SHALL CONTINUE TO produce a valid APK file

3.2 WHEN the splash screen is displayed THEN the system SHALL CONTINUE TO show the Capacitor icon on black background with "from Edgebrook Solutions" text

3.3 WHEN native permissions are requested (camera, microphone, storage) THEN the system SHALL CONTINUE TO request them at appropriate times

3.4 WHEN the app is installed on an Android device THEN the system SHALL CONTINUE TO install without errors

3.5 WHEN Firebase Cloud Messaging is configured THEN the system SHALL CONTINUE TO support push notifications

3.6 WHEN the app icon is displayed on the device THEN the system SHALL CONTINUE TO show the correct launcher icon
