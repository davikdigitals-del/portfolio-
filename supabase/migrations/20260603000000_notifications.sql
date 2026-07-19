-- =========================================
-- NOTIFICATIONS TABLE
-- Stores in-app notification history for
-- both admin and client users
-- =========================================

CREATE TYPE public.notification_type AS ENUM (
  'new_message',
  'missed_call',
  'incoming_call',
  'task_created',
  'system'
);

CREATE TABLE public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            public.notification_type NOT NULL DEFAULT 'new_message',
  title           TEXT NOT NULL,
  body            TEXT,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  read            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;

-- Users can only see their own notifications
CREATE POLICY "notif_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role inserts (from edge functions / triggers)
CREATE POLICY "notif_insert_own"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow service role unrestricted insert (edge functions use service role)
CREATE POLICY "notif_insert_service"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Users can mark their own as read / delete
CREATE POLICY "notif_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notif_delete_own"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =========================================
-- TRIGGER: auto-create notification when
-- a new message is inserted
-- =========================================
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin      BOOLEAN;
  v_conv_user_id  UUID;
  v_admin_user_id UUID;
  v_sender_name   TEXT;
  v_preview       TEXT;
BEGIN
  -- Skip call-type messages and deleted
  IF NEW.type = 'call' THEN RETURN NEW; END IF;
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  v_is_admin := public.has_role(NEW.sender_id, 'admin');

  -- Build preview text
  v_preview := CASE
    WHEN NEW.content IS NOT NULL AND length(NEW.content) > 0
      THEN left(NEW.content, 120)
    WHEN NEW.type = 'image'  THEN '📷 Image'
    WHEN NEW.type = 'voice'  THEN '🎙️ Voice note'
    WHEN NEW.type = 'file'   THEN '📎 File'
    ELSE 'New message'
  END;

  -- Sender name
  SELECT COALESCE(display_name, email, 'Someone')
  INTO v_sender_name
  FROM public.profiles WHERE user_id = NEW.sender_id;

  -- Get conversation owner
  SELECT user_id INTO v_conv_user_id
  FROM public.conversations WHERE id = NEW.conversation_id;

  IF v_is_admin THEN
    -- Admin sent → notify the client
    INSERT INTO public.notifications(user_id, type, title, body, conversation_id)
    VALUES (v_conv_user_id, 'new_message', '💬 ' || v_sender_name, v_preview, NEW.conversation_id);
  ELSE
    -- Client sent → notify the admin
    SELECT ur.user_id INTO v_admin_user_id
    FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;

    IF v_admin_user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, body, conversation_id)
      VALUES (v_admin_user_id, 'new_message', '📩 ' || v_sender_name, v_preview, NEW.conversation_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();

-- =========================================
-- TRIGGER: auto-create notification for
-- missed / declined calls
-- =========================================
CREATE OR REPLACE FUNCTION public.notify_on_call_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_name TEXT;
BEGIN
  -- Only fire when status becomes missed or declined
  IF NEW.status NOT IN ('missed', 'declined') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, email, 'Someone')
  INTO v_caller_name
  FROM public.profiles WHERE user_id = NEW.initiator_id;

  -- Notify receiver (they missed it)
  INSERT INTO public.notifications(user_id, type, title, body, conversation_id)
  VALUES (
    NEW.receiver_id,
    'missed_call',
    CASE WHEN NEW.status = 'missed' THEN '📵 Missed call' ELSE '📵 Declined call' END,
    CASE WHEN NEW.call_type = 'video' THEN 'Missed video call from ' ELSE 'Missed voice call from ' END || v_caller_name,
    NEW.conversation_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_call
  AFTER UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_call_update();
