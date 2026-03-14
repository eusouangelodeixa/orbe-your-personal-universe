-- 1) Restrict sensitive table policies to authenticated users only
ALTER POLICY "Users can manage own expenses"
ON public.expenses
TO authenticated;

ALTER POLICY "Users can manage own wallets"
ON public.wallets
TO authenticated;

ALTER POLICY "Users can manage own incomes"
ON public.incomes
TO authenticated;

ALTER POLICY "Users can manage own goals"
ON public.savings_goals
TO authenticated;

ALTER POLICY "Users can insert own profile"
ON public.profiles
TO authenticated;

ALTER POLICY "Users can update own profile"
ON public.profiles
TO authenticated;

ALTER POLICY "Users can view own profile"
ON public.profiles
TO authenticated;

-- 2) Prevent authenticated users from self-approving phone verification
DROP POLICY IF EXISTS "Users can manage own verifications" ON public.phone_verifications;

CREATE POLICY "Users can view own verifications"
ON public.phone_verifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3) Data repair: sync profile verification state from latest verified records
WITH latest_verified AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    phone,
    created_at
  FROM public.phone_verifications
  WHERE verified = true
  ORDER BY user_id, created_at DESC
)
UPDATE public.profiles p
SET
  phone = lv.phone,
  phone_verified = true,
  updated_at = now()
FROM latest_verified lv
WHERE p.user_id = lv.user_id
  AND (p.phone_verified IS DISTINCT FROM true OR p.phone IS DISTINCT FROM lv.phone);