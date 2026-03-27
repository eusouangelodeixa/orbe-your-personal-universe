import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────

export interface EnergyLog {
  id: string;
  user_id: string;
  energy_level: number;
  mental_fatigue: number;
  motivation: number;
  mood: "great" | "good" | "neutral" | "low" | "bad" | null;
  source: "panel" | "whatsapp" | "auto";
  notes: string | null;
  created_at: string;
}

export type EnergyRecommendation = {
  type: "deep_study" | "light_tasks" | "rest" | "exercise" | "review";
  label: string;
  description: string;
  icon: string;
};

// ─── Recommendation Logic ───────────────────────────────────────

export function getEnergyRecommendation(
  energy: number,
  fatigue: number,
  motivation: number
): EnergyRecommendation {
  const score = energy * 0.4 + (6 - fatigue) * 0.35 + motivation * 0.25;

  if (score >= 4) {
    return {
      type: "deep_study",
      label: "Estudo profundo",
      description: "Sua energia está ótima — aproveite para tópicos difíceis e sessões intensivas.",
      icon: "🔥",
    };
  }
  if (score >= 3) {
    return {
      type: "review",
      label: "Revisão e prática",
      description: "Energia moderada — ideal para revisar conteúdos e fazer exercícios.",
      icon: "📝",
    };
  }
  if (score >= 2) {
    return {
      type: "light_tasks",
      label: "Tarefas leves",
      description: "Energia baixa — foque em organização, leituras simples e tarefas administrativas.",
      icon: "📋",
    };
  }
  if (fatigue >= 4 && energy <= 2) {
    return {
      type: "rest",
      label: "Descanso necessário",
      description: "Fadiga alta detectada — descansar agora vai melhorar a performance futura.",
      icon: "😴",
    };
  }
  return {
    type: "exercise",
    label: "Exercício leve",
    description: "Tente uma caminhada ou exercício leve para recuperar energia.",
    icon: "🚶",
  };
}

// ─── Hooks ──────────────────────────────────────────────────────

export function useTodayEnergy() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["energy_today", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("energy_logs")
        .select("*")
        .eq("user_id", user!.id)
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EnergyLog | null;
    },
  });
}

export function useEnergyHistory(days: number = 7) {
  const { user } = useAuth();
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["energy_history", user?.id, days],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("energy_logs")
        .select("*")
        .eq("user_id", user!.id)
        .gte("created_at", `${since}T00:00:00`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as EnergyLog[]) || [];
    },
  });
}

export function useEnergyTrend(days: number = 7) {
  const { data: logs = [] } = useEnergyHistory(days);
  if (!logs.length) return { avgEnergy: 0, avgFatigue: 0, avgMotivation: 0, trend: "stable" as const };

  const avgEnergy = logs.reduce((a, l) => a + l.energy_level, 0) / logs.length;
  const avgFatigue = logs.reduce((a, l) => a + l.mental_fatigue, 0) / logs.length;
  const avgMotivation = logs.reduce((a, l) => a + l.motivation, 0) / logs.length;

  // Trend: compare first half vs second half
  const mid = Math.floor(logs.length / 2);
  const firstHalf = logs.slice(0, mid);
  const secondHalf = logs.slice(mid);
  const firstAvg = firstHalf.length ? firstHalf.reduce((a, l) => a + l.energy_level, 0) / firstHalf.length : 0;
  const secondAvg = secondHalf.length ? secondHalf.reduce((a, l) => a + l.energy_level, 0) / secondHalf.length : 0;
  const trend = secondAvg - firstAvg > 0.3 ? "rising" as const
    : secondAvg - firstAvg < -0.3 ? "falling" as const
    : "stable" as const;

  return {
    avgEnergy: Math.round(avgEnergy * 10) / 10,
    avgFatigue: Math.round(avgFatigue * 10) / 10,
    avgMotivation: Math.round(avgMotivation * 10) / 10,
    trend,
  };
}

export function useLogEnergy() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Pick<EnergyLog, "energy_level" | "mental_fatigue" | "motivation" | "mood" | "notes"> & { source?: string }
    ) => {
      const { data, error } = await supabase
        .from("energy_logs")
        .insert({ ...payload, user_id: user!.id, source: payload.source || "panel" } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EnergyLog;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["energy_today"] });
      qc.invalidateQueries({ queryKey: ["energy_history"] });
      toast.success("⚡ Energia registrada!");
    },
    onError: () => toast.error("Erro ao registrar energia"),
  });
}
