import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "ajibolagbengajoseph@gmail.com";
const ADMIN_NAME = Deno.env.get("ADMIN_NAME") ?? "Ajibola Gbenga Joseph";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://gbenga-joseph.onrender.com";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── Web Push helpers ──────────────────────────────────────────────────────────
function base64urlToUint8(b64: string): Uint8Array {
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}
function uint8ToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function buildVapidJwt(audience: string): Promise<string> {
  const enc = new TextEncoder();
  const header = uint8ToBase64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = uint8ToBase64url(enc.encode(JSON.stringify({
    aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: "mailto:admin@ajibola.dev",
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
  const privKey = await crypto.subtle.importKey("pkcs8", pkcs8.buffer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, enc.encode(sigInput));
  return `${sigInput}.${uint8ToBase64url(new Uint8Array(sig))}`;
}

async function encryptPayload(sub: { p256dh: string; auth: string }, payload: string) {
  const enc = new TextEncoder();
  const plaintext = enc.encode(payload);
  const serverKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKP.publicKey));
  const clientPub = await crypto.subtle.importKey("raw", base64urlToUint8(sub.p256dh), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientPub }, serverKP.privateKey, 256));
  const authSecret = base64urlToUint8(sub.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
  const authPrk = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: authSecret, info: enc.encode("Content-Encoding: auth\0") }, prk, 256));
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

async function sendWebPushToUser(userId: string, title: string, body: string, url: string, tag: string) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
  if (!subs?.length) return;
  const pushPayload = JSON.stringify({ title, body, url, tag });
  for (const sub of subs) {
    try {
      const origin = new URL(sub.endpoint).origin;
      const jwt = await buildVapidJwt(origin);
      const { ciphertext, salt, serverPublicKey } = await encryptPayload(sub, pushPayload);
      const res = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC}`,
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "aesgcm",
          "Encryption": `salt=${uint8ToBase64url(salt)}`,
          "Crypto-Key": `dh=${uint8ToBase64url(serverPublicKey)};p256ecdsa=${VAPID_PUBLIC}`,
          "TTL": "86400",
          "Urgency": "high",
        },
        body: ciphertext,
      });
      if (res.status === 410 || res.status === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    } catch (e) {
      console.error("Push error:", e);
    }
  }
}

// ── Email helpers ─────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${ADMIN_NAME} <onboarding@resend.dev>`, to: [to], subject, html }),
  });
  if (!res.ok) console.error("Resend error:", await res.text());
}

function adminEmailHtml(senderName: string, preview: string, chatUrl: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Inter,sans-serif;color:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1f2e;border-radius:16px;overflow:hidden;border:1px solid #2d3748;">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">📩 New Message</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Someone messaged you on your portfolio</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">FROM</p>
          <p style="margin:0 0 24px;font-size:18px;font-weight:600;color:#f1f5f9;">${senderName}</p>
          <div style="background:#0f1117;border-radius:12px;padding:16px 20px;border-left:3px solid #6366f1;margin-bottom:28px;">
            <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.6;">${preview}</p>
          </div>
          <a href="${chatUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;">Reply Now →</a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #2d3748;">
          <p style="margin:0;font-size:12px;color:#64748b;">Email alert from your portfolio chat.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function clientEmailHtml(adminName: string, preview: string, chatUrl: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Inter,sans-serif;color:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1f2e;border-radius:16px;overflow:hidden;border:1px solid #2d3748;">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">💬 ${adminName} replied</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">You have a new reply</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="background:#0f1117;border-radius:12px;padding:16px 20px;border-left:3px solid #6366f1;margin-bottom:28px;">
            <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.6;">${preview}</p>
          </div>
          <a href="${chatUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;">View Reply →</a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #2d3748;">
          <p style="margin:0;font-size:12px;color:#64748b;">You're receiving this because you have an account on ${SITE_URL}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const payload = await req.json();
    const record = payload.record ?? payload;

    if (!record) return new Response("ok", { status: 200 });

    const { conversation_id, sender_id, content, type } = record;

    // Skip voice notes for preview
    if (type === "voice") return new Response("ok", { status: 200 });

    const preview = content
      ? content.slice(0, 200)
      : type === "image" ? "📷 Sent an image"
      : type === "file" ? "📎 Sent a file"
      : "New message";

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from("profiles").select("display_name, email").eq("user_id", sender_id).maybeSingle();
    const senderName = senderProfile?.display_name ?? senderProfile?.email ?? "Someone";

    // Get sender role (service role bypasses RLS)
    const { data: senderRole } = await supabase
      .from("user_roles").select("role").eq("user_id", sender_id).maybeSingle();
    const isAdminSender = senderRole?.role === "admin";

    // Get conversation
    const { data: conversation } = await supabase
      .from("conversations").select("user_id").eq("id", conversation_id).maybeSingle();
    if (!conversation) return new Response("conversation not found", { status: 200 });

    const chatUrl = `${SITE_URL}/dashboard/chat`;

    if (isAdminSender) {
      // Admin → client: Web Push + email
      const clientUserId = conversation.user_id;

      // Web Push (wakes phone)
      await sendWebPushToUser(
        clientUserId,
        `💬 ${ADMIN_NAME}`,
        preview,
        chatUrl,
        `msg-${conversation_id}`
      );

      // Email
      const { data: clientProfile } = await supabase
        .from("profiles").select("email, display_name").eq("user_id", clientUserId).maybeSingle();
      if (clientProfile?.email) {
        await sendEmail(
          clientProfile.email,
          `💬 ${ADMIN_NAME} replied to your message`,
          clientEmailHtml(ADMIN_NAME, preview, chatUrl)
        );
      }
    } else {
      // Client → admin: Web Push + email

      // Get admin user_id
      const { data: adminRole } = await supabase
        .from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();

      if (adminRole?.user_id) {
        // Web Push (wakes phone)
        await sendWebPushToUser(
          adminRole.user_id,
          `📩 ${senderName}`,
          preview,
          chatUrl,
          `msg-${conversation_id}`
        );
      }

      // Email admin
      await sendEmail(
        ADMIN_EMAIL,
        `📩 New message from ${senderName}`,
        adminEmailHtml(senderName, preview, chatUrl)
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("notify-new-message error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
