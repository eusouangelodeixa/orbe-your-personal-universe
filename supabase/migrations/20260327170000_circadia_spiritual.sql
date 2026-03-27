-- ================================================================
-- ORBE: Circadia + Formação Espiritual — Migration
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- CIRCADIA MODULE
-- ────────────────────────────────────────────────────────────────

-- 1. Circadian Profile (fonte de verdade do perfil circadiano)
CREATE TABLE IF NOT EXISTS circadian_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_sleep_time   TIME NOT NULL DEFAULT '23:00',
  target_wake_time    TIME NOT NULL DEFAULT '07:00',
  sleep_latency_estimate INTEGER NOT NULL DEFAULT 15,  -- minutos para adormecer
  wake_difficulty     INTEGER NOT NULL DEFAULT 3 CHECK (wake_difficulty BETWEEN 1 AND 5),
  flex_window_minutes INTEGER NOT NULL DEFAULT 15,
  screen_usage        TEXT NOT NULL DEFAULT 'medium' CHECK (screen_usage IN ('low','medium','high')),
  caffeine_usage      BOOLEAN NOT NULL DEFAULT false,
  caffeine_cutoff     TIME,                            -- horário de corte de cafeína
  objective           TEXT NOT NULL DEFAULT 'regular_routine' CHECK (objective IN ('wake_early','regular_routine','cognitive_performance')),
  consistency_level   TEXT NOT NULL DEFAULT 'irregular' CHECK (consistency_level IN ('irregular','somewhat','consistent')),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Sleep Sessions (sessões diárias automáticas)
CREATE TABLE IF NOT EXISTS sleep_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date   DATE NOT NULL,
  planned_sleep  TIMESTAMPTZ NOT NULL,
  planned_wake   TIMESTAMPTZ NOT NULL,
  actual_wake    TIMESTAMPTZ,
  wake_confirmed BOOLEAN NOT NULL DEFAULT false,
  wake_method    TEXT CHECK (wake_method IN ('link','whatsapp','manual')),
  deviation_minutes INTEGER,    -- diferença em minutos (positive = atrasado)
  score          INTEGER CHECK (score BETWEEN 0 AND 100),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_date)
);

-- 3. Circadian Events (event-driven: emitidos pelo Circadia)
CREATE TABLE IF NOT EXISTS circadian_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('wake_confirmed','score_updated','pattern_detected','profile_adjusted')),
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Circadian Insights (insights automáticos)
CREATE TABLE IF NOT EXISTS circadian_insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type  TEXT NOT NULL,
  message       TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  acknowledged  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Circadian Adjustments (sugestões de ajuste do perfil)
CREATE TABLE IF NOT EXISTS circadian_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL,
  current_value   TEXT NOT NULL,
  suggested_value TEXT NOT NULL,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ────────────────────────────────────────────────────────────────
-- FORMAÇÃO ESPIRITUAL MODULE
-- ────────────────────────────────────────────────────────────────

-- 6. Spiritual Profile
CREATE TABLE IF NOT EXISTS spiritual_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_translation TEXT NOT NULL DEFAULT 'NVI' CHECK (preferred_translation IN ('NVI','ARA','NTLH')),
  reminder_time         TIME NOT NULL DEFAULT '07:00',
  reminder_channel      TEXT NOT NULL DEFAULT 'whatsapp' CHECK (reminder_channel IN ('whatsapp','push','email')),
  spiritual_goal        TEXT,
  onboarding_completed  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 7. Spiritual Plans
CREATE TABLE IF NOT EXISTS spiritual_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  theme       TEXT NOT NULL,
  plan_type   TEXT NOT NULL CHECK (plan_type IN ('intensive','intermediate','deep','complete')),
  total_days  INTEGER NOT NULL,
  current_day INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Spiritual Plan Days (conteúdo de cada dia)
CREATE TABLE IF NOT EXISTS spiritual_plan_days (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                UUID NOT NULL REFERENCES spiritual_plans(id) ON DELETE CASCADE,
  day_number             INTEGER NOT NULL,
  verse_reference        TEXT NOT NULL,
  verse_text             TEXT NOT NULL,
  explanation            TEXT NOT NULL,
  reflection_questions   TEXT[] NOT NULL DEFAULT '{}',
  practical_application  TEXT NOT NULL,
  completed              BOOLEAN NOT NULL DEFAULT false,
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, day_number)
);

-- 9. Spiritual Logs (check-ins diários)
CREATE TABLE IF NOT EXISTS spiritual_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id      UUID REFERENCES spiritual_plans(id) ON DELETE SET NULL,
  plan_day_id  UUID REFERENCES spiritual_plan_days(id) ON DELETE SET NULL,
  log_date     DATE NOT NULL,
  read_confirmed BOOLEAN NOT NULL DEFAULT true,
  reflection_notes TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_day_id)
);

-- 10. Daily Verses (versículo do dia inteligente)
CREATE TABLE IF NOT EXISTS spiritual_daily_verses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_date      DATE NOT NULL,
  verse_reference TEXT NOT NULL,
  verse_text      TEXT NOT NULL,
  explanation     TEXT NOT NULL,
  application     TEXT NOT NULL,
  sent_via        TEXT CHECK (sent_via IN ('whatsapp','push','email','panel')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, verse_date)
);


-- ────────────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────

ALTER TABLE circadian_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE circadian_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE circadian_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE circadian_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE spiritual_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE spiritual_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE spiritual_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE spiritual_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE spiritual_daily_verses ENABLE ROW LEVEL SECURITY;

-- RLS policies: user can only access own data
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'circadian_profiles','sleep_sessions','circadian_events',
    'circadian_insights','circadian_adjustments',
    'spiritual_profiles','spiritual_plans','spiritual_logs',
    'spiritual_daily_verses'
  ])
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      'rls_' || tbl, tbl);
  END LOOP;
END $$;

-- spiritual_plan_days: indirect via plan ownership
CREATE POLICY rls_spiritual_plan_days ON spiritual_plan_days
  FOR ALL
  USING (EXISTS (SELECT 1 FROM spiritual_plans sp WHERE sp.id = plan_id AND sp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM spiritual_plans sp WHERE sp.id = plan_id AND sp.user_id = auth.uid()));


-- ────────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user_date ON sleep_sessions(user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_circadian_events_user ON circadian_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circadian_insights_user ON circadian_insights(user_id, acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circadian_adjustments_user ON circadian_adjustments(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spiritual_plans_user ON spiritual_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_spiritual_plan_days_plan ON spiritual_plan_days(plan_id, day_number);
CREATE INDEX IF NOT EXISTS idx_spiritual_logs_user ON spiritual_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_spiritual_daily_verses_user ON spiritual_daily_verses(user_id, verse_date DESC);
