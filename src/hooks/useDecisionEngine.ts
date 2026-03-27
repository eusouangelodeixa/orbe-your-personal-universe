import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import { getEnergyRecommendation } from "./useEnergy";

// ─── Types ──────────────────────────────────────────────────────

export interface DailyRecommendation {
  id: string;
  user_id: string;
  recommendation_date: string;
  energy_snapshot: Record<string, any>;
  context_snapshot: Record<string, any>;
  recommendations: RecommendationItem[];
  applied: boolean;
  feedback: "helpful" | "neutral" | "not_helpful" | null;
  created_at: string;
}

export interface RecommendationItem {
  type: "study" | "exercise" | "rest" | "finance" | "task" | "social";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  reason: string;
  icon: string;
}

// ─── Decision Engine ────────────────────────────────────────────

export async function generateDailyRecommendation(userId: string): Promise<Omit<DailyRecommendation, "id" | "created_at">> {
  const today = format(new Date(), "yyyy-MM-dd");

  // 1. Energy snapshot
  const { data: todayEnergy } = await supabase
    .from("energy_logs")
    .select("energy_level, mental_fatigue, motivation, mood")
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const energy = (todayEnergy as any)?.energy_level ?? 3;
  const fatigue = (todayEnergy as any)?.mental_fatigue ?? 3;
  const motivation = (todayEnergy as any)?.motivation ?? 3;
  const energyRec = getEnergyRecommendation(energy, fatigue, motivation);

  // 2. Academic context
  const { data: upcomingExams } = await supabase
    .from("academic_events")
    .select("title, event_date, subject_id")
    .eq("user_id", userId)
    .eq("type", "prova")
    .in("status", ["pendente", "em_andamento"])
    .gte("event_date", today)
    .order("event_date")
    .limit(3);

  const examsIn3Days = (upcomingExams || []).filter(
    (e: any) => differenceInDays(parseISO(e.event_date), new Date()) <= 3
  );

  // 3. Workout context
  const { data: todayWorkout } = await supabase
    .from("fit_workout_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("workout_date", today)
    .maybeSingle();

  // 4. Tasks due today
  const { data: tasksDue } = await supabase
    .from("tasks")
    .select("title, priority")
    .eq("user_id", userId)
    .eq("due_date", today)
    .in("status", ["pendente", "em_andamento"]);

  // 5. Goals with urgency
  const { data: urgentGoals } = await supabase
    .from("goals")
    .select("title, deadline, priority")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("priority", { ascending: false })
    .limit(3);

  // --- Build recommendations ---
  const recommendations: RecommendationItem[] = [];

  // Energy-based primary recommendation
  recommendations.push({
    type: energyRec.type === "deep_study" || energyRec.type === "review" ? "study" : energyRec.type === "exercise" ? "exercise" : "rest",
    priority: "high",
    title: energyRec.label,
    description: energyRec.description,
    reason: `Energia: ${energy}/5 | Fadiga: ${fatigue}/5 | Motivação: ${motivation}/5`,
    icon: energyRec.icon,
  });

  // Exam urgency
  if (examsIn3Days.length > 0) {
    recommendations.push({
      type: "study",
      priority: "high",
      title: `Prova em ${differenceInDays(parseISO(examsIn3Days[0].event_date), new Date())} dia(s)`,
      description: `Foco em: ${examsIn3Days.map((e: any) => e.title).join(", ")}`,
      reason: "Proximidade de avaliação detectada",
      icon: "📝",
    });

    // If tired but exam is close, override rest
    if (energy <= 2 && examsIn3Days.length > 0) {
      recommendations.push({
        type: "study",
        priority: "medium",
        title: "Estudo leve de revisão",
        description: "Energia baixa, mas prova próxima — faça apenas revisão e flashcards, sem aprofundar",
        reason: "Equilíbrio entre descanso e urgência",
        icon: "🔄",
      });
    }
  }

  // Workout recommendation
  if (!todayWorkout && energy >= 3) {
    recommendations.push({
      type: "exercise",
      priority: "medium",
      title: "Treinar hoje",
      description: energy >= 4
        ? "Energia alta — aproveite para um treino intenso"
        : "Energia moderada — treino leve ou caminhada",
      reason: "Nenhum treino registrado hoje",
      icon: "💪",
    });
  } else if (!todayWorkout && energy < 3) {
    recommendations.push({
      type: "exercise",
      priority: "low",
      title: "Caminhada leve",
      description: "Energia baixa — exercício leve pode ajudar a recuperar",
      reason: "Atividade física leve melhora humor e energia",
      icon: "🚶",
    });
  }

  // Task reminders
  const highTasks = (tasksDue || []).filter((t: any) => t.priority === "alta");
  if (highTasks.length > 0) {
    recommendations.push({
      type: "task",
      priority: "high",
      title: `${highTasks.length} tarefa(s) urgente(s) para hoje`,
      description: highTasks.map((t: any) => t.title).join(", "),
      reason: "Tarefas com prioridade alta vencem hoje",
      icon: "📌",
    });
  }

  // Goal nudge
  const topGoal = (urgentGoals as any[] || [])[0];
  if (topGoal?.deadline) {
    const daysLeft = differenceInDays(parseISO(topGoal.deadline), new Date());
    if (daysLeft <= 7) {
      recommendations.push({
        type: "task",
        priority: "medium",
        title: `Meta "${topGoal.title}" vence em ${daysLeft} dias`,
        description: "Verifique os marcos pendentes dessa meta",
        reason: "Norte: meta estratégica com prazo próximo",
        icon: "🧭",
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    user_id: userId,
    recommendation_date: today,
    energy_snapshot: { energy, fatigue, motivation, mood: (todayEnergy as any)?.mood },
    context_snapshot: {
      exams_in_3_days: examsIn3Days.length,
      has_workout_today: !!todayWorkout,
      tasks_due: (tasksDue || []).length,
      urgent_goals: (urgentGoals || []).length,
    },
    recommendations,
    applied: false,
    feedback: null,
  };
}

// ─── Hooks ──────────────────────────────────────────────────────

export function useTodayRecommendation() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["daily_recommendation", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_recommendations")
        .select("*")
        .eq("user_id", user!.id)
        .eq("recommendation_date", today)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DailyRecommendation | null;
    },
  });
}

export function useGenerateRecommendation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const rec = await generateDailyRecommendation(user.id);

      // Upsert for today
      const { data: existing } = await supabase
        .from("daily_recommendations")
        .select("id")
        .eq("user_id", user.id)
        .eq("recommendation_date", rec.recommendation_date)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("daily_recommendations")
          .update(rec as any)
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("daily_recommendations")
          .insert(rec as any);
      }
      return rec;
    },
    onSuccess: (rec) => {
      qc.invalidateQueries({ queryKey: ["daily_recommendation"] });
      toast.success(`🧭 ${rec.recommendations.length} recomendações geradas para hoje`);
    },
    onError: () => toast.error("Erro ao gerar recomendações"),
  });
}

export function useGiveFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: "helpful" | "neutral" | "not_helpful" }) => {
      const { error } = await supabase
        .from("daily_recommendations")
        .update({ feedback, applied: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_recommendation"] });
      toast.success("Feedback registrado — o motor vai melhorar");
    },
  });
}
