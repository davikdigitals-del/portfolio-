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

export function sendPushNotification(
  title: string,
  body: string,
  options?: { icon?: string; tag?: string; onClick?: () => void }
) {
  if (!canNotify()) return;

  // Try service worker first (works in background on all browsers that support it)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        // showNotification is supported in all modern browsers with SW
        return reg.showNotification(title, {
          body,
          icon: options?.icon ?? "/me.webp",
          tag: options?.tag,
          data: { url: "/dashboard/chat" },
        });
      })
      .catch(() => {
        // SW not ready or not supported — fall back to basic Notification
        _showBasicNotification(title, body, options);
      });
    return;
  }

  // No service worker support — use basic Notification API
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
    // Notification API not available (e.g. iOS Safari)
  }
}

// ─── 15-minute unread reminder ────────────────────────────────────────────────

let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startUnreadReminder(getUnreadCount: () => number, isAdmin: boolean) {
  stopUnreadReminder();
  reminderTimer = setInterval(() => {
    const count = getUnreadCount();
    if (count > 0 && canNotify()) {
      sendPushNotification(
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
