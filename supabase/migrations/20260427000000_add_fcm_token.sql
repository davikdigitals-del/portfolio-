-- Add FCM token column for native mobile push notifications
-- This allows the app to use Firebase Cloud Messaging instead of Web Push on mobile

ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Create index for faster FCM token lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_token 
ON public.push_subscriptions(fcm_token) 
WHERE fcm_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform 
ON public.push_subscriptions(platform) 
WHERE platform IS NOT NULL;

-- Update unique constraint to allow multiple subscriptions per user
-- (one for web, one for mobile, etc.)
ALTER TABLE public.push_subscriptions 
DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;

-- Add comment
COMMENT ON COLUMN public.push_subscriptions.fcm_token IS 'Firebase Cloud Messaging token for native mobile apps';
COMMENT ON COLUMN public.push_subscriptions.platform IS 'Platform: web, android, ios';
