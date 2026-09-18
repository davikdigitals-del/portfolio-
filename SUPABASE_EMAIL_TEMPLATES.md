# Customize Supabase Email Templates for Pulse

## Overview
This guide shows how to customize Supabase auth email templates (password reset, email confirmation, magic link) to match the Pulse app branding.

## How to Update Templates

### Step 1: Go to Supabase Dashboard
1. Open https://app.supabase.com
2. Select your project `gcckwqkzjoxraikosash`
3. Click **Authentication** in the left sidebar
4. Click **Email Templates**

---

## Template 1: Password Reset Email

**Template Name:** Reset Password  
**Subject:** Reset your Pulse password

**HTML Content:**
```html

```

---

## Template 2: Email Confirmation

**Template Name:** Confirm Sign Up  
**Subject:** Confirm your Pulse email

**HTML Content:**
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
    <!-- Logo / Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background-color: #00a884; color: white; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-bottom: 12px;">
        P
      </div>
      <h1 style="color: #0b141a; font-size: 28px; margin: 0; font-weight: 700;">Pulse</h1>
    </div>

    <!-- Content -->
    <h2 style="color: #0b141a; font-size: 22px; margin: 0 0 16px 0; font-weight: 600;">Welcome to Pulse!</h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      Confirm your email address to complete your account setup and start messaging with Pulse.
    </p>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #00a884; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
        Confirm Email
      </a>
    </div>

    <!-- Info -->
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 24px 0 0 0;">
      <strong>What's next?</strong><br />
      After confirming your email, you'll be able to sign in and start connecting with friends instantly.
    </p>

    <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 12px 0 0 0;">
      This link expires in 24 hours.
    </p>

    <!-- Divider -->
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

    <!-- Footer -->
    <div style="text-align: center; padding-top: 16px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Pulse Messaging App<br />
        <a href="https://ajibolagbengajoseph.site" style="color: #00a884; text-decoration: none;">ajibolagbengajoseph.site</a>
      </p>
    </div>
  </div>
</div>
```

---

## Template 3: Magic Link (if using passwordless sign-in)

**Template Name:** Magic Link  
**Subject:** Your Pulse sign-in link

**HTML Content:**
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
    <!-- Logo / Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background-color: #00a884; color: white; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-bottom: 12px;">
        P
      </div>
      <h1 style="color: #0b141a; font-size: 28px; margin: 0; font-weight: 700;">Pulse</h1>
    </div>

    <!-- Content -->
    <h2 style="color: #0b141a; font-size: 22px; margin: 0 0 16px 0; font-weight: 600;">Your Sign-In Link</h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      Click the link below to sign in to your Pulse account:
    </p>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #00a884; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
        Sign In to Pulse
      </a>
    </div>

    <!-- Security -->
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 24px 0 0 0;">
      <strong>Didn't request this?</strong><br />
      If you didn't request a sign-in link, you can safely ignore this email.
    </p>

    <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 12px 0 0 0;">
      This link expires in 1 hour.
    </p>

    <!-- Divider -->
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

    <!-- Footer -->
    <div style="text-align: center; padding-top: 16px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Pulse Messaging App<br />
        <a href="https://ajibolagbengajoseph.site" style="color: #00a884; text-decoration: none;">ajibolagbengajoseph.site</a>
      </p>
    </div>
  </div>
</div>
```

---

## Step-by-Step: Update Each Template

### For Password Reset:
1. In **Email Templates**, click **Reset Password**
2. Replace the entire HTML with the **Password Reset Email** template above
3. Click **Save**

### For Email Confirmation:
1. Click **Confirm Sign Up**
2. Replace the entire HTML with the **Email Confirmation** template above
3. Click **Save**

### For Magic Link (optional):
1. Click **Magic Link**
2. Replace the entire HTML with the **Magic Link** template above
3. Click **Save**

---

## Color Reference for Pulse

- **Primary Green:** `#00a884`
- **Dark Text:** `#0b141a`
- **Secondary Text:** `#374151`
- **Light Gray:** `#f3f4f6`
- **Border Gray:** `#e5e7eb`

---

## Template Variables

All templates use these variables (Supabase automatically fills them):
- `{{ .ConfirmationURL }}` - The action link (reset password, confirm email, magic link)
- `{{ .Token }}` - The token (if you need it separately)
- `{{ .Email }}` - The user's email address

---

## Testing

After updating templates:
1. Create a test account
2. Check your email inbox for confirmation email
3. Try "Forgot password?" to test reset email
4. Verify styling, links, and branding look correct

---

## Notes

- All templates use `font-family: system fonts` for maximum email client compatibility
- Colors match the Pulse WhatsApp-style dark theme
- Responsive design works on mobile and desktop
- Links use `{{ .ConfirmationURL }}` which Supabase auto-fills
- Background is light gray `#f3f4f6` with white card for contrast
