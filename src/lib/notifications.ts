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

  const appFocused = document.visibilityState === "visible" && document.hasFocus();

  // ── Path 1: Service Worker available and controlling the page ────────────
  // Best for background/locked screen on both mobile and laptop
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    try {
      // Post to SW — works even when tab is hidden or phone is locked
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        body,
        tag: options?.tag ?? "msg",
      });

      // If app is focused on laptop, ALSO show a basic notification
      // because SW notifications don't appear when the page is focused in some browsers
      if (appFocused) {
        _showBasicNotification(title, body, options);
      }
      return;
    } catch {
      // fall through
    }
  }

  // ── Path 2: SW registered but not yet controlling (first load on laptop) ──
  if ("serviceWorker" in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
      ]);
      if (reg && "showNotification" in reg) {
        await (reg as ServiceWorkerRegistration).showNotification(title, {
          body,
          icon: options?.icon ?? "/me.webp",
          tag: options?.tag ?? "msg",
          data: { url: "/dashboard/chat" },
        });
        return;
      }
    } catch {
      // fall through
    }
  }

  // ── Path 3: No SW — basic Notification API (always works on laptop) ───────
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
