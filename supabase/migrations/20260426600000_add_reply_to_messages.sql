-- Add reply functionality to messages
-- Add replied_to_id column to track which message this is replying to
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS replied_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_replied_to ON public.messages(replied_to_id);
