import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  record_date: string;
  notes: string | null;
  created_at: string;
}

export function usePersonalRecords(exerciseName?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["personal_records", user?.id, exerciseName],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("fit_personal_records" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("record_date", { ascending: false });
      if (exerciseName) q = q.eq("exercise_name", exerciseName);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as PersonalRecord[];
    },
  });
}

export function useAddPersonalRecord() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (pr: { exercise_name: string; weight: number; reps: number; notes?: string }) => {
      const { error } = await supabase.from("fit_personal_records" as any).insert({
        ...pr,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal_records"] });
      toast.success("PR registrado! 🏆");
    },
    onError: () => toast.error("Erro ao salvar PR"),
  });
}

export function useDeletePersonalRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fit_personal_records" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal_records"] });
      toast.success("PR removido");
    },
  });
}
