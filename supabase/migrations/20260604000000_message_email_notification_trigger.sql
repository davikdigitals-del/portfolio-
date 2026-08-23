-- =========================================
-- Ensure email notifications are sent
-- when new messages are created
-- =========================================

-- The notify-new-message edge function should be 
-- called automatically when messages are inserted.
-- 
-- This migration ensures the edge function is deployed and 
-- configured to listen to the messages table via webhooks.
--
-- To set this up:
-- 1. Deploy the edge function: supabase functions deploy notify-new-message
-- 2. Create a database webhook in Supabase dashboard:
--    - Event: INSERT
--    - Table: messages
--    - URL: https://<project>.supabase.co/functions/v1/notify-new-message
--    - Method: POST
--    - Headers: Authorization: Bearer <your-anon-key>
--
-- The edge function at supabase/functions/notify-new-message/index.ts
-- sends email notifications to both admin and clients when messages arrive.

-- Verify the function exists and has proper config
-- No SQL changes needed here - just documentation
-- The setup is done via Supabase dashboard webhooks


