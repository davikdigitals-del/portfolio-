-- =========================================
-- TRIGGER: Call notify-new-message edge function
-- when a new message is inserted
-- =========================================

-- Enable pgsql_http extension
CREATE EXTENSION IF NOT EXISTS http;

-- Create a function that calls the edge function
CREATE OR REPLACE FUNCTION public.call_notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  -- Skip if deleting or if it's a call message
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.type = 'call' THEN RETURN NEW; END IF;

  -- Call the edge function asynchronously
  SELECT http_get(
    'https://' || (
      SELECT split_part(
        (SELECT current_database()),
        '_', 1
      )
    ) || '.supabase.co/functions/v1/notify-new-message?msg_id=' || NEW.id || '&conv_id=' || NEW.conversation_id
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail the insert
  RAISE LOG 'Error calling notify-new-message: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_message_notify_email ON public.messages;

-- Create trigger
CREATE TRIGGER trg_message_notify_email
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.call_notify_new_message();

-- =========================================
-- WEBHOOK SETUP (manual via dashboard)
-- =========================================
-- 
-- Alternatively, use Supabase webhooks via the dashboard:
-- 1. Go to Supabase Dashboard → Your Project
-- 2. Database → Webhooks
-- 3. Create webhook:
--    Name: notify-new-message
--    Table: messages
--    Event: INSERT
--    URL: https://<project-id>.supabase.co/functions/v1/notify-new-message
--    Method: POST
--    Headers: Authorization: Bearer <your-service-role-key>



