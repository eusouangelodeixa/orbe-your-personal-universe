-- Add explicit service-role-only policy so RLS remains strict for client roles
CREATE POLICY "Service role manages verifications"
ON public.phone_verifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);