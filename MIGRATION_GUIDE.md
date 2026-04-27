# Migration Guide - Fix Voice Notes and Push Notifications

## Overview
This migration fixes:
1. ✅ Deletes broken voice note messages (.webm files)
2. ✅ Adds proper RLS policies for push_subscriptions table
3. ✅ Creates helper function to list orphaned files
4. ✅ Adds performance indexes

## Prerequisites
- Supabase CLI installed
- Database access
- Backup of your database (recommended)

## Step 1: Backup Your Database (Recommended)

```bash
# Using Supabase CLI
supabase db dump -f backup_before_voice_fix.sql

# Or from Supabase Dashboard:
# Settings → Database → Backups → Create backup
```

## Step 2: Run the Migration

### Option A: Using Supabase CLI (Recommended)

```bash
# Navigate to your project directory
cd /path/to/your/project

# Run the migration
supabase db push

# Or apply specific migration
supabase migration up
```

### Option B: Using Supabase Dashboard

1. Go to Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the file: `supabase/migrations/20260427300000_fix_voice_notes_and_push.sql`
4. Copy and paste the entire content
5. Click **Run**

### Option C: Using psql

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260427300000_fix_voice_notes_and_push.sql
```

## Step 3: Verify the Migration

Run these queries in the SQL Editor:

```sql
-- 1. Check if broken voice messages were deleted
SELECT COUNT(*) as remaining_voice_messages 
FROM public.messages 
WHERE type = 'voice';

-- 2. Check push_subscriptions policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'push_subscriptions';

-- 3. Check if indexes were created
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE tablename IN ('messages', 'push_subscriptions')
  AND schemaname = 'public';
```

## Step 4: Clean Up Storage Files (Optional)

The migration deletes the **message records** but not the actual **storage files**. To clean up storage:

### Option A: List orphaned files first

```sql
-- See what will be deleted
SELECT * FROM public.list_orphaned_voice_files();
```

### Option B: Delete all .webm files

```sql
-- WARNING: This permanently deletes all .webm files
DELETE FROM storage.objects 
WHERE bucket_id = 'chat-files' 
  AND name LIKE '%.webm';
```

### Option C: Use the cleanup script

1. Open `CLEANUP_STORAGE.sql`
2. Review the queries
3. Uncomment the DELETE statement you want to use
4. Run in SQL Editor

## Step 5: Test the Application

1. **Test new voice notes:**
   - Open the chat on mobile
   - Record a new voice note
   - Verify it plays correctly
   - Check console for: `[VoiceNote] Selected MIME type: audio/mp4`

2. **Test push notifications:**
   - Send a message
   - Verify push notification is received
   - Check console for no 403 errors

3. **Verify storage:**
   - New voice notes should use `.m4a` extension
   - Old `.webm` files should be gone

## What This Migration Does

### 1. Deletes Broken Voice Messages
```sql
DELETE FROM public.messages 
WHERE type = 'voice' 
  AND (file_name LIKE '%.webm' OR file_url LIKE '%.webm');
```
- Removes all voice messages with .webm files
- These files were causing 400 errors on mobile
- Users will need to re-record these messages

### 2. Fixes Push Subscriptions RLS
```sql
-- Allows users to manage their own subscriptions
CREATE POLICY "Users can insert own subscriptions" ...
CREATE POLICY "Users can read own subscriptions" ...
CREATE POLICY "Users can update own subscriptions" ...
CREATE POLICY "Users can delete own subscriptions" ...

-- Allows admins to manage all subscriptions
CREATE POLICY "Admins can manage all subscriptions" ...
```
- Fixes 403 errors when subscribing to push notifications
- Users can now manage their own subscriptions
- Admins can manage all subscriptions

### 3. Creates Helper Function
```sql
CREATE FUNCTION public.list_orphaned_voice_files() ...
```
- Lists storage files that don't have message records
- Helps identify files that can be safely deleted
- Useful for storage cleanup

### 4. Adds Performance Indexes
```sql
CREATE INDEX idx_messages_type ON public.messages(type);
CREATE INDEX idx_messages_file_name ON public.messages(file_name);
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
```
- Speeds up voice note queries
- Improves push notification lookups
- Better overall performance

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Restore from backup
psql "postgresql://..." -f backup_before_voice_fix.sql

-- Or manually undo changes:

-- 1. Drop the policies
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.push_subscriptions;

-- 2. Drop the helper function
DROP FUNCTION IF EXISTS public.list_orphaned_voice_files();

-- 3. Drop the indexes
DROP INDEX IF EXISTS idx_messages_type;
DROP INDEX IF EXISTS idx_messages_file_name;
DROP INDEX IF EXISTS idx_push_subscriptions_user_id;
```

**Note:** You cannot restore deleted voice messages without a backup.

## Expected Results

### Before Migration:
- ❌ Voice notes show 400 errors
- ❌ Push subscriptions return 403 errors
- ❌ Old .webm files taking up storage space
- ❌ Slow queries on messages table

### After Migration:
- ✅ Old broken voice messages deleted
- ✅ Push notifications work correctly
- ✅ Storage can be cleaned up
- ✅ Faster database queries
- ✅ New voice notes use MP4 format

## Troubleshooting

### Issue: Migration fails with "permission denied"
**Solution:** Make sure you're running as a superuser or have sufficient privileges.

### Issue: "function list_orphaned_voice_files already exists"
**Solution:** The function already exists. You can drop it first:
```sql
DROP FUNCTION IF EXISTS public.list_orphaned_voice_files();
```

### Issue: "policy already exists"
**Solution:** The migration includes `DROP POLICY IF EXISTS` statements, but if it still fails:
```sql
-- Drop all policies manually first
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.push_subscriptions;
-- ... repeat for all policies
```

### Issue: No voice messages were deleted
**Solution:** Check if there are any .webm voice messages:
```sql
SELECT COUNT(*) FROM public.messages 
WHERE type = 'voice' 
  AND (file_name LIKE '%.webm' OR file_url LIKE '%.webm');
```

## Post-Migration Checklist

- [ ] Migration ran successfully
- [ ] Verification queries show expected results
- [ ] Push notifications work (no 403 errors)
- [ ] New voice notes use MP4 format
- [ ] Old .webm files deleted (optional)
- [ ] Application tested on mobile
- [ ] No console errors

## Support

If you encounter issues:
1. Check the Supabase logs
2. Review the console errors
3. Verify RLS policies are correct
4. Test with a fresh browser session
5. Check the migration guide again

## Summary

This migration:
- ✅ Fixes broken voice notes by deleting old .webm messages
- ✅ Fixes push notification 403 errors with proper RLS policies
- ✅ Provides tools to clean up orphaned storage files
- ✅ Improves database performance with indexes

Users will need to re-record any deleted voice notes, but all new recordings will work perfectly on all devices!
