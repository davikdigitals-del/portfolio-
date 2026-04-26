-- Enable Realtime for calls table
-- This allows clients to subscribe to INSERT/UPDATE/DELETE events on the calls table

-- Enable realtime publication for calls table
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- Grant necessary permissions for realtime
GRANT SELECT ON public.calls TO authenticated;
GRANT INSERT ON public.calls TO authenticated;
GRANT UPDATE ON public.calls TO authenticated;

-- Ensure RLS policies allow realtime subscriptions
-- The existing RLS policies should work, but let's verify they're correct

-- Add a comment to document this
COMMENT ON TABLE public.calls IS 'Voice and video call records with realtime enabled for instant notifications';
