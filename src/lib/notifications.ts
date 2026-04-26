// ─── Browser Push Notification helper ────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function canNotify(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

export function sendPushNotification(title: string, body: string, options?: { icon?: string; tag?: string; onClick?: () => void }) {
  if (!canNotify()) return;

  // Use service worker registration if available — works in background on mobile
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: options?.icon ?? "/me.webp",
        badge: "/me.webp",
        tag: options?.tag,
        requireInteraction: false,
        silent: false,
        data: { url: "/dashboard/chat" },
      } as NotificationOptions);
    }).catch(() => {
      // Fallback to regular Notification
      _showBasicNotification(title, body, options);
    });
  } else {
    _showBasicNotification(title, body, options);
  }
}

function _showBasicNotification(title: string, body: string, options?: { icon?: string; tag?: string; onClick?: () => void }) {
  const n = new Notification(title, {
    body,
    icon: options?.icon ?? "/me.webp",
    badge: "/me.webp",
    tag: options?.tag,
    requireInteraction: false,
    silent: false,
  });
  if (options?.onClick) {
    n.onclick = () => { window.focus(); options.onClick!(); n.close(); };
  }
  setTimeout(() => n.close(), 6000);
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
          ? `You have ${count} unread message${count > 1 ? "s" : ""} from client${count > 1 ? "s" : ""}. Don't leave them waiting!`
          : `You have ${count} unread message${count > 1 ? "s" : ""} from Ajibola. Tap to read.`,
        { tag: "unread-reminder" }
      );
    }
  }, 15 * 60 * 1000); // every 15 minutes
}

export function stopUnreadReminder() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}
