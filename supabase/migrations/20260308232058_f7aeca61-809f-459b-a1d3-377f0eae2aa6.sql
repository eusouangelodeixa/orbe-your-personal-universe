
CREATE TABLE public.whatsapp_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to chat history" ON public.whatsapp_chat_history FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_whatsapp_chat_history_user_created ON public.whatsapp_chat_history (user_id, created_at DESC);
