// Service Worker — handles background push notifications

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Handle push events from server (future use with Web Push API)
self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? "New message", {
      body: data.body ?? "",
      icon: "/me.webp",
      badge: "/me.webp",
      tag: data.tag ?? "msg",
      data: { url: data.url ?? "/dashboard/chat" },
    })
  );
});

// When user clicks the notification, focus or open the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = e.notification.data?.url ?? "/dashboard/chat";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(target);
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    })
  );
});
