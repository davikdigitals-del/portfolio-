// Edge function triggered by DB webhook on calls INSERT
// Sends a Web Push notification to the receiver so their phone rings
// even when the browser/app is completely backgrounded or closed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

// ── Base64url helpers ─────────────────────────────────────────────────────────
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

// ── VAPID JWT ─────────────────────────────────────────────────────────────────
async function buildVapidJwt(audience: string): Promise<string> {
  const enc = new TextEncoder();
  const header = uint8ToBase64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = uint8ToBase64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: "mailto:admin@ajibola.dev",
  })));
  const sigInput = `${header}.${payload}`;

  const raw = base64urlToUint8(VAPID_PRIVATE);
  const pkcs8Header = new Uint8Array([
    0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,
    0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x27,
    0x30,0x25,0x02,0x01,0x01,0x04,0x20,
  ]);
  const pkcs8 = new Uint8Array(pkcs8Header.length + raw.length);
  pkcs8.set(pkcs8Header); pkcs8.set(raw, pkcs8Header.length);

  const privKey = await crypto.subtle.importKey(
    "pkcs8", pkcs8.buffer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, privKey, enc.encode(sigInput)
  );
  return `${sigInput}.${uint8ToBase64url(new Uint8Array(sig))}`;
}

// ── Encrypt payload (RFC 8291 aesgcm) ────────────────────────────────────────
async function encryptPayload(sub: { p256dh: string; auth: string }, payload: string) {
  const enc = new TextEncoder();
  const plaintext = enc.encode(payload);

  const serverKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKP.publicKey));

  const clientPub = await crypto.subtle.importKey(
    "raw", base64urlToUint8(sub.p256dh), { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPub }, serverKP.privateKey, 256
  ));

  const authSecret = base64urlToUint8(sub.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prk = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
  const authPrk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: enc.encode("Content-Encoding: auth\0") },
    prk, 256
  ));
  const km = await crypto.subtle.importKey("raw", authPrk, "HKDF", false, ["deriveBits"]);

  const cekInfo = new Uint8Array([...enc.encode("Content-Encoding: aesgcm\0"), 0x00, 0x41, ...serverPubRaw, 0x00, 0x41, ...base64urlToUint8(sub.p256dh)]);
  const cek = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: cekInfo }, km, 128));

  const nonceInfo = new Uint8Array([...enc.encode("Content-Encoding: nonce\0"), 0x00, 0x41, ...serverPubRaw, 0x00, 0x41, ...base64urlToUint8(sub.p256dh)]);
  const nonce = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, km, 96));

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const padded = new Uint8Array(plaintext.length + 2);
  padded.set([0, 0]); padded.set(plaintext, 2);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));

  return { ciphertext, salt, serverPublicKey: serverPubRaw };
}

// ── Send one push ─────────────────────────────────────────────────────────────
async function sendOnePush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const origin = new URL(sub.endpoint).origin;
  const jwt = await buildVapidJwt(origin);
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(sub, payload);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption": `salt=${uint8ToBase64url(salt)}`,
      "Crypto-Key": `dh=${uint8ToBase64url(serverPublicKey)};p256ecdsa=${VAPID_PUBLIC}`,
      "TTL": "60",
      "Urgency": "high",
    },
    body: ciphertext,
  });
  return res;
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  try {
    const body = await req.json();

    // Support both direct call and DB webhook payload
    const record = body.record ?? body;
    const { id: call_id, receiver_id, initiator_id, call_type, conversation_id } = record;

    if (!receiver_id || !call_id) {
      return new Response(JSON.stringify({ error: "Missing receiver_id or call_id" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get caller's display name
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", initiator_id)
      .maybeSingle();

    const callerName = callerProfile?.display_name ?? "Someone";
    const isVideo = call_type === "video";

    const pushPayload = JSON.stringify({
      title: isVideo ? "📹 Incoming Video Call" : "☎️ Incoming Voice Call",
      body: `${callerName} is calling you...`,
      url: `/dashboard/chat?conv=${conversation_id}&call=${call_id}`,
      tag: `call-${call_id}`,
      call_id,
      call_type,
      conversation_id,
      caller_name: callerName,
    });

    // Get all push subscriptions for the receiver
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", receiver_id);

    if (!subs?.length) {
      console.log("No push subscriptions for receiver:", receiver_id);
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), { status: 200 });
    }

    let sent = 0;
    for (const sub of subs) {
      try {
        const res = await sendOnePush(sub, pushPayload);
        if (res.status === 410 || res.status === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        } else if (res.ok || res.status === 201) {
          sent++;
        } else {
          console.error("Push failed:", res.status, await res.text());
        }
      } catch (e) {
        console.error("Push error:", e);
      }
    }

    console.log(`Sent ${sent}/${subs.length} call push notifications to ${receiver_id}`);
    return new Response(JSON.stringify({ sent }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error("notify-incoming-call error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
