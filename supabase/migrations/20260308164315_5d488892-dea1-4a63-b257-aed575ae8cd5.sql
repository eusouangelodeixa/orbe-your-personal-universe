
-- Create storage bucket for fit progress photos
INSERT INTO storage.buckets (id, name, public) VALUES ('fit-photos', 'fit-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for fit-photos bucket
CREATE POLICY "Users can upload own fit photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fit-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own fit photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fit-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own fit photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fit-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view fit photos"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'fit-photos');
