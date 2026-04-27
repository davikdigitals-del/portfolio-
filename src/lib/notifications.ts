import { supabase } from "@/integrations/supabase/client";

// ─── Web Push subscription ────────────────────────────────────────────────────

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

export async function requestNotificationPermission(): Promise<boolean> {
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
  return "Notification" in window && Notification.permission === "granted";
}

// Subscribe this device to Web Push and store in DB
// Call this after permission is granted
export async function subscribeToWebPush(userId: string): Promise<boolean> {
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

// Send a real Web Push notification via the Edge Function
// This wakes the phone even when browser is closed
export async function sendWebPush(
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  try {
    await supabase.functions.invoke("send-push", {
      body: { user_id: userId, title, body, url },
    });
  } catch (err) {
    console.error("Web push error:", err);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// ─── Aggressive notification system for iPhone/Safari ───────────────────────

// Keep track of notification state to prevent sleep
let notificationState = {
  lastNotificationTime: 0,
  notificationCount: 0,
  isShowingNotification: false,
};

// Wake lock to prevent device sleep
let wakeLock: any = null;

async function acquireWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await (navigator as any).wakeLock.request("screen");
      console.log("Wake lock acquired");
    }
  } catch (err) {
    console.error("Wake lock error:", err);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// ─── In-app / SW notification (for foreground + background tab) ───────────────

export async function sendPushNotification(
  title: string,
  body: string,
  options?: { icon?: string; tag?: string; requireInteraction?: boolean; onClick?: () => void }
) {
  if (!canNotify()) return;

  const appVisible = document.visibilityState === "visible";
  const now = Date.now();
  
  // Prevent notification spam
  if (now - notificationState.lastNotificationTime < 500) {
    return;
  }
  
  notificationState.lastNotificationTime = now;
  notificationState.notificationCount++;
  notificationState.isShowingNotification = true;

  // Acquire wake lock to prevent sleep
  await acquireWakeLock();

  if (appVisible) {
    // App is open — show basic notification directly
    _showBasicNotification(title, body, options);
    return;
  }

  // App is in background — use SW with aggressive wake-up
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        body,
        tag: options?.tag ?? "msg",
        vibrate: [400, 200, 400, 200, 400], // Very strong vibration
        count: notificationState.notificationCount,
        requireInteraction: options?.requireInteraction ?? false,
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
          data: { url: "/dashboard/chat" },
          vibrate: [400, 200, 400, 200, 400], // Very strong vibration
          badge: "/me.webp",
          requireInteraction: options?.requireInteraction ?? true, // Keep notification until user interacts
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
  options?: { icon?: string; tag?: string; requireInteraction?: boolean; onClick?: () => void }
) {
  try {
    const n = new Notification(title, {
      body,
      icon: options?.icon ?? "/me.webp",
      tag: options?.tag,
      vibrate: [400, 200, 400, 200, 400], // Very strong vibration
      requireInteraction: options?.requireInteraction ?? true, // Keep notification until user interacts
    });
    n.onclick = () => { 
      window.focus(); 
      options?.onClick?.(); 
      n.close();
      releaseWakeLock();
      notificationState.isShowingNotification = false;
    };
    n.onclose = () => {
      releaseWakeLock();
      notificationState.isShowingNotification = false;
    };
    // Don't auto-close — let user dismiss it
  } catch (err) {
    console.error("Notification error:", err);
  }
}

// ─── 15-minute unread reminder ────────────────────────────────────────────────

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
        { tag: "unread-reminder" }
      );
    }
  }, 15 * 60 * 1000);
}

export function stopUnreadReminder() {
  if (reminderTimer) { clearInterval(reminderTimer); reminderTimer = null; }
}

// ─── Background refresh when app is hidden ────────────────────────────────────

let bgRefreshTimer: ReturnType<typeof setInterval> | null = null;

export function startBackgroundRefresh(onRefresh: () => void) {
  stopBackgroundRefresh();
  
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // App went to background — start aggressive refresh
      console.log("App hidden - starting background refresh");
      bgRefreshTimer = setInterval(() => {
        onRefresh();
      }, 3000); // Refresh every 3 seconds in background (more aggressive)
    } else {
      // App came to foreground — stop background refresh
      console.log("App visible - stopping background refresh");
      stopBackgroundRefresh();
      releaseWakeLock();
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
