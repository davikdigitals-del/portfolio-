-- Helper function to promote a user to admin by email
-- Usage: SELECT promote_user_to_admin('your@email.com');

CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;
  
  IF target_user_id IS NULL THEN
    RETURN 'Error: User not found with email ' || user_email;
  END IF;
  
  -- Delete existing user role if any
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = 'user';
  
  -- Insert admin role (or update if exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN 'Success: User ' || user_email || ' promoted to admin';
END;
$$;

-- Example usage (commented out):
-- SELECT promote_user_to_admin('ajibolagbengajoseph@gmail.com');
