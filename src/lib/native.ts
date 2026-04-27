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

      // Listen for push notifications received (app in foreground)
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Native] Push notification received:', notification);
        
        // Trigger haptic feedback
        Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
        
        // Show in-app notification banner
        window.dispatchEvent(new CustomEvent('push-received', { 
          detail: {
            title: notification.title,
            body: notification.body,
            data: notification.data
          }
        }));
      });

      // Listen for push notification tapped (app in background/closed)
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[Native] Push notification tapped:', notification);
        
        // Trigger haptic feedback
        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
        
        // Navigate to relevant screen
        handlePushNotificationTap(notification);
      });

      // Create notification channels for Android
      if (platform === 'android') {
        await createNotificationChannels();
      }
    } else {
      console.log('[Native] Push notification permission denied');
    }
  } catch (err) {
    console.error('[Native] Push notification setup error:', err);
  }
}

// Create notification channels for Android
async function createNotificationChannels() {
  try {
    // Messages channel
    await PushNotifications.createChannel({
      id: 'messages',
      name: 'Messages',
      description: 'New message notifications',
      importance: 5, // Max importance
      visibility: 1, // Public
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#25D366', // WhatsApp green
    });

    // Calls channel
    await PushNotifications.createChannel({
      id: 'calls',
      name: 'Calls',
      description: 'Incoming call notifications',
      importance: 5, // Max importance
      visibility: 1, // Public
      sound: 'ringtone',
      vibration: true,
      lights: true,
      lightColor: '#25D366',
    });

    // General channel
    await PushNotifications.createChannel({
      id: 'general',
      name: 'General',
      description: 'General notifications',
      importance: 4, // High importance
      visibility: 1, // Public
      sound: 'default',
      vibration: true,
    });

    console.log('[Native] Notification channels created');
  } catch (err) {
    console.error('[Native] Failed to create notification channels:', err);
  }
}

// Show a local notification (for testing or immediate display)
export async function showLocalNotification(
  title: string,
  body: string,
  data?: any
) {
  if (!isNativeApp) return;

  try {
    // Trigger haptic feedback
    await Haptics.impact({ style: ImpactStyle.Medium });

    // Dispatch event for in-app handling
    window.dispatchEvent(new CustomEvent('show-native-notification', {
      detail: { title, body, data }
    }));

    console.log('[Native] Local notification shown:', title);
  } catch (err) {
    console.error('[Native] Local notification error:', err);
  }
}

async function savePushToken(token: string) {
  // Save FCM token to Supabase for native push notifications
  try {
    // Dynamic import to avoid circular dependency
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      console.log('[Native] Saving FCM token for user:', user.id);
      
      // Save to push_subscriptions table with FCM token
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        fcm_token: token, // FCM token for native notifications
        platform: platform, // 'android' or 'ios'
        endpoint: `fcm:${token}`, // Unique identifier
        p256dh: 'native', // Placeholder for native apps
        auth: 'native', // Placeholder for native apps
        created_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,endpoint' 
      });
      
      if (error) {
        console.error('[Native] Error saving FCM token:', error);
      } else {
        console.log('[Native] FCM token saved successfully');
      }
    }
  } catch (err) {
    console.error('[Native] Failed to save push token:', err);
  }
}

function handlePushNotificationTap(notification: any) {
  const data = notification.notification.data;
  const actionId = notification.actionId; // "ANSWER_CALL" or "DECLINE_CALL"
  
  console.log('[Native] Notification tap - Action:', actionId, 'Data:', data);
  
  // Handle call actions from notification buttons
  if (actionId === 'ANSWER_CALL' || data.action === 'answer_call') {
    console.log('[Native] User answered call from notification');
    // Navigate to chat with call answer intent
    window.location.href = `/dashboard/chat?conv=${data.conversation_id || data.conversationId}&call=${data.call_id || data.callId}&action=answer`;
  } else if (actionId === 'DECLINE_CALL' || data.action === 'decline_call') {
    console.log('[Native] User declined call from notification');
    // Navigate to chat with decline intent
    window.location.href = `/dashboard/chat?conv=${data.conversation_id || data.conversationId}&call=${data.call_id || data.callId}&action=decline`;
  } else if (data.type === 'call' || data.call_id) {
    // Regular tap on call notification (not action button)
    window.location.href = `/dashboard/chat?conv=${data.conversation_id || data.conversationId}&call=${data.call_id || data.callId}`;
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
