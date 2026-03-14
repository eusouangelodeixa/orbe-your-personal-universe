
CREATE TABLE public.agent_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agent text NOT NULL DEFAULT 'fit',
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  source text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent chat"
ON public.agent_chat_messages FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_agent_chat_user_agent ON public.agent_chat_messages(user_id, agent, created_at DESC);
