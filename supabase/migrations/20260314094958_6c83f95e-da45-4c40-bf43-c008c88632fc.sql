INSERT INTO public.subscriptions (user_id, plan, plan_period, provider, status, starts_at, ends_at)
VALUES (
  '877f03b7-d7f8-4451-8853-9c97200b5797',
  'full',
  'anual',
  'manual',
  'active',
  now(),
  now() + interval '1 year'
);