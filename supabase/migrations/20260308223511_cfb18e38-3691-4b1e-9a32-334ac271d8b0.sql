CREATE TABLE public.whatsapp_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  action_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE public.whatsapp_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to pending actions"
  ON public.whatsapp_pending_actions FOR ALL
  USING (false)
  WITH CHECK (false);
