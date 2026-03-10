CREATE TABLE public.subscription_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  plan_name text NOT NULL DEFAULT '',
  days_before integer NOT NULL,
  send_date date NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on reminders"
ON public.subscription_reminders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_reminders_send_date_sent ON public.subscription_reminders(send_date, sent);