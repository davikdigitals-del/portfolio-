// Service Worker — handles background push notifications

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Handle push events from server (Web Push API) ────────────────────────────
self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? "New message", {
      body: data.body ?? "",
      icon: "/me.webp",
      tag: data.tag ?? "msg",
      data: { url: data.url ?? "/dashboard/chat" },
      vibrate: [200, 100, 200],
    })
  );
});

// ── Handle messages from the app ─────────────────────────────────────────────
// App posts here when it wants to show a notification (background/locked screen)
self.addEventListener("message", (e) => {
  if (e.data?.type !== "SHOW_NOTIFICATION") return;
  const { title, body, tag } = e.data;
  // Always show — the app already decided it needs a notification
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/me.webp",
      tag: tag ?? "msg",
      data: { url: "/dashboard/chat" },
      vibrate: [200, 100, 200],
    })
  );
});

// ── Notification click — focus or open the app ───────────────────────────────
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
