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

  const appVisible = document.visibilityState === "visible";

  // ── Always show basic notification when app is visible (foreground) ────────
  // This works reliably on all browsers including laptop
  if (appVisible) {
    _showBasicNotification(title, body, options);
    return;
  }

  // ── App is in background — use SW for reliable background delivery ─────────

  // Path 1: SW is controlling the page — postMessage (most reliable)
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        body,
        tag: options?.tag ?? "msg",
      });
      return;
    } catch {
      // fall through
    }
  }

  // Path 2: SW registered but not yet controlling — wait briefly then use showNotification
  if ("serviceWorker" in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
      ]);
      if (reg && "showNotification" in reg) {
        await (reg as ServiceWorkerRegistration).showNotification(title, {
          body,
          icon: options?.icon ?? "/me.webp",
          tag: options?.tag ?? "msg",
          data: { url: "/dashboard/chat" },
          vibrate: [200, 100, 200],
        } as NotificationOptions);
        return;
      }
    } catch {
      // fall through
    }
  }

  // Path 3: No SW — basic Notification API fallback
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
    // Notification API blocked or unavailable
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
