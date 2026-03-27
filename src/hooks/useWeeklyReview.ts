import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────────

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  summary: Record<string, any>;
  highlights: string[];
  lowlights: string[];
  adjustments: string[];
  overall_score: number | null;
  energy_avg: number | null;
  study_hours: number | null;
  workout_count: number | null;
  habits_completion_pct: number | null;
  financial_health: "positive" | "neutral" | "negative" | null;
  created_at: string;
}

// ─── Generation ─────────────────────────────────────────────────

export async function generateWeeklyReview(userId: string): Promise<Omit<WeeklyReview, "id" | "created_at">> {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  // --- Collect data from all modules ---

  // 1. Study hours
  const { data: pomodoroWeek } = await supabase
    .from("pomodoro_sessions")
    .select("total_focus_seconds, subject_id")
    .eq("user_id", userId)
    .gte("session_date", weekStartStr)
    .lte("session_date", weekEndStr);
  const studyHours = Math.round(
    (pomodoroWeek || []).reduce((a: number, p: any) => a + (p.total_focus_seconds || 0), 0) / 3600 * 10
  ) / 10;

  // 2. Workouts
  const { data: workoutsWeek } = await supabase
    .from("fit_workout_logs")
    .select("id")
    .eq("user_id", userId)
    .gte("workout_date", weekStartStr)
    .lte("workout_date", weekEndStr);
  const workoutCount = (workoutsWeek || []).length;

  // 3. Energy
  const { data: energyWeek } = await supabase
    .from("energy_logs")
    .select("energy_level, mental_fatigue, motivation")
    .eq("user_id", userId)
    .gte("created_at", `${weekStartStr}T00:00:00`)
    .lte("created_at", `${weekEndStr}T23:59:59`);
  const energyAvg = energyWeek?.length
    ? Math.round((energyWeek.reduce((a: number, e: any) => a + e.energy_level, 0) / energyWeek.length) * 10) / 10
    : null;

  // 4. Habits
  const { data: habitLogs } = await supabase
    .from("habit_logs")
    .select("id")
    .eq("user_id", userId)
    .gte("log_date", weekStartStr)
    .lte("log_date", weekEndStr);
  const { data: habits } = await supabase
    .from("habits")
    .select("id, frequency")
    .eq("user_id", userId)
    .eq("active", true);
  const expectedLogs = (habits || []).reduce((a: number, h: any) => {
    if (h.frequency === "daily") return a + 7;
    if (h.frequency === "weekdays") return a + 5;
    if (h.frequency === "weekly") return a + 1;
    return a + 7;
  }, 0);
  const habitsCompletionPct = expectedLogs > 0
    ? Math.round(((habitLogs || []).length / expectedLogs) * 100)
    : null;

  // 5. Finances
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const { data: incomes } = await supabase
    .from("incomes").select("amount").eq("user_id", userId).eq("month", month).eq("year", year);
  const { data: expenses } = await supabase
    .from("expenses").select("amount").eq("user_id", userId).eq("month", month).eq("year", year);
  const totalIncome = (incomes || []).reduce((a: number, i: any) => a + Number(i.amount), 0);
  const totalExpense = (expenses || []).reduce((a: number, e: any) => a + Number(e.amount), 0);
  const financialHealth = totalIncome === 0 ? null
    : totalExpense / totalIncome <= 0.7 ? "positive"
    : totalExpense / totalIncome <= 0.9 ? "neutral"
    : "negative";

  // 6. Tasks completed
  const { data: tasksCompleted } = await supabase
    .from("tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "concluida")
    .gte("updated_at", `${weekStartStr}T00:00:00`)
    .lte("updated_at", `${weekEndStr}T23:59:59`);

  // --- Build highlights / lowlights ---
  const highlights: string[] = [];
  const lowlights: string[] = [];

  if (studyHours >= 10) highlights.push(`${studyHours}h de estudo — excelente!`);
  else if (studyHours < 3) lowlights.push(`Apenas ${studyHours}h de estudo`);

  if (workoutCount >= 3) highlights.push(`${workoutCount} treinos realizados`);
  else if (workoutCount === 0) lowlights.push("Nenhum treino na semana");

  if (habitsCompletionPct !== null && habitsCompletionPct >= 80)
    highlights.push(`${habitsCompletionPct}% de hábitos concluídos`);
  else if (habitsCompletionPct !== null && habitsCompletionPct < 50)
    lowlights.push(`Apenas ${habitsCompletionPct}% de hábitos concluídos`);

  if (financialHealth === "positive") highlights.push("Saúde financeira positiva");
  else if (financialHealth === "negative") lowlights.push("Gastos próximos ou acima da renda");

  if ((tasksCompleted || []).length >= 5)
    highlights.push(`${(tasksCompleted || []).length} tarefas concluídas`);

  // --- Auto-score ---
  let score = 5; // Base
  if (studyHours >= 10) score += 1;
  if (studyHours < 3) score -= 1;
  if (workoutCount >= 3) score += 1;
  if (workoutCount === 0) score -= 1;
  if (habitsCompletionPct !== null && habitsCompletionPct >= 80) score += 1;
  if (habitsCompletionPct !== null && habitsCompletionPct < 50) score -= 1;
  if (financialHealth === "positive") score += 0.5;
  if (financialHealth === "negative") score -= 0.5;
  score = Math.max(1, Math.min(10, Math.round(score)));

  return {
    user_id: userId,
    week_start: weekStartStr,
    week_end: weekEndStr,
    summary: {
      study_hours: studyHours,
      workout_count: workoutCount,
      tasks_completed: (tasksCompleted || []).length,
      energy_avg: energyAvg,
      habit_logs_count: (habitLogs || []).length,
    },
    highlights,
    lowlights,
    adjustments: lowlights.length > 0
      ? lowlights.map((l) => `Melhorar: ${l}`)
      : ["Manter o ritmo atual!"],
    overall_score: score,
    energy_avg: energyAvg,
    study_hours: studyHours,
    workout_count: workoutCount,
    habits_completion_pct: habitsCompletionPct,
    financial_health: financialHealth as any,
  };
}

// ─── Hooks ──────────────────────────────────────────────────────

export function useLatestReview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["weekly_review_latest", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", user!.id)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as WeeklyReview | null;
    },
  });
}

export function useReviewHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["weekly_review_history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", user!.id)
        .order("week_start", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data as unknown as WeeklyReview[]) || [];
    },
  });
}

export function useGenerateReview() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const review = await generateWeeklyReview(user.id);

      // Upsert — if review for this week already exists, update it
      const { data: existing } = await supabase
        .from("weekly_reviews")
        .select("id")
        .eq("user_id", user.id)
        .eq("week_start", review.week_start)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("weekly_reviews")
          .update(review as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("weekly_reviews")
          .insert(review as any);
        if (error) throw error;
      }
      return review;
    },
    onSuccess: (review) => {
      qc.invalidateQueries({ queryKey: ["weekly_review_latest"] });
      qc.invalidateQueries({ queryKey: ["weekly_review_history"] });
      toast.success(`📊 Review semanal gerado — Score: ${review.overall_score}/10`);
    },
    onError: () => toast.error("Erro ao gerar review semanal"),
  });
}
