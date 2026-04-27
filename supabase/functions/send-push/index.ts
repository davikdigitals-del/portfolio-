import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push via VAPID — sends real push notifications that wake the phone
// even when the browser is closed

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Base64url helpers
function base64urlToUint8(b64: string): Uint8Array {
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

function uint8ToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Build VAPID JWT
async function buildVapidJwt(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "mailto:admin@ajibola.dev",
  };

  const enc = new TextEncoder();
  const headerB64 = uint8ToBase64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ToBase64url(enc.encode(JSON.stringify(payload)));
  const sigInput = `${headerB64}.${payloadB64}`;

  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    (() => {
      // Convert raw private key scalar to PKCS8
      const raw = base64urlToUint8(VAPID_PRIVATE);
      // PKCS8 wrapper for P-256 private key
      const pkcs8Header = new Uint8Array([
        0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
        0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce,
        0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01,
        0x04, 0x20,
      ]);
      const combined = new Uint8Array(pkcs8Header.length + raw.length);
      combined.set(pkcs8Header);
      combined.set(raw, pkcs8Header.length);
      return combined.buffer;
    })(),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    enc.encode(sigInput)
  );

  return `${sigInput}.${uint8ToBase64url(new Uint8Array(sig))}`;
}

// Encrypt payload for Web Push (RFC 8291)
async function encryptPayload(
  subscription: { p256dh: string; auth: string },
  payload: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const enc = new TextEncoder();
  const plaintext = enc.encode(payload);

  // Generate server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    base64urlToUint8(subscription.p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      serverKeyPair.privateKey,
      256
    )
  );

  const authSecret = base64urlToUint8(subscription.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive content encryption key and nonce
  const prk = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);

  // Auth secret HKDF
  const authInfo = enc.encode("Content-Encoding: auth\0");
  const authPrk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: authInfo },
    prk, 256
  ));

  const keyMaterial = await crypto.subtle.importKey("raw", authPrk, "HKDF", false, ["deriveBits"]);

  // Derive CEK
  const cekInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: aesgcm\0"),
    0x00, 0x41, ...serverPublicKeyRaw, 0x00, 0x41, ...base64urlToUint8(subscription.p256dh)
  ]);
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    keyMaterial, 128
  ));

  // Derive nonce
  const nonceInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: nonce\0"),
    0x00, 0x41, ...serverPublicKeyRaw, 0x00, 0x41, ...base64urlToUint8(subscription.p256dh)
  ]);
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    keyMaterial, 96
  ));

  // Encrypt with AES-GCM
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const paddedPlaintext = new Uint8Array(plaintext.length + 2);
  paddedPlaintext.set([0, 0]); // padding length = 0
  paddedPlaintext.set(plaintext, 2);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPlaintext)
  );

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Max-Age": "86400",
      } 
    });
  }

  try {
    const { user_id, title, body, url } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get all push subscriptions for this user (both web and native)
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, fcm_token, platform")
      .eq("user_id", user_id);

    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { 
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }

    const payload = JSON.stringify({ title, body, url: url ?? "/dashboard/chat" });
    const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");
    let sent = 0;

    for (const sub of subs) {
      try {
        // Native app with FCM token - use Firebase Cloud Messaging
        if (sub.fcm_token && FCM_SERVER_KEY) {
          console.log("Sending FCM notification to:", sub.platform);
          
          const fcmPayload = {
            to: sub.fcm_token,
            priority: "high",
            notification: {
              title,
              body,
              sound: "default",
              badge: 1,
            },
            data: {
              url: url ?? "/dashboard/chat",
              type: "message",
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "messages",
                sound: "default",
              },
            },
          };
          
          const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Authorization": `key=${FCM_SERVER_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fcmPayload),
          });
          
          if (fcmRes.ok) {
            sent++;
          } else {
            const errorText = await fcmRes.text();
            console.error("FCM failed:", fcmRes.status, errorText);
            
            // Remove invalid token
            if (fcmRes.status === 404 || errorText.includes("NotRegistered")) {
              await supabase.from("push_subscriptions").delete().eq("fcm_token", sub.fcm_token);
            }
          }
        }
        // Web app - use Web Push
        else if (sub.endpoint && sub.p256dh && sub.auth) {
          const origin = new URL(sub.endpoint).origin;
          const jwt = await buildVapidJwt(origin);
          const vapidHeader = `vapid t=${jwt},k=${VAPID_PUBLIC}`;

          const { ciphertext, salt, serverPublicKey } = await encryptPayload(sub, payload);

          const res = await fetch(sub.endpoint, {
            method: "POST",
            headers: {
              "Authorization": vapidHeader,
              "Content-Type": "application/octet-stream",
              "Content-Encoding": "aesgcm",
              "Encryption": `salt=${uint8ToBase64url(salt)}`,
              "Crypto-Key": `dh=${uint8ToBase64url(serverPublicKey)};p256ecdsa=${VAPID_PUBLIC}`,
              "TTL": "86400",
            },
            body: ciphertext,
          });

          if (res.status === 410 || res.status === 404) {
            // Subscription expired — remove it
            await supabase.from("push_subscriptions").delete()
              .eq("endpoint", sub.endpoint);
          } else if (res.ok || res.status === 201) {
            sent++;
          }
        }
      } catch { /* skip failed subscription */ }
    }

    return new Response(JSON.stringify({ sent }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });
  }
});
