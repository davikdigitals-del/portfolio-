-- Fix conflicting message UPDATE policies
-- Drop the overly permissive msg_update_participant policy
DROP POLICY IF EXISTS "msg_update_participant" ON public.messages;

-- Drop the restrictive msg_delete_own policy
DROP POLICY IF EXISTS "msg_delete_own" ON public.messages;

-- Create a single, clear UPDATE policy:
-- Users can update their own messages (edit/delete)
-- Admins can update any message
CREATE POLICY "msg_update_own_or_admin" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
