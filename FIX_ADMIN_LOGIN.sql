-- Fix Admin Login Issue
-- Run this in Supabase SQL Editor

-- 1. Check if admin role exists for your email
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'ajibolagbengajoseph@gmail.com';

-- If the above shows NULL for role, run this:

-- 2. Add admin role to your account
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'ajibolagbengajoseph@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Verify it worked
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'ajibolagbengajoseph@gmail.com';

-- Should now show: email | role
--                  your@email.com | admin

-- 4. Clear any duplicate 'user' role (optional cleanup)
DELETE FROM public.user_roles
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'ajibolagbengajoseph@gmail.com')
AND role = 'user';
