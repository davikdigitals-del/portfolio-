-- Trigger: fire notify-incoming-call edge function on every new call INSERT
-- Uses pg_net (built into Supabase) to make an async HTTP POST to the edge function

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that fires the edge function via HTTP
CREATE OR REPLACE FUNCTION public.trigger_notify_incoming_call()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _url  TEXT;
  _key  TEXT;
  _body JSONB;
BEGIN
  -- Only fire for new ringing calls
  IF NEW.status <> 'ringing' THEN
    RETURN NEW;
  END IF;

  -- Build the edge function URL
  _url := current_setting('app.supabase_url', true)
          || '/functions/v1/notify-incoming-call';

  -- Service role key for authorization
  _key := current_setting('app.supabase_service_role_key', true);

  -- Build payload — matches what the edge function expects
  _body := jsonb_build_object(
    'record', jsonb_build_object(
      'id',              NEW.id,
      'receiver_id',     NEW.receiver_id,
      'initiator_id',    NEW.initiator_id,
      'call_type',       NEW.call_type,
      'conversation_id', NEW.conversation_id,
      'status',          NEW.status
    )
  );

  -- Fire async HTTP POST (non-blocking — does not delay the INSERT)
  PERFORM extensions.http_post(
    url     := _url,
    body    := _body::TEXT,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the INSERT even if the HTTP call fails
  RAISE WARNING 'trigger_notify_incoming_call failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_call_insert_notify ON public.calls;

CREATE TRIGGER on_call_insert_notify
  AFTER INSERT ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_incoming_call();

-- Store Supabase URL and service role key as DB settings
-- Run these two lines manually in the Supabase SQL editor with your actual values:
--
--   ALTER DATABASE postgres SET app.supabase_url = 'https://gcckwqkzjoxraikosash.supabase.co';
--   ALTER DATABASE postgres SET app.supabase_service_role_key = '<your-service-role-key>';
--
-- Or set them here directly (replace the placeholder):
ALTER DATABASE postgres SET app.supabase_url = 'https://gcckwqkzjoxraikosash.supabase.co';
-- NOTE: Replace <SERVICE_ROLE_KEY> below with your actual Supabase service role key
-- (found in Supabase dashboard → Settings → API → service_role key)
-- ALTER DATABASE postgres SET app.supabase_service_role_key = '<SERVICE_ROLE_KEY>';
