-- Add 'call' as a message type so call events appear in chat like WhatsApp
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'call';

-- Add call_data column to messages for storing call metadata
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS call_data JSONB;
