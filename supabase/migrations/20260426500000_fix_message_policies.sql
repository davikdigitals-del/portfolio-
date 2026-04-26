-- Fix conflicting message UPDATE policies
-- Drop the overly permissive msg_update_participant policy
DROP POLICY IF EXISTS "msg_update_participant" ON public.messages;

-- Drop the restrictive msg_delete_own policy
DROP POLICY IF EXISTS "msg_delete_own" ON public.messages;

-- Drop the old update policy if it exists
DROP POLICY IF EXISTS "msg_update_own_or_admin" ON public.messages;

-- Create a single, clear UPDATE policy:
-- Users can update their own messages (edit/delete) if they're conversation participants
-- Admins can update any message in conversations they're part of
-- Anyone can update message status (delivered/seen) for messages in their conversations
CREATE POLICY "msg_update_own_or_admin" ON public.messages FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))) AND
    (
      -- Can edit own messages
      sender_id = auth.uid() OR
      -- Admin can do anything
      public.has_role(auth.uid(), 'admin') OR
      -- Anyone can update status (delivered/seen) for messages in their conversation
      (sender_id != auth.uid() AND (status = 'sent' OR status = 'delivered'))
    )
  );
