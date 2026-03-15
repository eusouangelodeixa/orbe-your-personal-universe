import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Expense = Tables<"expenses">;
type Income = Tables<"incomes">;
type Category = Tables<"categories">;
type Wallet = Tables<"wallets">;
type WalletTransaction = Tables<"wallet_transactions">;

const now = new Date();

/** Fetch the current exchange rate (foreign → BRL) for a wallet's currency. Returns null for BRL wallets. */
async function getWalletExchangeRate(walletId: string): Promise<number | null> {
  const info = await getWalletCurrencyInfo(walletId);
  return info.exchangeRateToBrl;
}

/** Get wallet currency info: currency code, exchange_rate_to_brl, and foreignPerBrl rate */
async function getWalletCurrencyInfo(walletId: string): Promise<{
  currency: string;
  exchangeRateToBrl: number | null; // how many BRL per 1 foreign unit
  foreignPerBrl: number | null;     // how many foreign per 1 BRL
}> {
  const { data: wallet } = await supabase
    .from("wallets")
    .select("currency")
    .eq("id", walletId)
    .single();
  const currency = (wallet as any)?.currency || "BRL";
  if (currency === "BRL") return { currency, exchangeRateToBrl: null, foreignPerBrl: null };

  const { data, error } = await supabase.functions.invoke("exchange-rates", {
    body: { base: "BRL", symbols: currency },
  });
  if (error || data?.error || !data?.rates?.[currency]) return { currency, exchangeRateToBrl: null, foreignPerBrl: null };
  // rates[currency] = foreign per 1 BRL
  const foreignPerBrl = data.rates[currency];
  const exchangeRateToBrl = foreignPerBrl > 0 ? 1 / foreignPerBrl : null;
  return { currency, exchangeRateToBrl, foreignPerBrl };
}

/** Convert a BRL amount to a wallet's native currency. Returns original amount if wallet is BRL. */
async function convertBrlToWalletCurrency(brlAmount: number, walletId: string): Promise<{ convertedAmount: number; info: Awaited<ReturnType<typeof getWalletCurrencyInfo>> }> {
  const info = await getWalletCurrencyInfo(walletId);
  if (info.currency === "BRL" || !info.foreignPerBrl) {
    return { convertedAmount: brlAmount, info };
  }
  // BRL → foreign: multiply by foreignPerBrl
  return { convertedAmount: brlAmount * info.foreignPerBrl, info };
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useIncomes(month = now.getMonth() + 1, year = now.getFullYear()) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["incomes", user?.id, month, year],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("*, wallets(name)")
        .eq("user_id", user!.id)
        .eq("month", month)
        .eq("year", year)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useExpenses(month = now.getMonth() + 1, year = now.getFullYear()) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["expenses", user?.id, month, year],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, categories(name, icon, color), wallets(name)")
        .eq("user_id", user!.id)
        .eq("month", month)
        .eq("year", year)
        .order("due_date");
      if (error) throw error;
      return data;
    },
  });
}

// ========== WALLETS ==========

export function useWallets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wallets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as Wallet[];
    },
  });
}

export function useAddWallet() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (wallet: { name: string; balance?: number; currency?: string }) => {
      const initialBalance = wallet.balance ?? 0;
      const walletCurrency = wallet.currency || "BRL";
      // Create wallet with 0 balance, then add initial credit transaction if needed
      const { data, error } = await supabase
        .from("wallets")
        .insert({ name: wallet.name, balance: 0, user_id: user!.id, currency: walletCurrency } as any)
        .select()
        .single();
      if (error) throw error;

      // If there's an initial balance, record it as a transaction (trigger updates balance)
      if (initialBalance > 0) {
        const rate = await getWalletExchangeRate(data.id);
        const { error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            wallet_id: data.id,
            user_id: user!.id,
            amount: initialBalance,
            type: "credit",
            description: "Saldo inicial",
            reference_type: "manual",
            exchange_rate_to_brl: rate,
          } as any);
        if (txError) throw txError;
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      toast.success("Carteira criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wallets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      toast.success("Carteira removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Record a wallet transaction (balance updated automatically via DB trigger)
export function useAddWalletTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (tx: {
      wallet_id: string;
      amount: number;
      type: "credit" | "debit";
      description: string;
      reference_type?: string;
      reference_id?: string;
    }) => {
      // Check balance before debit
      if (tx.type === "debit") {
        const { data: wallet, error: wErr } = await supabase
          .from("wallets")
          .select("balance, name")
          .eq("id", tx.wallet_id)
          .single();
        if (wErr) throw wErr;
        if (Number(wallet.balance) < tx.amount) {
          throw new Error(
            `Saldo insuficiente na carteira "${wallet.name}". Disponível: R$ ${Number(wallet.balance).toFixed(2)}.`
          );
        }
      }
      const rate = await getWalletExchangeRate(tx.wallet_id);
      const { data, error } = await supabase
        .from("wallet_transactions")
        .insert({ ...tx, user_id: user!.id, exchange_rate_to_brl: rate } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      toast.success(vars.type === "credit" ? "Crédito registrado" : "Débito registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Fetch wallet transactions (optionally filtered by wallet)
export function useWalletTransactions(walletId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wallet_transactions", user?.id, walletId],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("wallet_transactions")
        .select("*, wallets(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (walletId) query = query.eq("wallet_id", walletId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// ========== INCOMES ==========

export function useAddIncome() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (income: Omit<TablesInsert<"incomes">, "user_id"> & { wallet_id?: string | null }) => {
      const { data, error } = await supabase
        .from("incomes")
        .insert({ ...income, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      // If linked to a wallet, create a credit transaction
      if (income.wallet_id) {
        const rate = await getWalletExchangeRate(income.wallet_id);
        const { error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            wallet_id: income.wallet_id,
            user_id: user!.id,
            amount: income.amount,
            type: "credit",
            description: `Renda: ${income.description}`,
            reference_type: "income",
            reference_id: data.id,
            exchange_rate_to_brl: rate,
          } as any);
        if (txError) throw txError;
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incomes"] });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      toast.success("Renda adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (expense: Omit<TablesInsert<"expenses">, "user_id">) => {
      // If wallet is specified, check balance first
      const shouldAutoPay = !!expense.wallet_id;
      if (shouldAutoPay && expense.wallet_id) {
        const { data: wallet, error: wErr } = await supabase
          .from("wallets")
          .select("balance, name, currency")
          .eq("id", expense.wallet_id)
          .single();
        if (wErr) throw wErr;
        const wCur = (wallet as any).currency || "BRL";
        if (Number(wallet.balance) < expense.amount) {
          throw new Error(
            `Saldo insuficiente na carteira "${wallet.name}". Disponível: ${Number(wallet.balance).toFixed(2)} ${wCur}, necessário: ${expense.amount.toFixed(2)} ${wCur}. Adicione fundos antes de registrar este gasto.`
          );
        }
      }

      const { data, error } = await supabase
        .from("expenses")
        .insert({ ...expense, paid: shouldAutoPay, user_id: user!.id })
        .select("*, categories(name, icon, color)")
        .single();
      if (error) throw error;

      // If linked to a wallet, create a debit transaction
      if (shouldAutoPay && expense.wallet_id) {
        const rate = await getWalletExchangeRate(expense.wallet_id);
        const { error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            wallet_id: expense.wallet_id,
            user_id: user!.id,
            amount: expense.amount,
            type: "debit",
            description: `Gasto: ${expense.name}`,
            reference_type: "expense",
            reference_id: data.id,
            exchange_rate_to_brl: rate,
          } as any);

        if (txError) {
          // Safety rollback to avoid a paid expense without transaction
          await supabase.from("expenses").delete().eq("id", data.id);
          throw new Error(txError.message);
        }
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      toast.success("Gasto adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleExpensePaid() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, paid, wallet_id, amount, name }: {
      id: string; paid: boolean; wallet_id?: string | null; amount?: number; name?: string;
    }) => {
      const { error } = await supabase.from("expenses").update({ paid, wallet_id: wallet_id || null }).eq("id", id);
      if (error) throw error;

      // When marking as paid with a wallet, convert amount and check balance
      if (paid && wallet_id && amount) {
        // The expense amount is stored in its original currency.
        // If the expense had no wallet (wallet_id was null), it's in BRL.
        // We need to get the expense's original wallet to determine its currency.
        const { data: expenseRow } = await supabase
          .from("expenses")
          .select("wallet_id")
          .eq("id", id)
          .single();
        // The expense was just updated with the new wallet_id, so check if it originally had one
        // Since we already updated, fetch from wallet_transactions or use the fact that
        // if the user is choosing a wallet now, the expense amount is in BRL (no original wallet)
        // or in the original wallet's currency.
        // For safety, determine expense currency from the ORIGINAL wallet before update.
        // Since we already updated wallet_id, we use the payment wallet to convert.
        
        // Convert the expense amount (assumed BRL for expenses without a wallet) to the payment wallet's currency
        const { convertedAmount, info } = await convertBrlToWalletCurrency(amount, wallet_id);
        
        const { data: wallet, error: wErr } = await supabase
          .from("wallets")
          .select("balance, name")
          .eq("id", wallet_id)
          .single();
        if (wErr) throw wErr;
        if (Number(wallet.balance) < convertedAmount) {
          // Revert the paid status
          await supabase.from("expenses").update({ paid: false, wallet_id: null }).eq("id", id);
          throw new Error(
            `Saldo insuficiente na carteira "${wallet.name}". Disponível: ${Number(wallet.balance).toFixed(2)} ${info.currency}, necessário: ${convertedAmount.toFixed(2)} ${info.currency}.`
          );
        }
        const { error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            wallet_id,
            user_id: user!.id,
            amount: convertedAmount,
            type: "debit",
            description: `Gasto: ${name || "Despesa"}`,
            reference_type: "expense",
            reference_id: id,
            exchange_rate_to_brl: info.exchangeRateToBrl,
          } as any);
        if (txError) {
          await supabase.from("expenses").update({ paid: false, wallet_id: null }).eq("id", id);
          throw new Error(txError.message);
        }
      }

      // When unmarking as paid, remove the related transaction
      if (!paid) {
        await supabase
          .from("wallet_transactions")
          .delete()
          .eq("reference_type", "expense")
          .eq("reference_id", id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related transactions first (trigger reverses balance)
      await supabase
        .from("wallet_transactions")
        .delete()
        .eq("reference_type", "expense")
        .eq("reference_id", id);

      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      toast.success("Gasto removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("wallet_transactions")
        .delete()
        .eq("reference_type", "income")
        .eq("reference_id", id);
      const { error } = await supabase.from("incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incomes"] });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      toast.success("Renda removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ========== UPDATE EXPENSE ==========

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; amount?: number; due_date?: string; type?: string; category_id?: string | null; wallet_id?: string | null; recurring?: boolean; recurring_day?: number | null }) => {
      const { error } = await supabase.from("expenses").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ========== WALLET TRANSFER ==========

export function useWalletTransfer() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ fromId, toId, amount, description }: { fromId: string; toId: string; amount: number; description?: string }) => {
      // Check source balance
      const { data: from, error: fErr } = await supabase.from("wallets").select("balance, name").eq("id", fromId).single();
      if (fErr) throw fErr;
      if (Number(from.balance) < amount) throw new Error(`Saldo insuficiente em "${from.name}". Disponível: R$ ${Number(from.balance).toFixed(2)}`);

      const { data: to } = await supabase.from("wallets").select("name").eq("id", toId).single();
      const desc = description || `Transferência para ${to?.name || "outra carteira"}`;

      // Fetch rates for both wallets
      const [rateFrom, rateTo] = await Promise.all([
        getWalletExchangeRate(fromId),
        getWalletExchangeRate(toId),
      ]);

      // Debit from source
      const { error: e1 } = await supabase.from("wallet_transactions").insert({
        wallet_id: fromId, user_id: user!.id, amount, type: "debit",
        description: `Transferência → ${to?.name}`, reference_type: "transfer",
        exchange_rate_to_brl: rateFrom,
      } as any);
      if (e1) throw e1;

      // Credit to destination
      const { error: e2 } = await supabase.from("wallet_transactions").insert({
        wallet_id: toId, user_id: user!.id, amount, type: "credit",
        description: `Transferência ← ${from.name}`, reference_type: "transfer",
        exchange_rate_to_brl: rateTo,
      } as any);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet_transactions"] });
      toast.success("Transferência realizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ========== FINANCIAL HISTORY (for charts) ==========

export function useFinancialHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["financial_history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const now = new Date();
      const months: {
        month: number;
        year: number;
        incomes: { amount: number; wallet_id: string | null }[];
        expenses: { amount: number; wallet_id: string | null }[];
      }[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();

        const [{ data: inc, error: incError }, { data: exp, error: expError }] = await Promise.all([
          supabase.from("incomes").select("amount, wallet_id").eq("user_id", user!.id).eq("month", m).eq("year", y),
          supabase.from("expenses").select("amount, wallet_id").eq("user_id", user!.id).eq("month", m).eq("year", y),
        ]);

        if (incError) throw incError;
        if (expError) throw expError;

        months.push({
          month: m,
          year: y,
          incomes: (inc || []).map((row) => ({ amount: Number(row.amount), wallet_id: row.wallet_id ?? null })),
          expenses: (exp || []).map((row) => ({ amount: Number(row.amount), wallet_id: row.wallet_id ?? null })),
        });
      }

      return months;
    },
  });
}

// ========== SAVINGS GOALS ==========

export function useSavingsGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["savings_goals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", user!.id)
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddSavingsGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (goal: { name: string; target_amount: number; deadline?: string }) => {
      const { error } = await supabase.from("savings_goals").insert({
        ...goal,
        user_id: user!.id,
        current_amount: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings_goals"] });
      toast.success("Meta criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; current_amount?: number; name?: string; target_amount?: number; deadline?: string | null }) => {
      const { error } = await supabase
        .from("savings_goals")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings_goals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("savings_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings_goals"] });
      toast.success("Meta removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ========== SAVINGS TRANSACTIONS ==========

export function useSavingsTransactions(goalId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["savings_transactions", user?.id, goalId],
    enabled: !!user && !!goalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("goal_id", goalId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddSavingsTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (tx: { goal_id: string; amount: number; type: string; description?: string }) => {
      const { error } = await supabase.from("savings_transactions").insert({
        ...tx,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings_transactions"] });
      qc.invalidateQueries({ queryKey: ["savings_goals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
