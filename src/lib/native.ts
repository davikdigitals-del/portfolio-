/**
 * Native Mobile App Integration
 * Handles Capacitor native features for iOS and Android
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';

// Check if running as native app
export const isNativeApp = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'

// ── Initialize Native App ──────────────────────────────────────────────────
export async function initializeNativeApp() {
  if (!isNativeApp) {
    console.log('[Native] Running as web app');
    return;
  }

  console.log('[Native] Initializing native app on', platform);

  try {
    // Hide splash screen after app loads
    await SplashScreen.hide();

    // Configure status bar
    if (platform === 'ios' || platform === 'android') {
      await StatusBar.setStyle({ style: Style.Dark });
      if (platform === 'android') {
        await StatusBar.setBackgroundColor({ color: '#000000' });
      }
    }

    // Initialize push notifications
    await initializePushNotifications();

    // Listen for app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('[Native] App state changed:', isActive ? 'active' : 'background');
      // Trigger any necessary updates when app comes to foreground
      if (isActive) {
        window.dispatchEvent(new Event('app-resumed'));
      }
    });

    // Listen for deep links
    App.addListener('appUrlOpen', (data) => {
      console.log('[Native] Deep link opened:', data.url);
      // Handle deep links (e.g., opening specific chat or call)
      handleDeepLink(data.url);
    });

    // Monitor network status
    Network.addListener('networkStatusChange', (status) => {
      console.log('[Native] Network status:', status.connected ? 'online' : 'offline');
      window.dispatchEvent(new CustomEvent('network-change', { detail: status }));
    });

    console.log('[Native] ✅ Native app initialized successfully');
  } catch (err) {
    console.error('[Native] Initialization error:', err);
  }
}

// ── Push Notifications ─────────────────────────────────────────────────────
export async function initializePushNotifications() {
  if (!isNativeApp) return;

  try {
    // Request permission
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive === 'granted') {
      console.log('[Native] Push notification permission granted');
      
      // Register for push notifications
      await PushNotifications.register();

      // Listen for registration
      PushNotifications.addListener('registration', (token) => {
        console.log('[Native] Push registration success, token:', token.value);
        // Send token to your backend
        savePushToken(token.value);
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Native] Push registration error:', error);
      });

      // Listen for push notifications received
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Native] Push notification received:', notification);
        // Show in-app notification
        window.dispatchEvent(new CustomEvent('push-received', { detail: notification }));
      });

      // Listen for push notification tapped
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[Native] Push notification tapped:', notification);
        // Navigate to relevant screen
        handlePushNotificationTap(notification);
      });
    } else {
      console.log('[Native] Push notification permission denied');
    }
  } catch (err) {
    console.error('[Native] Push notification setup error:', err);
  }
}

async function savePushToken(token: string) {
  // Save token to your backend/Supabase
  try {
    // Dynamic import to avoid circular dependency
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Save to push_subscriptions table with platform info
      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        subscription: { token, platform },
        created_at: new Date().toISOString()
      });
      console.log('[Native] Push token saved to database');
    }
  } catch (err) {
    console.error('[Native] Failed to save push token:', err);
  }
}

function handlePushNotificationTap(notification: any) {
  const data = notification.notification.data;
  
  // Navigate based on notification data
  if (data.type === 'call') {
    window.location.href = `/dashboard/chat?conv=${data.conversationId}&call=${data.callId}`;
  } else if (data.type === 'message') {
    window.location.href = `/dashboard/chat?conv=${data.conversationId}`;
  } else {
    window.location.href = '/dashboard/chat';
  }
}

function handleDeepLink(url: string) {
  // Parse deep link URL and navigate
  // Example: pulsechat://chat/123 or https://app.pulsechat.com/chat/123
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    window.location.href = path;
  } catch (err) {
    console.error('[Native] Failed to parse deep link:', err);
  }
}

// ── Camera ─────────────────────────────────────────────────────────────────
export async function takePicture() {
  if (!isNativeApp) {
    // Fallback to web camera
    return null;
  }

  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera
    });

    return image.webPath;
  } catch (err) {
    console.error('[Native] Camera error:', err);
    return null;
  }
}

export async function pickImage() {
  if (!isNativeApp) {
    return null;
  }

  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos
    });

    return image.webPath;
  } catch (err) {
    console.error('[Native] Image picker error:', err);
    return null;
  }
}

// ── Haptics (Vibration) ────────────────────────────────────────────────────
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!isNativeApp) return;

  try {
    const styleMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy
    };
    await Haptics.impact({ style: styleMap[style] });
  } catch (err) {
    console.error('[Native] Haptics error:', err);
  }
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!isNativeApp) return;

  try {
    await Haptics.notification({ type: type as any });
  } catch (err) {
    console.error('[Native] Haptics error:', err);
  }
}

// ── Network Status ─────────────────────────────────────────────────────────
export async function getNetworkStatus() {
  if (!isNativeApp) {
    return { connected: navigator.onLine, connectionType: 'unknown' };
  }

  try {
    const status = await Network.getStatus();
    return status;
  } catch (err) {
    console.error('[Native] Network status error:', err);
    return { connected: true, connectionType: 'unknown' };
  }
}

// ── App Info ───────────────────────────────────────────────────────────────
export async function getAppInfo() {
  if (!isNativeApp) {
    return { version: '1.0.0', build: '1' };
  }

  try {
    const info = await App.getInfo();
    return info;
  } catch (err) {
    console.error('[Native] App info error:', err);
    return { version: '1.0.0', build: '1' };
  }
}

// ── Exit App ───────────────────────────────────────────────────────────────
export async function exitApp() {
  if (!isNativeApp) return;

  try {
    await App.exitApp();
  } catch (err) {
    console.error('[Native] Exit app error:', err);
  }
}
