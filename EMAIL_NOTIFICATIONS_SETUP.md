# Email Notifications Setup

## Overview
Your app has a complete email notification system already implemented. When messages are sent:

- **Admin receives**: Email when a client sends a message
- **Client receives**: Email when the admin replies
- **Both receive**: Web push notifications and in-app notifications

## Current Implementation

### Edge Function
The email logic is in: `supabase/functions/notify-new-message/index.ts`

**Features:**
- Sends HTML emails via Resend API
- Includes web push notifications (with VAPID keys)
- Creates in-app notifications in the database
- Handles both admin→client and client→admin messages
- Includes rich HTML email templates with brand colors

### How to Enable Email Notifications

Email notifications are sent via an edge function that needs to be triggered by database webhooks.

#### Step 1: Ensure Environment Variables are Set

On Render, verify these are configured in `render.yaml`:

```yaml
envVars:
  - key: RESEND_API_KEY
    value: re_xxxx...  # Your Resend API key
  - key: ADMIN_EMAIL
    value: your-email@gmail.com
  - key: ADMIN_NAME
    value: Your Name
  - key: SITE_URL
    value: https://your-site.com
  - key: VITE_VAPID_PUBLIC_KEY
    value: xxx...
```

#### Step 2: Deploy the Edge Function

From your project directory:

```bash
supabase functions deploy notify-new-message
```

#### Step 3: Create Database Webhook (Supabase Dashboard)

1. Go to Supabase Dashboard → Your Project
2. Navigate to **Database** → **Webhooks**
3. Click **Create webhook**
4. Configure:
   - **Name**: `notify-new-message`
   - **Table**: `messages`
   - **Events**: `INSERT`
   - **URL**: `https://[your-project-id].supabase.co/functions/v1/notify-new-message`
   - **HTTP Method**: `POST`
   - **Headers**: 
     - Key: `Authorization`
     - Value: `Bearer [your-anon-key]` (or service role key)

5. Click **Create webhook**

#### Step 4: Test

Send a message in the chat interface. Both admin and client should receive:
- Email notification
- Web push notification (if browser notifications are enabled)
- In-app notification

## Email Template Customization

Edit the HTML templates in `supabase/functions/notify-new-message/index.ts`:

- `adminEmailHtml()` - Email template for admin
- `clientEmailHtml()` - Email template for client

## Troubleshooting

### Emails not being sent?

1. **Check Resend API Key**: Verify `RESEND_API_KEY` is correct in Render
2. **Check Webhook Status**: Go to Supabase → Webhooks → View logs for errors
3. **Check Logs**: View Render deployment logs for any errors
4. **Test Manually**: 
   ```bash
   curl -X POST https://[your-project].supabase.co/functions/v1/notify-new-message \
     -H "Authorization: Bearer [your-anon-key]" \
     -H "Content-Type: application/json" \
     -d '{
       "record": {
         "id": "test",
         "conversation_id": "test",
         "sender_id": "test",
         "content": "Test message",
         "type": "text"
       }
     }'
   ```

### Webhook not firing?

1. Verify the webhook is enabled in Supabase Dashboard
2. Check the webhook URL is correct
3. Check the Authorization header is set
4. Review webhook execution logs in Supabase

## How It Works

1. User sends a message → `messages` table INSERT
2. Supabase webhook triggers → Calls `notify-new-message` edge function
3. Edge function:
   - Determines if sender is admin or client
   - Fetches sender and recipient profiles
   - Sends email via Resend API
   - Sends web push notification
   - Creates in-app notification
4. Recipient gets notified via all channels

## Key Files

- `supabase/functions/notify-new-message/index.ts` - Main logic
- `render.yaml` - Environment variables configuration
- Supabase Dashboard → Webhooks - Trigger configuration
