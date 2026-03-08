CREATE TABLE public.whatsapp_processed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);

ALTER TABLE public.whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to processed messages"
  ON public.whatsapp_processed_messages FOR ALL
  USING (false)
  WITH CHECK (false);