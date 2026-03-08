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
    mutationFn: async (wallet: { name: string; balance?: number }) => {
      const initialBalance = wallet.balance ?? 0;
      // Create wallet with 0 balance, then add initial credit transaction if needed
      const { data, error } = await supabase
        .from("wallets")
        .insert({ name: wallet.name, balance: 0, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      // If there's an initial balance, record it as a transaction (trigger updates balance)
      if (initialBalance > 0) {
        const { error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            wallet_id: data.id,
            user_id: user!.id,
            amount: initialBalance,
            type: "credit",
            description: "Saldo inicial",
            reference_type: "manual",
          });
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
      const { data, error } = await supabase
        .from("wallet_transactions")
        .insert({ ...tx, user_id: user!.id })
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
          });
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
          .select("balance, name")
          .eq("id", expense.wallet_id)
          .single();
        if (wErr) throw wErr;
        if (Number(wallet.balance) < expense.amount) {
          throw new Error(
            `Saldo insuficiente na carteira "${wallet.name}". Disponível: R$ ${Number(wallet.balance).toFixed(2)}, necessário: R$ ${expense.amount.toFixed(2)}. Adicione fundos antes de registrar este gasto.`
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
          });
        if (txError) throw txError;
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

      // When marking as paid with a wallet, create a debit transaction
      if (paid && wallet_id && amount) {
        const { error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            wallet_id,
            user_id: user!.id,
            amount,
            type: "debit",
            description: `Gasto: ${name || "Despesa"}`,
            reference_type: "expense",
            reference_id: id,
          });
        if (txError) throw txError;
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
      // Delete related transactions first (trigger reverses balance)
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
    mutationFn: async ({ id, current_amount }: { id: string; current_amount: number }) => {
      const { error } = await supabase
        .from("savings_goals")
        .update({ current_amount })
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
