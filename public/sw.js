// Service Worker — Web Push + background notification relay
const SUPABASE_URL = "https://gcckwqkzjoxraikosash.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY2t3cWt6am94cmFpa29zYXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzA4MzQsImV4cCI6MjA5Mjc0NjgzNH0.BCjatcjeUane_yN9IAyI3iNdyyesq85pevZSH9LO-6E";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Web Push received ─────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let data = { title: "Notification", body: "", url: "/dashboard/chat", tag: "msg" };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}

  const isCall = data.tag?.startsWith("call-");

  e.waitUntil(
    self.registration.showNotification(data.title, isCall ? {
      body: data.body,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: data.tag,
      data: { url: data.url, call_id: data.call_id, conversation_id: data.conversation_id, is_call: true },
      vibrate: [500, 200, 500, 200, 500, 200, 500],
      requireInteraction: true,
      silent: false,
      actions: [
        { action: "answer", title: "✅ Answer" },
        { action: "decline", title: "❌ Decline" },
      ],
    } : {
      body: data.body,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: data.tag ?? "msg",
      data: { url: data.url },
      vibrate: [300, 100, 300],
      requireInteraction: false,
      actions: [{ action: "open", title: "Open" }],
    })
  );
});

// ── Background relay from app ─────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type !== "SHOW_NOTIFICATION") return;
  const { title, body, tag, vibrate, call_id, conversation_id, url } = e.data;
  const isCall = tag?.startsWith("call-");
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: tag ?? "msg",
      data: { url: url ?? "/dashboard/chat", call_id, conversation_id, is_call: isCall },
      vibrate: vibrate || (isCall ? [500, 200, 500, 200, 500] : [300, 100, 300]),
      requireInteraction: isCall,
      actions: isCall
        ? [{ action: "answer", title: "✅ Answer" }, { action: "decline", title: "❌ Decline" }]
        : [{ action: "open", title: "Open" }],
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const { url, call_id, is_call } = e.notification.data ?? {};
  const action = e.action;

  // Handle decline — update DB directly from SW
  if (action === "decline" && call_id) {
    e.waitUntil(
      fetch(`${SUPABASE_URL}/rest/v1/calls?id=eq.${call_id}&status=eq.ringing`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ status: "declined", ended_at: new Date().toISOString() }),
      }).catch(() => {})
    );
    return;
  }

  // Answer or open — navigate to the app
  const target = (action === "answer" && call_id && url) ? url : (url ?? "/dashboard/chat");

  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window and navigate
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(target);
            return;
          }
        }
        // Open new window
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
