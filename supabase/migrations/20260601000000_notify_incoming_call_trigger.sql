-- Trigger: fire notify-incoming-call edge function on every new call INSERT
-- Uses pg_net (built into Supabase) for async HTTP — does not block the INSERT

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_notify_incoming_call()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire for new ringing calls
  IF NEW.status::TEXT <> 'ringing' THEN
    RETURN NEW;
  END IF;

  -- net.http_post body must be jsonb (not text/bytea)
  -- Authorization header uses the service_role key
  PERFORM net.http_post(
    url     := 'https://gcckwqkzjoxraikosash.supabase.co/functions/v1/notify-incoming-call',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
        LIMIT 1
      )
    ),
    body    := jsonb_build_object(
      'record', jsonb_build_object(
        'id',              NEW.id,
        'receiver_id',     NEW.receiver_id,
        'initiator_id',    NEW.initiator_id,
        'call_type',       NEW.call_type::TEXT,
        'conversation_id', NEW.conversation_id,
        'status',          NEW.status::TEXT
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the INSERT if the HTTP call fails
  RAISE WARNING 'trigger_notify_incoming_call failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_call_insert_notify ON public.calls;

CREATE TRIGGER on_call_insert_notify
  AFTER INSERT ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_incoming_call();
