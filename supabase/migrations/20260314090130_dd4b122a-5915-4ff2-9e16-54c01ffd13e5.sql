-- Remove direct client read access to verification codes
DROP POLICY IF EXISTS "Users can view own verifications" ON public.phone_verifications;