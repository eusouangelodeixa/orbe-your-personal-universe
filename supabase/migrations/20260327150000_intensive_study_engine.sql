-- ─── Intensive Study Engine — 4 tables ──────────────────────────────────────

-- 1. Sessions (root plan for one study day)
CREATE TABLE public.intensive_study_sessions (
  id                   UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal                 TEXT NOT NULL CHECK (goal IN ('recovery', 'exam_prep', 'mastery', 'review')),
  status               TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'partial', 'not_completed')),
  plan_date            DATE NOT NULL,
  wake_time            TIME,
  sleep_time           TIME,
  high_energy_start    TIME,
  high_energy_end      TIME,
  total_blocks         INT NOT NULL DEFAULT 0,
  completed_blocks     INT NOT NULL DEFAULT 0,
  notes                TEXT,
  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.intensive_study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own intensive sessions"
  ON public.intensive_study_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_intensive_study_sessions_updated_at
  BEFORE UPDATE ON public.intensive_study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_intensive_sessions_user_date ON public.intensive_study_sessions (user_id, plan_date);

-- 2. Blocks (individual study block inside a session)
CREATE TABLE public.intensive_study_blocks (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id       UUID NOT NULL REFERENCES public.intensive_study_sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic            TEXT NOT NULL,
  difficulty_level INT NOT NULL DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
  urgency_level    INT NOT NULL DEFAULT 3 CHECK (urgency_level BETWEEN 1 AND 5),
  priority_score   NUMERIC(5,2) NOT NULL DEFAULT 3.0,
  duration_min     INT NOT NULL DEFAULT 25,
  start_time       TIME,
  block_order      INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'partial', 'not_completed')),
  comprehension    TEXT CHECK (comprehension IN ('understood', 'partial', 'not_understood')),
  quiz_score       NUMERIC(5,2),
  pomodoro_count   INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.intensive_study_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own intensive blocks"
  ON public.intensive_study_blocks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_intensive_study_blocks_updated_at
  BEFORE UPDATE ON public.intensive_study_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_intensive_blocks_session ON public.intensive_study_blocks (session_id, block_order);
CREATE INDEX idx_intensive_blocks_user ON public.intensive_study_blocks (user_id);

-- 3. Topics (reusable topic library per subject)
CREATE TABLE public.intensive_study_topics (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic            TEXT NOT NULL,
  difficulty_level INT NOT NULL DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
  urgency_level    INT NOT NULL DEFAULT 3 CHECK (urgency_level BETWEEN 1 AND 5),
  priority_score   NUMERIC(5,2) NOT NULL DEFAULT 3.0,
  times_studied    INT NOT NULL DEFAULT 0,
  avg_quiz_score   NUMERIC(5,2),
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.intensive_study_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own intensive topics"
  ON public.intensive_study_topics FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_intensive_study_topics_updated_at
  BEFORE UPDATE ON public.intensive_study_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_intensive_topics_user_subject ON public.intensive_study_topics (user_id, subject_id);

-- 4. Quiz results (per block)
CREATE TABLE public.intensive_study_quiz_results (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id         UUID NOT NULL REFERENCES public.intensive_study_blocks(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question         TEXT NOT NULL,
  user_answer      TEXT,
  is_correct       BOOLEAN,
  response_time_s  INT,
  confidence       INT CHECK (confidence BETWEEN 1 AND 5),
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.intensive_study_quiz_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quiz results"
  ON public.intensive_study_quiz_results FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_intensive_quiz_block ON public.intensive_study_quiz_results (block_id);
CREATE INDEX idx_intensive_quiz_user ON public.intensive_study_quiz_results (user_id);
