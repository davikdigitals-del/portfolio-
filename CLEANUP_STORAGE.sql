-- Manual Storage Cleanup Script
-- Run this AFTER the migration to clean up orphaned .webm files from storage

-- =========================================
-- OPTION 1: List all .webm files to delete
-- =========================================
-- First, see what will be deleted
SELECT 
  o.id,
  o.name as file_path,
  o.bucket_id,
  o.created_at,
  pg_size_pretty((o.metadata->>'size')::bigint) as file_size
FROM storage.objects o
WHERE o.bucket_id = 'chat-files'
  AND o.name LIKE '%.webm'
ORDER BY o.created_at DESC;

-- =========================================
-- OPTION 2: Delete all .webm files from storage
-- =========================================
-- WARNING: This will permanently delete all .webm files
-- Make sure you've backed up any important data first

-- Uncomment to execute:
-- DELETE FROM storage.objects 
-- WHERE bucket_id = 'chat-files' 
--   AND name LIKE '%.webm';

-- =========================================
-- OPTION 3: Delete only orphaned .webm files
-- =========================================
-- This deletes .webm files that don't have a corresponding message

-- First, see what will be deleted:
SELECT 
  o.id,
  o.name as file_path,
  o.created_at
FROM storage.objects o
WHERE o.bucket_id = 'chat-files'
  AND o.name LIKE '%.webm'
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.file_url LIKE '%' || o.name
  );

-- Uncomment to execute:
-- DELETE FROM storage.objects o
-- WHERE o.bucket_id = 'chat-files'
--   AND o.name LIKE '%.webm'
--   AND NOT EXISTS (
--     SELECT 1 FROM public.messages m
--     WHERE m.file_url LIKE '%' || o.name
--   );

-- =========================================
-- VERIFICATION
-- =========================================
-- Check how many .webm files remain
SELECT 
  COUNT(*) as webm_file_count,
  pg_size_pretty(SUM((metadata->>'size')::bigint)) as total_size
FROM storage.objects
WHERE bucket_id = 'chat-files'
  AND name LIKE '%.webm';

-- Check total storage usage
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM((metadata->>'size')::bigint)) as total_size
FROM storage.objects
WHERE bucket_id = 'chat-files'
GROUP BY bucket_id;
