-- Add reactions column to messages table
-- reactions is a JSONB object: { "👍": ["user_id_1", "user_id_2"], "❤️": ["user_id_3"] }
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- Allow users to update reactions on any message in their conversation
CREATE POLICY "Users can update message reactions" ON messages
  FOR UPDATE USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (true);
