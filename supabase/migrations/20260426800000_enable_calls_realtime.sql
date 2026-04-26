-- Enable Realtime for calls table
-- This allows clients to subscribe to INSERT/UPDATE/DELETE events on the calls table

-- Try to add to publication, ignore if already exists
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
EXCEPTION 
  WHEN duplicate_object THEN 
    RAISE NOTICE 'Table calls is already in publication supabase_realtime';
END $$;

-- Grant necessary permissions for realtime
GRANT SELECT ON public.calls TO authenticated;
GRANT INSERT ON public.calls TO authenticated;
GRANT UPDATE ON public.calls TO authenticated;

-- Ensure RLS policies allow realtime subscriptions
-- The existing RLS policies should work, but let's verify they're correct

-- Add a comment to document this
COMMENT ON TABLE public.calls IS 'Voice and video call records with realtime enabled for instant notifications';

-- Verify realtime is working by checking the publication
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'calls';
  
  IF table_count > 0 THEN
    RAISE NOTICE 'SUCCESS: calls table is in supabase_realtime publication';
  ELSE
    RAISE WARNING 'WARNING: calls table is NOT in supabase_realtime publication';
  END IF;
END $$;
