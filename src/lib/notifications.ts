// ─── Cross-browser Push Notification helper ───────────────────────────────────

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

export async function sendPushNotification(
  title: string,
  body: string,
  options?: { icon?: string; tag?: string; onClick?: () => void }
) {
  if (!canNotify()) return;

  // Check if any app window is currently visible/focused
  const appVisible = !document.hidden && document.visibilityState === "visible";

  // If app is in background/minimized, use service worker to show notification
  // (this works even when phone is locked or app is backgrounded)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;

      if (!appVisible) {
        // App is in background — use SW to show notification (works on mobile)
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SHOW_NOTIFICATION",
            title,
            body,
            tag: options?.tag,
          });
          return;
        }
        // Fallback: use showNotification directly
        await reg.showNotification(title, {
          body,
          icon: options?.icon ?? "/me.webp",
          tag: options?.tag,
          data: { url: "/dashboard/chat" },
        });
        return;
      }

      // App is visible — still show notification (user might be on a different tab)
      await reg.showNotification(title, {
        body,
        icon: options?.icon ?? "/me.webp",
        tag: options?.tag,
        data: { url: "/dashboard/chat" },
      });
      return;
    } catch {
      // SW not ready — fall through to basic notification
    }
  }

  // Fallback: basic Notification API (no SW)
  _showBasicNotification(title, body, options);
}

function _showBasicNotification(
  title: string,
  body: string,
  options?: { icon?: string; tag?: string; onClick?: () => void }
) {
  try {
    const n = new Notification(title, {
      body,
      icon: options?.icon ?? "/me.webp",
      tag: options?.tag,
    });
    n.onclick = () => {
      window.focus();
      options?.onClick?.();
      n.close();
    };
    setTimeout(() => n.close(), 6000);
  } catch {
    // Notification API not available
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
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}
