/**
 * FCM v1 API helper using Service Account JWT auth
 * This is the modern way — no legacy server key needed
 * 
 * Store your service account JSON as FIREBASE_SERVICE_ACCOUNT secret in Supabase
 * (the entire JSON content as a single string)
 */

// Build a signed JWT for Google OAuth2 using the service account private key
async function buildGoogleJwt(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const enc = new TextEncoder();
  const b64 = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const sigInput = `${b64(header)}.${b64(payload)}`;

  // Import the RSA private key from PEM
  const pemBody = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    enc.encode(sigInput)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return `${sigInput}.${sig}`;
}

// Exchange JWT for an OAuth2 access token
async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await buildGoogleJwt(serviceAccount);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get access token: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

// Send FCM notification using v1 API
export async function sendFCMNotification(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
  channelId: "messages" | "calls" | "general" = "messages"
): Promise<{ success: boolean; error?: string }> {
  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!serviceAccountJson) {
    return { success: false, error: "FIREBASE_SERVICE_ACCOUNT not set" };
  }

  let serviceAccount: any;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    return { success: false, error: "Invalid FIREBASE_SERVICE_ACCOUNT JSON" };
  }

  try {
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const isCall = channelId === "calls";

    const message = {
      message: {
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data,
        android: {
          priority: "high",
          notification: {
            channel_id: channelId,
            sound: isCall ? "default" : "default",
            priority: isCall ? "max" : "high",
            visibility: "public",
            default_vibrate_timings: false,
            vibrate_timings: isCall
              ? ["0s", "1s", "0.5s", "1s", "0.5s", "1s"]
              : ["0s", "0.3s", "0.1s", "0.3s"],
          },
        },
      },
    };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[FCM] Send failed:", res.status, err);
      return { success: false, error: err };
    }

    console.log("[FCM] Notification sent successfully to token:", fcmToken.slice(0, 20) + "...");
    return { success: true };
  } catch (err: any) {
    console.error("[FCM] Error:", err);
    return { success: false, error: err.message };
  }
}
