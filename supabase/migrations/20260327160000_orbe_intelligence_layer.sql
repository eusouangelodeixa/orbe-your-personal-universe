-- ============================================================
-- ORBE Intelligence & Direction Layer
-- Camada 2: Energia, Hábitos, Previsão, Review Semanal
-- Camada 3: Norte (Goals), Motor de Decisão Global
-- ============================================================

-- ─── 1. ENERGY LOGS ────────────────────────────────────────────
create table if not exists public.energy_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  energy_level smallint not null check (energy_level between 1 and 5),
  mental_fatigue smallint not null check (mental_fatigue between 1 and 5),
  motivation smallint not null default 3 check (motivation between 1 and 5),
  mood text check (mood in ('great','good','neutral','low','bad')),
  source text not null default 'panel' check (source in ('panel','whatsapp','auto')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.energy_logs enable row level security;

create policy "energy_logs_select" on public.energy_logs
  for select using (auth.uid() = user_id);
create policy "energy_logs_insert" on public.energy_logs
  for insert with check (auth.uid() = user_id);
create policy "energy_logs_update" on public.energy_logs
  for update using (auth.uid() = user_id);
create policy "energy_logs_delete" on public.energy_logs
  for delete using (auth.uid() = user_id);

create index idx_energy_logs_user_date on public.energy_logs (user_id, created_at desc);

-- ─── 2. HABITS ─────────────────────────────────────────────────
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  frequency text not null default 'daily' check (frequency in ('daily','weekly','weekdays','custom')),
  category text not null default 'personal' check (category in ('studies','fit','finance','personal','health')),
  linked_module text check (linked_module in ('studies','fit','finance','tasks',null)),
  icon text,
  color text default '#6366f1',
  target_per_period smallint not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.habits enable row level security;

create policy "habits_select" on public.habits for select using (auth.uid() = user_id);
create policy "habits_insert" on public.habits for insert with check (auth.uid() = user_id);
create policy "habits_update" on public.habits for update using (auth.uid() = user_id);
create policy "habits_delete" on public.habits for delete using (auth.uid() = user_id);

create index idx_habits_user_active on public.habits (user_id, active);

-- ─── 3. HABIT LOGS ─────────────────────────────────────────────
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_at timestamptz not null default now(),
  log_date date not null default current_date,
  streak_at_time integer not null default 0,
  notes text
);

alter table public.habit_logs enable row level security;

create policy "habit_logs_select" on public.habit_logs for select using (auth.uid() = user_id);
create policy "habit_logs_insert" on public.habit_logs for insert with check (auth.uid() = user_id);
create policy "habit_logs_update" on public.habit_logs for update using (auth.uid() = user_id);
create policy "habit_logs_delete" on public.habit_logs for delete using (auth.uid() = user_id);

create index idx_habit_logs_user_date on public.habit_logs (user_id, log_date desc);
create index idx_habit_logs_habit on public.habit_logs (habit_id, log_date desc);
create unique index idx_habit_logs_unique_day on public.habit_logs (habit_id, log_date);

-- ─── 4. PREDICTIONS ────────────────────────────────────────────
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prediction_type text not null check (prediction_type in ('academic_risk','financial_risk','fatigue','burnout','consistency_drop')),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  title text not null,
  details jsonb default '{}',
  suggested_action text,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.predictions enable row level security;

create policy "predictions_select" on public.predictions for select using (auth.uid() = user_id);
create policy "predictions_insert" on public.predictions for insert with check (auth.uid() = user_id);
create policy "predictions_update" on public.predictions for update using (auth.uid() = user_id);
create policy "predictions_delete" on public.predictions for delete using (auth.uid() = user_id);

create index idx_predictions_user_active on public.predictions (user_id, resolved, created_at desc);

-- ─── 5. WEEKLY REVIEWS ─────────────────────────────────────────
create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  summary jsonb not null default '{}',
  highlights text[] default '{}',
  lowlights text[] default '{}',
  adjustments text[] default '{}',
  overall_score smallint check (overall_score between 1 and 10),
  energy_avg numeric(3,1),
  study_hours numeric(5,1) default 0,
  workout_count smallint default 0,
  habits_completion_pct numeric(5,1) default 0,
  financial_health text check (financial_health in ('positive','neutral','negative')),
  created_at timestamptz not null default now()
);

alter table public.weekly_reviews enable row level security;

create policy "weekly_reviews_select" on public.weekly_reviews for select using (auth.uid() = user_id);
create policy "weekly_reviews_insert" on public.weekly_reviews for insert with check (auth.uid() = user_id);
create policy "weekly_reviews_update" on public.weekly_reviews for update using (auth.uid() = user_id);
create policy "weekly_reviews_delete" on public.weekly_reviews for delete using (auth.uid() = user_id);

create index idx_weekly_reviews_user on public.weekly_reviews (user_id, week_start desc);
create unique index idx_weekly_reviews_unique on public.weekly_reviews (user_id, week_start);

-- ─── 6. GOALS (NORTE) ──────────────────────────────────────────
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('financial','academic','physical','personal','career')),
  title text not null,
  description text,
  target_value numeric,
  current_value numeric default 0,
  unit text,
  deadline date,
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('active','paused','completed','abandoned')),
  parent_goal_id uuid references public.goals(id) on delete set null,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals_select" on public.goals for select using (auth.uid() = user_id);
create policy "goals_insert" on public.goals for insert with check (auth.uid() = user_id);
create policy "goals_update" on public.goals for update using (auth.uid() = user_id);
create policy "goals_delete" on public.goals for delete using (auth.uid() = user_id);

create index idx_goals_user_status on public.goals (user_id, status);
create index idx_goals_type on public.goals (user_id, goal_type);

-- ─── 7. GOAL MILESTONES ────────────────────────────────────────
create table if not exists public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  milestone_order smallint not null default 0,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','skipped')),
  linked_task_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.goal_milestones enable row level security;

create policy "goal_milestones_select" on public.goal_milestones for select using (auth.uid() = user_id);
create policy "goal_milestones_insert" on public.goal_milestones for insert with check (auth.uid() = user_id);
create policy "goal_milestones_update" on public.goal_milestones for update using (auth.uid() = user_id);
create policy "goal_milestones_delete" on public.goal_milestones for delete using (auth.uid() = user_id);

create index idx_goal_milestones_goal on public.goal_milestones (goal_id, milestone_order);

-- ─── 8. DAILY RECOMMENDATIONS (Motor de Decisão) ───────────────
create table if not exists public.daily_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_date date not null default current_date,
  energy_snapshot jsonb default '{}',
  context_snapshot jsonb default '{}',
  recommendations jsonb not null default '[]',
  applied boolean not null default false,
  feedback text check (feedback in ('helpful','neutral','not_helpful',null)),
  created_at timestamptz not null default now()
);

alter table public.daily_recommendations enable row level security;

create policy "daily_recommendations_select" on public.daily_recommendations for select using (auth.uid() = user_id);
create policy "daily_recommendations_insert" on public.daily_recommendations for insert with check (auth.uid() = user_id);
create policy "daily_recommendations_update" on public.daily_recommendations for update using (auth.uid() = user_id);
create policy "daily_recommendations_delete" on public.daily_recommendations for delete using (auth.uid() = user_id);

create index idx_daily_recs_user_date on public.daily_recommendations (user_id, recommendation_date desc);
create unique index idx_daily_recs_unique on public.daily_recommendations (user_id, recommendation_date);
