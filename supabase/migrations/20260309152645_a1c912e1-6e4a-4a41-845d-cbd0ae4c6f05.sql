
CREATE TABLE public.ai_resolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'prova',
  input_content TEXT,
  instructions TEXT,
  result TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own resolutions"
  ON public.ai_resolutions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
