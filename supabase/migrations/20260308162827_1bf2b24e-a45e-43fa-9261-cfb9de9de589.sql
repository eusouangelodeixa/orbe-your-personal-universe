
-- Fit Profiles: physical data + nutritional questionnaire
CREATE TABLE IF NOT EXISTS public.fit_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  -- Physical profile
  age integer,
  sex text, -- 'masculino', 'feminino', 'outro'
  weight numeric, -- kg
  height numeric, -- cm
  bmi numeric GENERATED ALWAYS AS (CASE WHEN height > 0 THEN weight / ((height / 100.0) * (height / 100.0)) ELSE NULL END) STORED,
  goal text, -- perda_gordura, ganho_massa, hipertrofia, manutencao, condicionamento, saude_geral
  experience_level text, -- iniciante, intermediario, avancado
  weekly_availability jsonb DEFAULT '[]'::jsonb, -- [{day: 'segunda', time: '08:00'}]
  training_location text, -- academia, casa, ar_livre, misto
  available_equipment jsonb DEFAULT '[]'::jsonb, -- ['halteres', 'barra', 'elásticos']
  -- Nutritional questionnaire
  diet_type text, -- onivoro, vegetariano, vegetariano_estrito, vegano, pescetariano, flexitariano
  nutritional_program text, -- Afya, etc. or null
  food_allergies jsonb DEFAULT '[]'::jsonb,
  food_intolerances jsonb DEFAULT '[]'::jsonb,
  medical_conditions jsonb DEFAULT '[]'::jsonb,
  supplements jsonb DEFAULT '[]'::jsonb,
  has_nutritionist boolean DEFAULT false,
  monthly_food_budget numeric,
  -- Meta
  onboarding_completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fit_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own fit profile" ON public.fit_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fit Workout Plans
CREATE TABLE IF NOT EXISTS public.fit_workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'ai', -- ai, manual, pdf
  plan_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- structured workout plan
  pdf_url text,
  active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fit_workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout plans" ON public.fit_workout_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fit Workout Logs (check-ins)
CREATE TABLE IF NOT EXISTS public.fit_workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.fit_workout_plans(id) ON DELETE SET NULL,
  workout_date date NOT NULL DEFAULT CURRENT_DATE,
  workout_name text NOT NULL,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{name, sets, reps, weight}]
  duration_minutes integer,
  notes text,
  mood text, -- otimo, bom, normal, ruim
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fit_workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own workout logs" ON public.fit_workout_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fit Meal Plans
CREATE TABLE IF NOT EXISTS public.fit_meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'ai', -- ai, manual, pdf
  plan_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- structured meal plan
  shopping_list jsonb DEFAULT '[]'::jsonb,
  pdf_url text,
  active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fit_meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own meal plans" ON public.fit_meal_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fit Progress tracking (weight, measurements)
CREATE TABLE IF NOT EXISTS public.fit_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  weight numeric,
  body_fat_pct numeric,
  measurements jsonb DEFAULT '{}'::jsonb, -- {chest, waist, hips, biceps, thighs}
  photos jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fit_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own progress" ON public.fit_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fit Chat Messages
CREATE TABLE IF NOT EXISTS public.fit_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL, -- user, assistant
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fit_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own fit chat" ON public.fit_chat_messages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fit Reminders
CREATE TABLE IF NOT EXISTS public.fit_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL, -- treino, refeicao, hidratacao
  title text NOT NULL,
  time text NOT NULL, -- HH:MM format
  days jsonb DEFAULT '[]'::jsonb, -- ['segunda', 'terca', ...]
  enabled boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fit_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own fit reminders" ON public.fit_reminders
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_fit_profiles_updated_at BEFORE UPDATE ON public.fit_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fit_workout_plans_updated_at BEFORE UPDATE ON public.fit_workout_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fit_meal_plans_updated_at BEFORE UPDATE ON public.fit_meal_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fit_reminders_updated_at BEFORE UPDATE ON public.fit_reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
