// Service Worker — Web Push + background notification relay

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Real Web Push (wakes phone even when browser is closed) ──────────────────
self.addEventListener("push", (e) => {
  let data = { title: "Notification", body: "", url: "/dashboard/chat", tag: "msg" };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (err) {
    console.error("Push data parse error:", err);
  }

  const isCall = data.tag?.startsWith("call-");

  const notifOptions = isCall
    ? {
        body: data.body,
        icon: "/me.webp",
        badge: "/me.webp",
        tag: data.tag,
        data: { url: data.url, call_id: data.call_id, conversation_id: data.conversation_id },
        vibrate: [500, 200, 500, 200, 500, 200, 500], // Long aggressive vibration for calls
        requireInteraction: true, // NEVER auto-dismiss a call notification
        silent: false,
        actions: [
          { action: "answer", title: "✅ Answer" },
          { action: "decline", title: "❌ Decline" },
        ],
      }
    : {
        body: data.body,
        icon: "/me.webp",
        badge: "/me.webp",
        tag: data.tag ?? "msg",
        data: { url: data.url },
        vibrate: [300, 100, 300],
        requireInteraction: false,
        actions: [
          { action: "open", title: "Open" },
        ],
      };

  e.waitUntil(self.registration.showNotification(data.title, notifOptions));
});

// ── Background relay (app is open but tab is hidden) ─────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type !== "SHOW_NOTIFICATION") return;
  const { title, body, tag, vibrate } = e.data;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: tag ?? "msg",
      data: { url: "/dashboard/chat" },
      vibrate: vibrate || [300, 100, 300],
      requireInteraction: tag?.startsWith("call-"),
      actions: tag?.startsWith("call-")
        ? [{ action: "answer", title: "✅ Answer" }, { action: "decline", title: "❌ Decline" }]
        : [{ action: "open", title: "Open" }],
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();

  const { url, call_id, conversation_id } = e.notification.data ?? {};
  const action = e.action;

  // Decline: just close
  if (action === "decline") return;

  // Answer or open: navigate to the chat (with call params if it's a call)
  const target = url ?? "/dashboard/chat";

  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Try to focus an existing window
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(target);
            return;
          }
        }
        // No existing window — open a new one
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
