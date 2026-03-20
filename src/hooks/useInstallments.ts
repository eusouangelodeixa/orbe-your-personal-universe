import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Installment {
  id: string;
  user_id: string;
  name: string;
  total_amount: number;
  installment_count: number;
  current_installment: number;
  installment_amount: number;
  category_id: string | null;
  wallet_id: string | null;
  start_date: string;
  day_of_month: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useInstallments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["installments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as Installment[];
    },
  });
}

export function useAddInstallment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (inst: Omit<Installment, "id" | "user_id" | "created_at" | "updated_at" | "current_installment" | "status">) => {
      const { error } = await supabase.from("installments" as any).insert({
        ...inst,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installments"] });
      toast.success("Parcelamento criado!");
    },
    onError: () => toast.error("Erro ao criar parcelamento"),
  });
}

export function useUpdateInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Installment> & { id: string }) => {
      const { error } = await supabase.from("installments" as any).update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installments"] });
      toast.success("Parcelamento atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });
}

export function useDeleteInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("installments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installments"] });
      toast.success("Parcelamento removido!");
    },
  });
}
