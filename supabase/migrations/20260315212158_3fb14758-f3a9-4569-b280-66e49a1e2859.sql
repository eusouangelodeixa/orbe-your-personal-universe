
-- Add currency column to wallets (default BRL for existing wallets)
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';

-- Add exchange_rate column to wallet_transactions (rate at time of transaction, null for BRL)
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS exchange_rate_to_brl numeric DEFAULT NULL;
