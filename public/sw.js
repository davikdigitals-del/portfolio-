// Service Worker — handles background push notifications and message relay

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
      requireInteraction: false,
    })
  );
});

// ── Handle messages from the app (background notification relay) ─────────────
// When the app is in background/minimized, it posts a message here to show a notification
self.addEventListener("message", (e) => {
  if (e.data?.type === "SHOW_NOTIFICATION") {
    const { title, body, tag } = e.data;
    e.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/me.webp",
        tag: tag ?? "msg",
        data: { url: "/dashboard/chat" },
        requireInteraction: false,
        vibrate: [200, 100, 200],
      })
    );
  }
});

// ── When user clicks the notification, focus or open the app ─────────────────
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
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
      })
  );
});
