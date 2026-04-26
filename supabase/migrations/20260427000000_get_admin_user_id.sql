-- Allow any authenticated user to look up the admin's user_id
-- This is needed so clients can initiate calls to the admin
-- The function is SECURITY DEFINER so it bypasses RLS on user_roles

CREATE OR REPLACE FUNCTION public.get_admin_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_id() TO authenticated;
