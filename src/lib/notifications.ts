import { supabase } from "@/integrations/supabase/client";
import { isNativeApp, platform } from "./native";
import { PushNotifications } from '@capacitor/push-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// ─── Unified Notification System ──────────────────────────────────────────────
// Automatically uses native push notifications on mobile apps
// Falls back to web push notifications on web browsers

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

export async function requestNotificationPermission(): Promise<boolean> {
  // Native app - use Capacitor Push Notifications
  if (isNativeApp) {
    try {
      const permission = await PushNotifications.requestPermissions();
      return permission.receive === 'granted';
    } catch (err) {
      console.error('[Notifications] Native permission error:', err);
      return false;
    }
  }
  
  // Web app - use Web Notifications API
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

export function canNotify(): boolean {
  // Native app - always return true if initialized
  if (isNativeApp) {
    return true; // Capacitor handles permissions internally
  }
  
  // Web app - check Notification API
  return "Notification" in window && Notification.permission === "granted";
}

// Subscribe this device to Push Notifications and store in DB
// Automatically handles both native (FCM/APNs) and web push
export async function subscribeToWebPush(userId: string): Promise<boolean> {
  // Native app - handled by Capacitor in native.ts
  if (isNativeApp) {
    console.log('[Notifications] Native push handled by Capacitor');
    return true;
  }
  
  // Web app - use Web Push API
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (!canNotify()) return false;
  if (!VAPID_PUBLIC) return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      // Subscribe with VAPID public key
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    // Store in Supabase
    await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }, { onConflict: "user_id,endpoint" });

    return true;
  } catch {
    return false;
  }
}

// Send a push notification via backend
// Automatically routes to FCM/APNs for native apps or Web Push for web
export async function sendWebPush(
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  try {
    await supabase.functions.invoke("send-push", {
      body: { 
        user_id: userId, 
        title, 
        body, 
        url,
        platform: isNativeApp ? platform : 'web'
      },
    });
  } catch (err) {
    console.error("Push notification error:", err);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// ─── Show Local Notification ──────────────────────────────────────────────────
// Uses native notifications on mobile, web notifications on browser

export async function sendPushNotification(
  title: string,
  body: string,
  options?: { 
    icon?: string; 
    tag?: string; 
    requireInteraction?: boolean; 
    onClick?: () => void;
    data?: any;
  }
) {
  // Native app - use Capacitor Local Notifications
  if (isNativeApp) {
    try {
      // Trigger haptic feedback
      await Haptics.impact({ style: ImpactStyle.Medium });
      
      // Schedule local notification
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Default',
        description: 'Default notification channel',
        importance: 5, // Max importance
        visibility: 1, // Public
        sound: 'default',
        vibration: true,
      });

      // Show notification using Capacitor
      const { PushNotifications: LocalNotifications } = await import('@capacitor/push-notifications');
      
      // For immediate display, we use the push notification received event
      window.dispatchEvent(new CustomEvent('show-native-notification', {
        detail: { title, body, data: options?.data }
      }));
      
      console.log('[Notifications] Native notification shown:', title);
      return;
    } catch (err) {
      console.error('[Notifications] Native notification error:', err);
      // Fall through to web notification
    }
  }

  // Web app - use Web Notifications API
  if (!canNotify()) {
    console.warn('[Notifications] Cannot show notification - permission not granted');
    return;
  }

  const appVisible = document.visibilityState === "visible";

  if (appVisible) {
    // App is open — show basic notification directly
    _showBasicNotification(title, body, options);
    return;
  }

  // App is in background — use Service Worker
  // Only postMessage when the controller is fully activated to avoid
  // "message port closed before a response was received" warnings
  const swController = navigator.serviceWorker?.controller;
  if (swController && swController.state === "activated") {
    try {
      swController.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        body,
        tag: options?.tag ?? "msg",
        vibrate: [400, 200, 400, 200, 400],
        requireInteraction: options?.requireInteraction ?? false,
        data: options?.data,
      });
      return;
    } catch (err) {
      console.error("SW notification error:", err);
    }
  }

  if ("serviceWorker" in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
      ]);
      if (reg && "showNotification" in reg) {
        await (reg as ServiceWorkerRegistration).showNotification(title, {
          body,
          icon: options?.icon ?? "/me.webp",
          tag: options?.tag ?? "msg",
          data: options?.data ?? { url: "/dashboard/chat" },
          vibrate: [400, 200, 400, 200, 400],
          badge: "/me.webp",
          requireInteraction: options?.requireInteraction ?? true,
          actions: [
            { action: "open", title: "Open" },
            { action: "close", title: "Close" }
          ]
        } as NotificationOptions);
        return;
      }
    } catch (err) {
      console.error("SW ready error:", err);
    }
  }

  _showBasicNotification(title, body, options);
}

function _showBasicNotification(
  title: string,
  body: string,
  options?: { icon?: string; tag?: string; requireInteraction?: boolean; onClick?: () => void; data?: any }
) {
  try {
    const n = new Notification(title, {
      body,
      icon: options?.icon ?? "/me.webp",
      tag: options?.tag,
      vibrate: [400, 200, 400, 200, 400],
      requireInteraction: options?.requireInteraction ?? true,
      data: options?.data,
    });
    n.onclick = () => { 
      window.focus(); 
      options?.onClick?.(); 
      n.close();
    };
  } catch (err) {
    console.error("Notification error:", err);
  }
}

// ─── Unread Message Reminders ──────────────────────────────────────────────────

let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startUnreadReminder(getUnreadCount: () => number, isAdmin: boolean) {
  stopUnreadReminder();
  reminderTimer = setInterval(() => {
    const count = getUnreadCount();
    if (count > 0 && canNotify()) {
      void sendPushNotification(
        isAdmin ? "📬 Unread messages" : "💬 You have a reply",
        isAdmin
          ? `You have ${count} unread message${count > 1 ? "s" : ""} from client${count > 1 ? "s" : ""}.`
          : `You have ${count} unread message${count > 1 ? "s" : ""} from Ajibola.`,
        { tag: "unread-reminder", data: { type: 'unread', count } }
      );
    }
  }, 15 * 60 * 1000);
}

export function stopUnreadReminder() {
  if (reminderTimer) { clearInterval(reminderTimer); reminderTimer = null; }
}

// ─── Background Message Polling ────────────────────────────────────────────────

let bgRefreshTimer: ReturnType<typeof setInterval> | null = null;

export function startBackgroundRefresh(onRefresh: () => void) {
  stopBackgroundRefresh();
  
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // App went to background — start polling for new messages
      console.log("[Notifications] App hidden - starting background refresh");
      bgRefreshTimer = setInterval(() => {
        onRefresh();
      }, 5000); // Poll every 5 seconds in background
    } else {
      // App came to foreground — stop background polling
      console.log("[Notifications] App visible - stopping background refresh");
      stopBackgroundRefresh();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  
  // Return cleanup function
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    stopBackgroundRefresh();
  };
}

export function stopBackgroundRefresh() {
  if (bgRefreshTimer) {
    clearInterval(bgRefreshTimer);
    bgRefreshTimer = null;
  }
}
