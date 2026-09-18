-- Make chat-files bucket public so images/videos/files load without signed URLs
-- This is safe because file paths include conversation UUIDs (not guessable)
UPDATE storage.buckets SET public = true WHERE id = 'chat-files';

-- Drop the old restrictive read policy and replace with public read
DROP POLICY IF EXISTS "chat_files_read" ON storage.objects;

-- Public read for chat-files (anyone with the URL can view)
CREATE POLICY "chat_files_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-files');
