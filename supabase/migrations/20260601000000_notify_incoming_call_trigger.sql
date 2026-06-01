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

  PERFORM net.http_post(
    url     := 'https://gcckwqkzjoxraikosash.supabase.co/functions/v1/notify-incoming-call',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY2t3cWt6am94cmFpa29zYXNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE3MDgzNCwiZXhwIjoyMDkyNzQ2ODM0fQ.rveP7k6IxLXtIkRiLQlo7snseK4PiIm-0TN9sagSCzc'
    ),
    body := jsonb_build_object(
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
  RAISE WARNING 'trigger_notify_incoming_call failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_call_insert_notify ON public.calls;

CREATE TRIGGER on_call_insert_notify
  AFTER INSERT ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_incoming_call();
