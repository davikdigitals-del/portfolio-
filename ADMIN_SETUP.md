# Admin Authentication Setup Guide

## Issues Fixed

1. ✅ Better error messages for login failures
2. ✅ Email confirmation handling
3. ✅ Admin role assignment on signup
4. ✅ Validation that only admins can access dashboard
5. ✅ Troubleshooting guide in UI

## How to Create Admin Account

### Option 1: Via Admin Page (Recommended)

1. Go to `/admin` on your site
2. Click "Create admin account"
3. Fill in:
   - Your name
   - Email address
   - Password (min 6 characters)
4. Click "Create Admin Account"

**If email confirmation is enabled in Supabase:**
- You'll see: "Account created! Please check your email to confirm"
- Check your email inbox (and spam folder)
- Click the confirmation link
- Return to `/admin` and sign in

**If email confirmation is disabled:**
- You'll be automatically signed in
- Redirected to dashboard

### Option 2: Manual Promotion (If you already have an account)

If you already created a regular user account and want to promote it to admin:

1. Go to your Supabase dashboard
2. Open SQL Editor
3. Run this command (replace with your email):

```sql
SELECT promote_user_to_admin('your@email.com');
```

4. You should see: "Success: User your@email.com promoted to admin"
5. Sign out and sign back in at `/admin`

## Common Issues & Solutions

### Issue: "Invalid email or password"
**Solution:** 
- Double-check your email and password
- Make sure Caps Lock is off
- Try resetting your password

### Issue: "Please confirm your email before signing in"
**Solution:**
- Check your email inbox (and spam folder)
- Look for email from Supabase
- Click the confirmation link
- Then try signing in again

### Issue: "This account does not have admin privileges"
**Solution:**
- Your account exists but isn't an admin
- Use Option 2 above to promote your account
- Or create a new account via `/admin` page

### Issue: "Account created but admin role assignment failed"
**Solution:**
- Your account was created but role wasn't assigned
- Use the SQL command in Option 2 to manually promote
- Or contact support

## Supabase Settings to Check

If you're having persistent issues, check these settings in your Supabase dashboard:

### 1. Email Confirmation Settings
- Go to: Authentication → Settings → Email Auth
- Check if "Confirm email" is enabled
- If enabled, users MUST click email link before signing in

### 2. Site URL Configuration
- Go to: Authentication → URL Configuration
- Add your site URL: `https://ajibola-gbenga-joseph.onrender.com`
- Add to Redirect URLs as well

### 3. Email Templates
- Go to: Authentication → Email Templates
- Make sure "Confirm signup" template is configured
- Test by sending yourself a test email

## Testing Your Setup

1. **Create Test Account:**
   - Go to `/admin`
   - Create account with test email
   - Follow confirmation process if required

2. **Verify Admin Access:**
   - Sign in at `/admin`
   - Should redirect to `/dashboard`
   - Should see admin features (Inbox, Users, Tasks, etc.)

3. **Test Regular User:**
   - Sign out
   - Go to `/auth` (regular user signup)
   - Create regular account
   - Should NOT have access to admin features

## Environment Variables

Make sure these are set in your `.env` file:

```env
VITE_SUPABASE_URL=https://gcckwqkzjoxraikosash.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
ADMIN_EMAIL=ajibolagbengajoseph@gmail.com
```

## Need Help?

If you're still having issues:

1. Check browser console for errors (F12 → Console tab)
2. Check Supabase logs (Dashboard → Logs)
3. Verify database has `user_roles` table
4. Make sure migration ran successfully
5. Try the manual promotion SQL command

## Security Notes

- Only share `/admin` URL with trusted administrators
- Use strong passwords (12+ characters recommended)
- Enable 2FA in Supabase if available
- Regularly review admin accounts in database
