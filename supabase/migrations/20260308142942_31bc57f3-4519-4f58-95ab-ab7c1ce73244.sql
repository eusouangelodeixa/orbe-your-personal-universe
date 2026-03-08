
-- Wallet transactions log
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  description TEXT NOT NULL DEFAULT '',
  reference_type TEXT, -- 'income', 'expense', 'manual'
  reference_id UUID,   -- links to income or expense id
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions"
  ON public.wallet_transactions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger: auto-update wallet balance on transaction insert
CREATE OR REPLACE FUNCTION public.update_wallet_balance_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.type = 'credit' THEN
    UPDATE public.wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
  ELSIF NEW.type = 'debit' THEN
    UPDATE public.wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wallet_balance_on_insert
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wallet_balance_on_transaction();

-- Trigger: reverse balance on transaction delete
CREATE OR REPLACE FUNCTION public.reverse_wallet_balance_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.type = 'credit' THEN
    UPDATE public.wallets SET balance = balance - OLD.amount WHERE id = OLD.wallet_id;
  ELSIF OLD.type = 'debit' THEN
    UPDATE public.wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_wallet_balance_on_delete
  BEFORE DELETE ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.reverse_wallet_balance_on_delete();

-- Enable realtime for wallet_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
