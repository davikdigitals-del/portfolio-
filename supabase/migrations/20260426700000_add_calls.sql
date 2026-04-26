-- Add calls table for voice and video call history
CREATE TYPE call_type AS ENUM ('voice', 'video');
CREATE TYPE call_status AS ENUM ('ringing', 'active', 'ended', 'missed', 'declined');

CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type call_type NOT NULL,
  status call_status NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_calls_conversation_id ON public.calls(conversation_id);
CREATE INDEX idx_calls_initiator_id ON public.calls(initiator_id);
CREATE INDEX idx_calls_receiver_id ON public.calls(receiver_id);
CREATE INDEX idx_calls_status ON public.calls(status);
CREATE INDEX idx_calls_created_at ON public.calls(created_at DESC);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calls table
-- Users can view calls they're part of
CREATE POLICY "Users can view their calls"
  ON public.calls FOR SELECT
  USING (
    auth.uid() = initiator_id OR auth.uid() = receiver_id
  );

-- Users can insert calls they initiate
CREATE POLICY "Users can initiate calls"
  ON public.calls FOR INSERT
  WITH CHECK (
    auth.uid() = initiator_id
  );

-- Users can update calls they're part of
CREATE POLICY "Users can update their calls"
  ON public.calls FOR UPDATE
  USING (
    auth.uid() = initiator_id OR auth.uid() = receiver_id
  )
  WITH CHECK (
    auth.uid() = initiator_id OR auth.uid() = receiver_id
  );

-- Add call_id to messages table to link calls to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_call_id ON public.messages(call_id);
