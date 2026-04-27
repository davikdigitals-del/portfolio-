-- Fix voice notes and push notification issues
-- This migration:
-- 1. Deletes broken voice note messages (webm files that return 400)
-- 2. Adds RLS policies for push_subscriptions table
-- 3. Creates helper function for storage cleanup

-- =========================================
-- 1. DELETE BROKEN VOICE NOTE MESSAGES
-- =========================================
-- Delete all voice messages with .webm files (these are broken on mobile)
-- Users will need to re-record these messages
DELETE FROM public.messages 
WHERE type = 'voice' 
  AND (file_name LIKE '%.webm' OR file_url LIKE '%.webm');

-- =========================================
-- 2. FIX PUSH_SUBSCRIPTIONS RLS POLICIES
-- =========================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.push_subscriptions;

-- Enable RLS on push_subscriptions table
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to read their own subscriptions
CREATE POLICY "Users can read own subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow users to update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow users to delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admin can manage all subscriptions
CREATE POLICY "Admins can manage all subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =========================================
-- 3. CLEAN UP ORPHANED STORAGE FILES
-- =========================================
-- Create a helper function to list orphaned voice files
CREATE OR REPLACE FUNCTION public.list_orphaned_voice_files()
RETURNS TABLE (
  file_path TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.name::TEXT as file_path,
    (regexp_match(o.name, '[^/]+$'))[1]::TEXT as file_name,
    o.created_at
  FROM storage.objects o
  WHERE o.bucket_id = 'chat-files'
    AND o.name LIKE '%.webm'
    AND NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.file_url LIKE '%' || o.name
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.list_orphaned_voice_files() TO authenticated;

-- =========================================
-- 4. ADD INDEXES FOR PERFORMANCE
-- =========================================
-- Index on messages.type for faster voice note queries
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(type);

-- Index on messages.file_name for faster file lookups
CREATE INDEX IF NOT EXISTS idx_messages_file_name ON public.messages(file_name) WHERE file_name IS NOT NULL;

-- Index on push_subscriptions.user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- =========================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- =========================================
COMMENT ON POLICY "Users can insert own subscriptions" ON public.push_subscriptions IS 
  'Allows authenticated users to create push notification subscriptions for themselves';

COMMENT ON POLICY "Users can read own subscriptions" ON public.push_subscriptions IS 
  'Allows authenticated users to view their own push notification subscriptions';

COMMENT ON POLICY "Users can update own subscriptions" ON public.push_subscriptions IS 
  'Allows authenticated users to update their own push notification subscriptions';

COMMENT ON POLICY "Users can delete own subscriptions" ON public.push_subscriptions IS 
  'Allows authenticated users to delete their own push notification subscriptions';

COMMENT ON POLICY "Admins can manage all subscriptions" ON public.push_subscriptions IS 
  'Allows admin users to manage all push notification subscriptions';

COMMENT ON FUNCTION public.list_orphaned_voice_files() IS 
  'Lists voice files in storage that no longer have corresponding message records';

-- =========================================
-- VERIFICATION QUERIES
-- =========================================
-- Run these queries to verify the migration worked:

-- Check remaining voice messages
-- SELECT COUNT(*) as remaining_voice_messages FROM public.messages WHERE type = 'voice';

-- Check push_subscriptions policies
-- SELECT * FROM pg_policies WHERE tablename = 'push_subscriptions';

-- List orphaned files (if any)
-- SELECT * FROM public.list_orphaned_voice_files();
