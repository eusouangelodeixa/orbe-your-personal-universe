
-- Broadcast campaigns table
CREATE TABLE public.broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamp with time zone,
  sending_config jsonb NOT NULL DEFAULT '{"min_delay": 8, "max_delay": 45, "hourly_limit": 80}'::jsonb,
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages campaigns"
  ON public.broadcast_campaigns FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read campaigns"
  ON public.broadcast_campaigns FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Broadcast recipients table
CREATE TABLE public.broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages recipients"
  ON public.broadcast_recipients FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read recipients"
  ON public.broadcast_recipients FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast campaign lookups
CREATE INDEX idx_broadcast_recipients_campaign ON public.broadcast_recipients(campaign_id);
CREATE INDEX idx_broadcast_recipients_status ON public.broadcast_recipients(campaign_id, status);
