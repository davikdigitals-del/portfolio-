-- Add deleted_at column for soft-delete on messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Policy: users can soft-delete their own messages; admin can delete any
CREATE POLICY "msg_delete_own" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
