// Service Worker — Web Push + PWA Caching + Offline Support
// WhatsApp-style: handles push events, shows notifications, handles clicks
const SUPABASE_URL = "https://gcckwqkzjoxraikosash.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY2t3cWt6am94cmFpa29zYXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzA4MzQsImV4cCI6MjA5Mjc0NjgzNH0.BCjatcjeUane_yN9IAyI3iNdyyesq85pevZSH9LO-6E";

const CACHE_NAME = 'pulse-chat-v2';
const RUNTIME_CACHE = 'pulse-runtime-v2';

const PRECACHE_ASSETS = ['/', '/manifest.json', '/me.webp'];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  console.log('[SW] Installing v2...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname.includes('supabase')) return;

  if (request.destination === 'image' || request.destination === 'style' ||
      request.destination === 'script' || request.destination === 'font') {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const toCache = response.clone(); // clone BEFORE body is consumed
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, toCache));
          }
          return response;
        });
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const toCache = response.clone(); // clone BEFORE body is consumed
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, toCache));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
  }
});

// ── Web Push received ─────────────────────────────────────────────────────────
// This fires when a push notification arrives from the server
// Works even when the browser tab is closed (but browser must be running)
self.addEventListener("push", (e) => {
  console.log('[SW] Push received');

  // Parse payload — always have a fallback
  let data = {
    title: "Pulse Chat",
    body: "You have a new notification",
    url: "/dashboard/chat",
    tag: "msg-" + Date.now(),
    call_id: null,
    conversation_id: null,
    caller_name: null,
    type: "message",
  };

  try {
    if (e.data) {
      const parsed = e.data.json();
      data = { ...data, ...parsed };
      console.log('[SW] Push data:', data);
    }
  } catch (err) {
    console.error('[SW] Failed to parse push data:', err);
    // Try text fallback
    try {
      const text = e.data?.text();
      if (text) data.body = text;
    } catch {}
  }

  const isCall = data.type === "call" || data.tag?.startsWith("call-") || !!data.call_id;
  const isMissedCall = data.type === "missed_call";

  let notifOptions;

  if (isCall) {
    // Incoming call — high priority, require interaction, Answer/Decline buttons
    notifOptions = {
      body: data.body || `${data.caller_name || "Someone"} is calling you...`,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: data.tag || `call-${data.call_id}`,
      data: {
        url: data.url,
        call_id: data.call_id,
        conversation_id: data.conversation_id,
        is_call: true,
      },
      vibrate: [500, 200, 500, 200, 500, 200, 500],
      requireInteraction: true, // stays until user acts
      silent: false,
      renotify: true,
      actions: [
        { action: "answer", title: "✅ Answer" },
        { action: "decline", title: "❌ Decline" },
      ],
    };
  } else if (isMissedCall) {
    // Missed call — informational
    notifOptions = {
      body: data.body || "You missed a call",
      icon: "/me.webp",
      badge: "/me.webp",
      tag: data.tag || "missed-call",
      data: { url: data.url || "/dashboard/chat" },
      vibrate: [300, 100, 300],
      requireInteraction: false,
    };
  } else {
    // Regular message notification
    notifOptions = {
      body: data.body,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: data.tag || "msg-" + Date.now(),
      data: {
        url: data.url || "/dashboard/chat",
        conversation_id: data.conversation_id,
      },
      vibrate: [300, 100, 300],
      requireInteraction: false,
      silent: false,
      renotify: true,
      actions: [{ action: "open", title: "Open" }],
    };
  }

  e.waitUntil(
    self.registration.showNotification(data.title, notifOptions)
      .then(() => console.log('[SW] Notification shown:', data.title))
      .catch((err) => console.error('[SW] Failed to show notification:', err))
  );
});

// ── Message from app (relay notification) ────────────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type !== "SHOW_NOTIFICATION") return;
  const { title, body, tag, vibrate, call_id, conversation_id, url } = e.data;
  const isCall = tag?.startsWith("call-") || !!call_id;

  // Respond to the message port immediately to prevent
  // "The message port closed before a response was received" warning
  const port = e.ports?.[0];
  if (port) port.postMessage({ ok: true });

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/me.webp",
      badge: "/me.webp",
      tag: tag ?? "msg",
      data: { url: url ?? "/dashboard/chat", call_id, conversation_id, is_call: isCall },
      vibrate: vibrate || (isCall ? [500, 200, 500, 200, 500] : [300, 100, 300]),
      requireInteraction: isCall,
      renotify: true,
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

  console.log('[SW] Notification clicked, action:', action, 'call_id:', call_id);

  // Decline — update DB directly from service worker
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
      })
        .then(() => console.log('[SW] Call declined from notification'))
        .catch((err) => console.error('[SW] Failed to decline call:', err))
    );
    return;
  }

  // Answer or open — navigate to the app
  const target = (action === "answer" && call_id && url)
    ? `${url}&action=answer`
    : (url ?? "/dashboard/chat");

  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            void client.focus();
            if ("navigate" in client) void client.navigate(target);
            return;
          }
        }
        // Open new window
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});

// ── Push subscription change ──────────────────────────────────────────────────
self.addEventListener("pushsubscriptionchange", (e) => {
  console.log('[SW] Push subscription changed — re-subscribing');
  // The app will handle re-subscription on next load
});
