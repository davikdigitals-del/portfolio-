// Service Worker — Web Push + background notification relay
// Aggressive notification strategy for iPhone/Safari

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Real Web Push (wakes phone even when browser is closed) ──────────────────
self.addEventListener("push", (e) => {
  let data = { title: "New message", body: "", url: "/dashboard/chat" };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (err) {
    console.error("Push data parse error:", err);
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: "msg-push",
      data: { url: data.url },
      vibrate: [400, 200, 400, 200, 400], // Very strong vibration for iPhone
      requireInteraction: true, // Keep notification visible on iPhone
      actions: [
        { action: "open", title: "Open" },
        { action: "close", title: "Close" }
      ]
    })
  );
});

// ── Background relay (app is open but tab is hidden) ─────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type !== "SHOW_NOTIFICATION") return;
  const { title, body, tag, vibrate, count } = e.data;
  
  // Show multiple notifications if count > 1 to break through notification grouping
  const notificationPromises = [];
  const numNotifications = Math.min(count || 1, 3); // Max 3 notifications
  
  for (let i = 0; i < numNotifications; i++) {
    notificationPromises.push(
      self.registration.showNotification(title, {
        body: body + (i > 0 ? ` (${i + 1})` : ""),
        icon: "/me.webp",
        badge: "/me.webp",
        tag: tag ? `${tag}-${i}` : `msg-${i}`,
        data: { url: "/dashboard/chat" },
        vibrate: vibrate || [400, 200, 400, 200, 400], // Very strong vibration
        requireInteraction: true, // Keep notification visible
        actions: [
          { action: "open", title: "Open" },
          { action: "close", title: "Close" }
        ]
      })
    );
  }
  
  e.waitUntil(Promise.all(notificationPromises));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  
  if (e.action === "close") {
    return;
  }
  
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
      .catch((err) => {
        console.error("Notification click error:", err);
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});

// ── Notification close ────────────────────────────────────────────────────────
self.addEventListener("notificationclose", (e) => {
  console.log("Notification closed:", e.notification.tag);
});
