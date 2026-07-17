-- Allow admin to delete conversations and messages
-- (previously only SELECT/INSERT/UPDATE were allowed for admin)

CREATE POLICY "conv_delete_admin"
  ON public.conversations
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "msg_delete_admin"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Also allow users to delete their own messages (hard delete)
CREATE POLICY "msg_delete_self"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());
