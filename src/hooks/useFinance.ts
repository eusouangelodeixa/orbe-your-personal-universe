import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Expense = Tables<"expenses">;
type Income = Tables<"incomes">;
type Category = Tables<"categories">;
type Wallet = Tables<"wallets">;

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
        .select("*")
        .eq("user_id", user!.id)
        .eq("month", month)
        .eq("year", year)
        .order("created_at");
      if (error) throw error;
      return data as Income[];
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
        .select("*, categories(name, icon, color)")
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
      const { data, error } = await supabase
        .from("wallets")
        .insert({ name: wallet.name, balance: wallet.balance ?? 0, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
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
      toast.success("Carteira removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWalletBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, operation }: { id: string; amount: number; operation: "credit" | "debit" }) => {
      // Get current balance
      const { data: wallet, error: fetchError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("id", id)
        .single();
      if (fetchError) throw fetchError;

      const currentBalance = Number(wallet.balance);
      const newBalance = operation === "credit" ? currentBalance + amount : currentBalance - amount;

      const { error } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      toast.success(vars.operation === "credit" ? "Crédito adicionado" : "Débito registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ========== INCOMES ==========

export function useAddIncome() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (income: Omit<TablesInsert<"incomes">, "user_id">) => {
      const { data, error } = await supabase
        .from("incomes")
        .insert({ ...income, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incomes"] });
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
      const { data, error } = await supabase
        .from("expenses")
        .insert({ ...expense, user_id: user!.id })
        .select("*, categories(name, icon, color)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleExpensePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("expenses").update({ paid }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incomes"] });
      toast.success("Renda removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
