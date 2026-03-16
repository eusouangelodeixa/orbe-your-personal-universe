-- Drop duplicate triggers (keep the original ones with trg_ prefix)
DROP TRIGGER IF EXISTS update_wallet_balance_on_transaction_trigger ON public.wallet_transactions;
DROP TRIGGER IF EXISTS reverse_wallet_balance_on_delete_trigger ON public.wallet_transactions;
DROP TRIGGER IF EXISTS validate_wallet_balance_before_debit_tx_trigger ON public.wallet_transactions;
DROP TRIGGER IF EXISTS validate_wallet_balance_before_paid_expense_trigger ON public.expenses;