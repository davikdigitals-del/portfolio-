# Fix: Supabase Redirect URL 500 Error

## Problem
When clicking "Forgot password?" you get:
```
POST https://gcckwqkzjoxraikosash.supabase.co/auth/v1/recover 500 (Internal Server Error)
```

## Root Cause
The redirect URL `https://ajibolagbengajoseph.site/auth` is not whitelisted in Supabase authentication settings.

## Solution

### Step 1: Go to Supabase Dashboard
1. Open https://app.supabase.com
2. Login to your account
3. Click on project `gcckwqkzjoxraikosash`

### Step 2: Configure URL Settings
1. In the left sidebar, click **Authentication**
2. Click **URL Configuration**

### Step 3: Set Site URL
- **Site URL** field: `https://ajibolagbengajoseph.site`
- This is the main URL for your application

### Step 4: Add Redirect URLs
In the **Redirect URLs** section, add these URLs (one per line):
```
https://ajibolagbengajoseph.site
https://ajibolagbengajoseph.site/auth
https://ajibolagbengajoseph.site/dashboard
http://localhost:3000
http://localhost:3000/auth
```

### Step 5: Save
Click the **Save** button

## After Configuration

Once saved, these flows will work:

### Password Reset Flow
1. User clicks "Forgot password?" on `/auth`
2. Enters their email → clicks "Send Reset Link"
3. Receives email with reset link from Supabase
4. Clicks link → redirected to `/auth`
5. Can set new password

### Email Confirmation Flow
1. New user signs up
2. Receives confirmation email
3. Clicks link → redirected to `/auth`
4. Account is confirmed

## If Still Getting 500 Error

1. **Clear browser cache** - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Verify URL is exact** - Must be `https://ajibolagbengajoseph.site` (not `http://` or trailing slash)
3. **Check email settings** - Go to Authentication → Email Templates and verify they use correct URL
4. **Wait a minute** - Sometimes Supabase takes time to apply changes

## Screenshots/Visual Guide

### URL Configuration Page Location
```
Authentication
└── URL Configuration
    ├── Site URL: https://ajibolagbengajoseph.site
    └── Redirect URLs:
        ├── https://ajibolagbengajoseph.site
        ├── https://ajibolagbengajoseph.site/auth
        ├── https://ajibolagbengajoseph.site/dashboard
        ├── http://localhost:3000
        └── http://localhost:3000/auth
```

## Technical Details

- **Supabase Project ID**: `gcckwqkzjoxraikosash`
- **Auth Endpoint**: `https://gcckwqkzjoxraikosash.supabase.co/auth/v1`
- **Reset Endpoint**: `/auth/v1/recover`
- **Required Header**: `redirect_to=https://ajibolagbengajoseph.site/auth`

Once the redirect URL is whitelisted, Supabase will accept the request and send the password reset email.
