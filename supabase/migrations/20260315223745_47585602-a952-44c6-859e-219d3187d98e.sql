-- Attach wallet balance automation and validation triggers to existing tables
-- These triggers already have backing functions in public schema; this migration only wires them up safely.

-- wallet_transactions: prevent negative balance before debit transactions
DROP TRIGGER IF EXISTS validate_wallet_balance_before_debit_tx_trigger ON public.wallet_transactions;
CREATE TRIGGER validate_wallet_balance_before_debit_tx_trigger
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.validate_wallet_balance_before_debit_tx();

-- wallet_transactions: apply balance changes on insert
DROP TRIGGER IF EXISTS update_wallet_balance_on_transaction_trigger ON public.wallet_transactions;
CREATE TRIGGER update_wallet_balance_on_transaction_trigger
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_wallet_balance_on_transaction();

-- wallet_transactions: reverse balance changes on delete
DROP TRIGGER IF EXISTS reverse_wallet_balance_on_delete_trigger ON public.wallet_transactions;
CREATE TRIGGER reverse_wallet_balance_on_delete_trigger
AFTER DELETE ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.reverse_wallet_balance_on_delete();

-- expenses: validate balance before creating/updating a paid expense linked to a wallet
DROP TRIGGER IF EXISTS validate_wallet_balance_before_paid_expense_trigger ON public.expenses;
CREATE TRIGGER validate_wallet_balance_before_paid_expense_trigger
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.validate_wallet_balance_before_paid_expense();