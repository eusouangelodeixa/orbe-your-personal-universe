
-- Add ementa fields to subjects
ALTER TABLE public.subjects ADD COLUMN ementa_url TEXT;
ALTER TABLE public.subjects ADD COLUMN ementa_text TEXT;

-- Create storage bucket for ementas
INSERT INTO storage.buckets (id, name, public) VALUES ('ementas', 'ementas', false);

-- RLS for ementas bucket: users can manage their own files
CREATE POLICY "Users can upload ementas" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ementas' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can read own ementas" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ementas' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own ementas" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ementas' AND (storage.foldername(name))[1] = auth.uid()::text);
