import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "ajibolagbengajoseph@gmail.com";
const ADMIN_NAME = Deno.env.get("ADMIN_NAME") ?? "Ajibola Gbenga Joseph";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://ajibola-gbenga-joseph.onrender.com";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log("No RESEND_API_KEY set, skipping email");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${ADMIN_NAME} <onboarding@resend.dev>`,
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
  }
}

function adminEmailHtml(senderName: string, preview: string, chatUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Inter,sans-serif;color:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1f2e;border-radius:16px;overflow:hidden;border:1px solid #2d3748;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">📩 New Message</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Someone messaged you on your portfolio</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">FROM</p>
          <p style="margin:0 0 24px;font-size:18px;font-weight:600;color:#f1f5f9;">${senderName}</p>
          <div style="background:#0f1117;border-radius:12px;padding:16px 20px;border-left:3px solid #6366f1;margin-bottom:28px;">
            <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.6;">${preview}</p>
          </div>
          <a href="${chatUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;">
            Reply Now →
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #2d3748;">
          <p style="margin:0;font-size:12px;color:#64748b;">This notification was sent because you have email alerts enabled on your portfolio.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function clientEmailHtml(adminName: string, preview: string, chatUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Inter,sans-serif;color:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1f2e;border-radius:16px;overflow:hidden;border:1px solid #2d3748;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">💬 ${adminName} replied</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">You have a new reply on your conversation</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <div style="background:#0f1117;border-radius:12px;padding:16px 20px;border-left:3px solid #6366f1;margin-bottom:28px;">
            <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.6;">${preview}</p>
          </div>
          <a href="${chatUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;">
            View Reply →
          </a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #2d3748;">
          <p style="margin:0;font-size:12px;color:#64748b;">You're receiving this because you have an account on ${SITE_URL}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  // Only accept POST from Supabase webhook
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record || record.type === "voice") {
      // Skip voice notes for email preview
      return new Response("ok", { status: 200 });
    }

    const { conversation_id, sender_id, content, type } = record;
    const preview = content
      ? content.slice(0, 200)
      : type === "image" ? "📷 Sent an image" : type === "file" ? "📎 Sent a file" : "New message";

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("user_id", sender_id)
      .maybeSingle();

    const senderName = senderProfile?.display_name ?? senderProfile?.email ?? "Someone";

    // Get sender role
    const { data: senderRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sender_id)
      .maybeSingle();

    const isAdminSender = senderRole?.role === "admin";

    // Get conversation owner
    const { data: conversation } = await supabase
      .from("conversations")
      .select("user_id")
      .eq("id", conversation_id)
      .maybeSingle();

    if (!conversation) {
      return new Response("conversation not found", { status: 200 });
    }

    const chatUrl = `${SITE_URL}/dashboard/chat`;

    if (isAdminSender) {
      // Admin sent a message → email the client
      const { data: clientProfile } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("user_id", conversation.user_id)
        .maybeSingle();

      if (clientProfile?.email) {
        await sendEmail(
          clientProfile.email,
          `💬 ${ADMIN_NAME} replied to your message`,
          clientEmailHtml(ADMIN_NAME, preview, chatUrl)
        );
        console.log("Emailed client:", clientProfile.email);
      }
    } else {
      // Client sent a message → email the admin
      await sendEmail(
        ADMIN_EMAIL,
        `📩 New message from ${senderName}`,
        adminEmailHtml(senderName, preview, chatUrl)
      );
      console.log("Emailed admin:", ADMIN_EMAIL);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-new-message error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
