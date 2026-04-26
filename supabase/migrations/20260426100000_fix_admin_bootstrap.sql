-- =========================================
-- FIX: Allow admin bootstrap when no admin exists yet
-- Also allows a user to claim admin if they know the admin secret
-- =========================================

-- Function: claim_admin_role
-- Any authenticated user can call this to become admin IF:
--   1. No admin exists yet (bootstrap), OR
--   2. They provide the correct admin secret from env
CREATE OR REPLACE FUNCTION public.claim_admin_role(admin_secret TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id UUID;
  admin_count INT;
  env_secret TEXT;
BEGIN
  -- Get the calling user's ID
  calling_user_id := auth.uid();
  
  IF calling_user_id IS NULL THEN
    RETURN 'error:not_authenticated';
  END IF;
  
  -- Check if already admin
  IF public.has_role(calling_user_id, 'admin') THEN
    RETURN 'ok:already_admin';
  END IF;
  
  -- Count existing admins
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  
  -- Allow if no admins exist yet (bootstrap mode)
  IF admin_count = 0 THEN
    -- Remove default user role
    DELETE FROM public.user_roles WHERE user_id = calling_user_id AND role = 'user';
    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (calling_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN 'ok:bootstrapped';
  END IF;
  
  -- If admins exist, require the secret
  -- Get secret from app settings (set via: INSERT INTO app_settings...)
  SELECT value INTO env_secret FROM public.app_settings WHERE key = 'admin_secret' LIMIT 1;
  
  IF env_secret IS NOT NULL AND admin_secret = env_secret THEN
    DELETE FROM public.user_roles WHERE user_id = calling_user_id AND role = 'user';
    INSERT INTO public.user_roles (user_id, role)
    VALUES (calling_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN 'ok:promoted';
  END IF;
  
  RETURN 'error:not_authorized';
END;
$$;

-- App settings table for storing the admin secret
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only admins can read/write settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_admin_all" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_admin_role TO authenticated;
