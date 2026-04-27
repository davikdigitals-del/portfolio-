-- Scheduled calls and call links
CREATE TABLE IF NOT EXISTS public.scheduled_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type public.call_type NOT NULL DEFAULT 'voice',
  scheduled_at TIMESTAMPTZ NOT NULL,
  title TEXT,
  call_link TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'started', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_calls REPLICA IDENTITY FULL;

CREATE POLICY "scheduled_calls_participant" ON public.scheduled_calls
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_calls;
