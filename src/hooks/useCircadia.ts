import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subDays, parseISO, differenceInMinutes, differenceInDays } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────

export interface CircadianProfile {
  id: string;
  user_id: string;
  target_sleep_time: string;   // HH:MM
  target_wake_time: string;    // HH:MM
  sleep_latency_estimate: number;
  wake_difficulty: number;
  flex_window_minutes: number;
  screen_usage: "low" | "medium" | "high";
  caffeine_usage: boolean;
  caffeine_cutoff: string | null;
  objective: "wake_early" | "regular_routine" | "cognitive_performance";
  consistency_level: "irregular" | "somewhat" | "consistent";
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SleepSession {
  id: string;
  user_id: string;
  session_date: string;
  planned_sleep: string;
  planned_wake: string;
  actual_wake: string | null;
  wake_confirmed: boolean;
  wake_method: "link" | "whatsapp" | "manual" | null;
  deviation_minutes: number | null;
  score: number | null;
  notes: string | null;
  created_at: string;
}

export interface CircadianInsight {
  id: string;
  user_id: string;
  insight_type: string;
  message: string;
  data: Record<string, any>;
  acknowledged: boolean;
  created_at: string;
}

export interface CircadianAdjustment {
  id: string;
  user_id: string;
  adjustment_type: string;
  current_value: string;
  suggested_value: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

// ─── Score Algorithm ────────────────────────────────────────────

export function computeCircadianScore(
  deviationMinutes: number,
  flexWindow: number,
  wakeDifficulty: number
): number {
  // Base: 100
  // Deduct based on deviation vs flex window
  const absDeviation = Math.abs(deviationMinutes);
  let score = 100;

  if (absDeviation <= flexWindow) {
    // Within flex → mild penalty
    score -= (absDeviation / flexWindow) * 15;
  } else if (absDeviation <= flexWindow * 2) {
    // 1x-2x flex → moderate penalty
    score -= 15 + ((absDeviation - flexWindow) / flexWindow) * 25;
  } else {
    // Beyond 2x flex → heavy penalty
    score -= 40 + Math.min(40, (absDeviation - flexWindow * 2) / 10 * 5);
  }

  // Wake difficulty bonus: easier wakers get less margin
  if (wakeDifficulty >= 4) score += 5; // hard wakers get a small boost for showing up
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Pattern Detection ─────────────────────────────────────────

export function detectPatterns(sessions: SleepSession[]): {
  avgDeviation: number;
  consistencyPct: number;
  streakDays: number;
  recurring_delays: string[];
} {
  if (!sessions.length) return { avgDeviation: 0, consistencyPct: 0, streakDays: 0, recurring_delays: [] };

  const confirmed = sessions.filter((s) => s.wake_confirmed);
  const avgDeviation = confirmed.length
    ? Math.round(confirmed.reduce((a, s) => a + Math.abs(s.deviation_minutes || 0), 0) / confirmed.length)
    : 0;

  const withinFlex = confirmed.filter((s) => Math.abs(s.deviation_minutes || 0) <= 20);
  const consistencyPct = confirmed.length
    ? Math.round((withinFlex.length / confirmed.length) * 100)
    : 0;

  // Streak: consecutive confirmed days
  let streakDays = 0;
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  );
  for (const s of sorted) {
    if (s.wake_confirmed) streakDays++;
    else break;
  }

  // Recurring delays by day of week
  const dayDelays: Record<string, number[]> = {};
  const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  for (const s of confirmed) {
    const day = WEEKDAYS[new Date(s.session_date).getDay()];
    if (!dayDelays[day]) dayDelays[day] = [];
    dayDelays[day].push(s.deviation_minutes || 0);
  }
  const recurring_delays: string[] = [];
  for (const [day, devs] of Object.entries(dayDelays)) {
    const avg = devs.reduce((a, d) => a + d, 0) / devs.length;
    if (avg > 20 && devs.length >= 2) {
      recurring_delays.push(day);
    }
  }

  return { avgDeviation, consistencyPct, streakDays, recurring_delays };
}

// ─── Hooks ──────────────────────────────────────────────────────

export function useCircadianProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["circadian_profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circadian_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CircadianProfile | null;
    },
  });
}

export function useSaveCircadianProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<CircadianProfile> & { onboarding_completed?: boolean }
    ) => {
      // Upsert
      const { data: existing } = await supabase
        .from("circadian_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("circadian_profiles")
          .update({ ...payload, updated_at: new Date().toISOString() } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("circadian_profiles")
          .insert({ ...payload, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circadian_profile"] });
      toast.success("🌙 Perfil circadiano salvo!");
    },
    onError: () => toast.error("Erro ao salvar perfil"),
  });
}

export function useTodaySession() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["sleep_session_today", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sleep_sessions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("session_date", today)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SleepSession | null;
    },
  });
}

export function useSleepHistory(days: number = 30) {
  const { user } = useAuth();
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["sleep_history", user?.id, days],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sleep_sessions")
        .select("*")
        .eq("user_id", user!.id)
        .gte("session_date", since)
        .order("session_date", { ascending: true });
      if (error) throw error;
      return (data as unknown as SleepSession[]) || [];
    },
  });
}

export function useConfirmWake() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const now = new Date();
      // Get session to compute deviation
      const { data: session } = await supabase
        .from("sleep_sessions")
        .select("planned_wake, id")
        .eq("id", sessionId)
        .single();
      if (!session) throw new Error("Session not found");

      const plannedWake = new Date((session as any).planned_wake);
      const deviation = differenceInMinutes(now, plannedWake);

      // Get profile for score
      const { data: profile } = await supabase
        .from("circadian_profiles")
        .select("flex_window_minutes, wake_difficulty")
        .eq("user_id", user!.id)
        .single();

      const score = profile
        ? computeCircadianScore(deviation, (profile as any).flex_window_minutes, (profile as any).wake_difficulty)
        : computeCircadianScore(deviation, 15, 3);

      // Update session
      const { error } = await supabase
        .from("sleep_sessions")
        .update({
          actual_wake: now.toISOString(),
          wake_confirmed: true,
          wake_method: "link",
          deviation_minutes: deviation,
          score,
        } as any)
        .eq("id", sessionId);
      if (error) throw error;

      // Emit event
      await supabase.from("circadian_events").insert({
        user_id: user!.id,
        event_type: "wake_confirmed",
        payload: { session_id: sessionId, deviation, score, confirmed_at: now.toISOString() },
      } as any);

      return { deviation, score };
    },
    onSuccess: ({ score }) => {
      qc.invalidateQueries({ queryKey: ["sleep_session_today"] });
      qc.invalidateQueries({ queryKey: ["sleep_history"] });
      toast.success(`☀️ Despertar confirmado! Score: ${score}/100`);
    },
    onError: () => toast.error("Erro ao confirmar despertar"),
  });
}

export function useCreateTodaySession() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Get profile
      const { data: profile } = await supabase
        .from("circadian_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (!profile) throw new Error("No circadian profile");

      const p = profile as any;
      const today = format(new Date(), "yyyy-MM-dd");

      // Build planned times
      const plannedSleep = `${today}T${p.target_sleep_time}:00`;
      const tomorrow = format(new Date(new Date().setDate(new Date().getDate() + 1)), "yyyy-MM-dd");
      const plannedWake = `${tomorrow}T${p.target_wake_time}:00`;

      const { error } = await supabase
        .from("sleep_sessions")
        .insert({
          user_id: user!.id,
          session_date: today,
          planned_sleep: plannedSleep,
          planned_wake: plannedWake,
        } as any);
      if (error && error.code !== "23505") throw error; // ignore duplicate
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sleep_session_today"] });
    },
  });
}

export function useCircadianScore(days: number = 7) {
  const { data: sessions = [] } = useSleepHistory(days);
  const confirmed = sessions.filter((s) => s.wake_confirmed && s.score != null);
  if (!confirmed.length) return { avgScore: 0, streak: 0, pattern: null };

  const avgScore = Math.round(confirmed.reduce((a, s) => a + (s.score || 0), 0) / confirmed.length);
  const pattern = detectPatterns(sessions);

  return { avgScore, streak: pattern.streakDays, pattern };
}

export function useCircadianInsights() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["circadian_insights", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circadian_insights")
        .select("*")
        .eq("user_id", user!.id)
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data as unknown as CircadianInsight[]) || [];
    },
  });
}

export function useAcknowledgeInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("circadian_insights")
        .update({ acknowledged: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circadian_insights"] }),
  });
}

export function useCircadianAdjustments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["circadian_adjustments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circadian_adjustments")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as CircadianAdjustment[]) || [];
    },
  });
}

export function useRespondAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase
        .from("circadian_adjustments")
        .update({ status: accept ? "accepted" : "rejected" } as any)
        .eq("id", id);
      if (error) throw error;

      if (accept) {
        // If accepted, we need to update the profile — done separately
        const { data: adj } = await supabase
          .from("circadian_adjustments")
          .select("user_id, adjustment_type, suggested_value")
          .eq("id", id)
          .single();
        if (adj) {
          const a = adj as any;
          const updatePayload: Record<string, any> = {};
          if (a.adjustment_type === "wake_time") updatePayload.target_wake_time = a.suggested_value;
          if (a.adjustment_type === "sleep_time") updatePayload.target_sleep_time = a.suggested_value;
          if (a.adjustment_type === "flex_window") updatePayload.flex_window_minutes = parseInt(a.suggested_value);
          if (Object.keys(updatePayload).length) {
            await supabase
              .from("circadian_profiles")
              .update({ ...updatePayload, updated_at: new Date().toISOString() } as any)
              .eq("user_id", a.user_id);
          }
        }
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["circadian_adjustments"] });
      qc.invalidateQueries({ queryKey: ["circadian_profile"] });
      toast.success(vars.accept ? "✅ Ajuste aplicado ao perfil" : "❌ Ajuste rejeitado");
    },
  });
}

/** Generate insights from recent sessions */
export async function generateCircadianInsights(userId: string, sessions: SleepSession[], profile: CircadianProfile) {
  const pattern = detectPatterns(sessions);
  const insights: Array<{ insight_type: string; message: string; data: Record<string, any> }> = [];
  const adjustments: Array<{ adjustment_type: string; current_value: string; suggested_value: string; reason: string }> = [];

  // Recurring delays
  if (pattern.recurring_delays.length > 0) {
    insights.push({
      insight_type: "recurring_delay",
      message: `Seu padrão indica atraso recorrente ${pattern.recurring_delays.length > 1 ? "nas" : "na"} ${pattern.recurring_delays.join(", ")}`,
      data: { days: pattern.recurring_delays, avg_deviation: pattern.avgDeviation },
    });
  }

  // Consistently late → suggest adjusting wake time
  const confirmedRecent = sessions.filter((s) => s.wake_confirmed).slice(-5);
  if (confirmedRecent.length >= 5) {
    const avgDev = confirmedRecent.reduce((a, s) => a + (s.deviation_minutes || 0), 0) / confirmedRecent.length;
    if (avgDev > 20) {
      const currentWake = profile.target_wake_time;
      const [h, m] = currentWake.split(":").map(Number);
      const newMinutes = h * 60 + m + Math.round(avgDev / 2);
      const newH = Math.floor(newMinutes / 60).toString().padStart(2, "0");
      const newM = (newMinutes % 60).toString().padStart(2, "0");
      adjustments.push({
        adjustment_type: "wake_time",
        current_value: currentWake,
        suggested_value: `${newH}:${newM}`,
        reason: `Atraso médio de ${Math.round(avgDev)}min nos últimos 5 dias. Sugiro ajustar +${Math.round(avgDev / 2)}min`,
      });
    }
  }

  // High variance → increase flex window
  if (confirmedRecent.length >= 5) {
    const deviations = confirmedRecent.map((s) => s.deviation_minutes || 0);
    const mean = deviations.reduce((a, d) => a + d, 0) / deviations.length;
    const variance = deviations.reduce((a, d) => a + Math.pow(d - mean, 2), 0) / deviations.length;
    if (Math.sqrt(variance) > 30 && profile.flex_window_minutes < 30) {
      adjustments.push({
        adjustment_type: "flex_window",
        current_value: String(profile.flex_window_minutes),
        suggested_value: String(Math.min(30, profile.flex_window_minutes + 10)),
        reason: "Variância alta detectada — aumentar janela de flexibilidade pode melhorar o score",
      });
    }
  }

  // Good consistency → tighten tolerance
  if (pattern.consistencyPct >= 90 && profile.flex_window_minutes > 10 && confirmedRecent.length >= 7) {
    insights.push({
      insight_type: "high_consistency",
      message: `Excelente! ${pattern.consistencyPct}% de consistência. Seu ritmo está estável.`,
      data: { consistency_pct: pattern.consistencyPct, streak: pattern.streakDays },
    });
  }

  // Save insights
  for (const ins of insights) {
    const { data: existing } = await supabase
      .from("circadian_insights")
      .select("id")
      .eq("user_id", userId)
      .eq("insight_type", ins.insight_type)
      .eq("acknowledged", false)
      .maybeSingle();
    if (!existing) {
      await supabase.from("circadian_insights").insert({ ...ins, user_id: userId } as any);
    }
  }

  // Save adjustments
  for (const adj of adjustments) {
    const { data: existing } = await supabase
      .from("circadian_adjustments")
      .select("id")
      .eq("user_id", userId)
      .eq("adjustment_type", adj.adjustment_type)
      .eq("status", "pending")
      .maybeSingle();
    if (!existing) {
      await supabase.from("circadian_adjustments").insert({ ...adj, user_id: userId } as any);
    }
  }

  return { insights, adjustments };
}

export function useDeleteCircadianProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("circadian_profiles").delete().eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circadian_profile"] });
      toast.success("Perfil circadiano excluído!");
    },
    onError: () => toast.error("Erro ao excluir perfil"),
  });
}
