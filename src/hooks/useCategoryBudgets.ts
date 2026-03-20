import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CategoryBudget {
  id: string;
  user_id: string;
  category_id: string;
  month: number;
  year: number;
  budget_limit: number;
  alert_threshold: number;
  created_at: string;
  updated_at: string;
}

export function useCategoryBudgets(month: number, year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["category_budgets", user?.id, month, year],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_budgets" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return (data as any[]) as CategoryBudget[];
    },
  });
}

export function useUpsertCategoryBudget() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (budget: { category_id: string; month: number; year: number; budget_limit: number; alert_threshold?: number }) => {
      // Check if exists
      const { data: existing } = await supabase
        .from("category_budgets" as any)
        .select("id")
        .eq("user_id", user!.id)
        .eq("category_id", budget.category_id)
        .eq("month", budget.month)
        .eq("year", budget.year)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("category_budgets" as any).update({
          budget_limit: budget.budget_limit,
          alert_threshold: budget.alert_threshold || 80,
        } as any).eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("category_budgets" as any).insert({
          user_id: user!.id,
          ...budget,
          alert_threshold: budget.alert_threshold || 80,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category_budgets"] });
      toast.success("Orçamento salvo!");
    },
    onError: () => toast.error("Erro ao salvar orçamento"),
  });
}

export function useDeleteCategoryBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("category_budgets" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category_budgets"] });
      toast.success("Orçamento removido");
    },
  });
}
