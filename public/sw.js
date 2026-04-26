// Service Worker — Web Push + background notification relay

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Real Web Push (wakes phone even when browser is closed) ──────────────────
self.addEventListener("push", (e) => {
  let data = { title: "New message", body: "", url: "/dashboard/chat" };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch { /* use defaults */ }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: "msg-push",
      data: { url: data.url },
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: false,
    })
  );
});

// ── Background relay (app is open but tab is hidden) ─────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type !== "SHOW_NOTIFICATION") return;
  const { title, body, tag } = e.data;
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: tag ?? "msg",
      data: { url: "/dashboard/chat" },
      vibrate: [200, 100, 200],
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = e.notification.data?.url ?? "/dashboard/chat";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(target);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
