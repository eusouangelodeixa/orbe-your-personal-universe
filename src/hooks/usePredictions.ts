import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subDays, differenceInDays, parseISO } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────

export interface Prediction {
  id: string;
  user_id: string;
  prediction_type: "academic_risk" | "financial_risk" | "fatigue" | "burnout" | "consistency_drop";
  risk_level: "low" | "medium" | "high" | "critical";
  title: string;
  details: Record<string, any>;
  suggested_action: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

const RISK_META = {
  academic_risk: { label: "Risco Acadêmico", icon: "📚" },
  financial_risk: { label: "Risco Financeiro", icon: "💰" },
  fatigue: { label: "Fadiga", icon: "😴" },
  burnout: { label: "Burnout", icon: "🔥" },
  consistency_drop: { label: "Queda de Consistência", icon: "📉" },
};

// ─── Analysis Functions ─────────────────────────────────────────

export async function analyzeAcademicRisk(userId: string): Promise<Prediction | null> {
  // Check: low study frequency + upcoming exams
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
  const { data: pomodoroWeek } = await supabase
    .from("pomodoro_sessions")
    .select("total_focus_seconds")
    .eq("user_id", userId)
    .gte("session_date", weekAgo);

  const totalHours = (pomodoroWeek || []).reduce(
    (a: number, p: any) => a + (p.total_focus_seconds || 0) / 3600, 0
  );

  const { data: upcomingExams } = await supabase
    .from("academic_events")
    .select("title, event_date")
    .eq("user_id", userId)
    .eq("type", "prova")
    .in("status", ["pendente", "em_andamento"])
    .gte("event_date", format(new Date(), "yyyy-MM-dd"))
    .order("event_date")
    .limit(5);

  const examsIn7Days = (upcomingExams || []).filter(
    (e: any) => differenceInDays(parseISO(e.event_date), new Date()) <= 7
  );

  if (examsIn7Days.length > 0 && totalHours < 5) {
    const riskLevel = totalHours < 2 ? "critical" : totalHours < 4 ? "high" : "medium";
    return {
      id: "",
      user_id: userId,
      prediction_type: "academic_risk",
      risk_level: riskLevel as any,
      title: `Prova em ${differenceInDays(parseISO(examsIn7Days[0].event_date), new Date())} dias com apenas ${Math.round(totalHours)}h de estudo na semana`,
      details: {
        study_hours_week: Math.round(totalHours * 10) / 10,
        upcoming_exams: examsIn7Days.map((e: any) => e.title),
        days_until_exam: differenceInDays(parseISO(examsIn7Days[0].event_date), new Date()),
      },
      suggested_action: "Crie uma sessão intensiva focada nos tópicos da prova",
      resolved: false,
      resolved_at: null,
      created_at: new Date().toISOString(),
    };
  }
  return null;
}

export async function analyzeFinancialRisk(userId: string): Promise<Prediction | null> {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  const { data: incomes } = await supabase
    .from("incomes")
    .select("amount")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year);

  const totalIncome = (incomes || []).reduce((a: number, i: any) => a + Number(i.amount), 0);
  const totalExpense = (expenses || []).reduce((a: number, e: any) => a + Number(e.amount), 0);

  if (totalIncome > 0 && totalExpense / totalIncome > 0.9) {
    const ratio = Math.round((totalExpense / totalIncome) * 100);
    const riskLevel = ratio >= 100 ? "critical" : ratio >= 95 ? "high" : "medium";
    return {
      id: "",
      user_id: userId,
      prediction_type: "financial_risk",
      risk_level: riskLevel as any,
      title: `Gastos representam ${ratio}% da renda mensal`,
      details: { total_income: totalIncome, total_expense: totalExpense, ratio },
      suggested_action: ratio >= 100
        ? "Gastos excedem a renda — revise despesas não essenciais urgentemente"
        : "Margem financeira muito apertada — considere reduzir gastos variáveis",
      resolved: false,
      resolved_at: null,
      created_at: new Date().toISOString(),
    };
  }
  return null;
}

export async function analyzeFatigueRisk(userId: string): Promise<Prediction | null> {
  const threeDaysAgo = format(subDays(new Date(), 3), "yyyy-MM-dd");
  const { data: energyLogs } = await supabase
    .from("energy_logs")
    .select("energy_level, mental_fatigue")
    .eq("user_id", userId)
    .gte("created_at", `${threeDaysAgo}T00:00:00`)
    .order("created_at", { ascending: false });

  if (!energyLogs?.length || energyLogs.length < 2) return null;

  const avgEnergy = energyLogs.reduce((a: number, l: any) => a + l.energy_level, 0) / energyLogs.length;
  const avgFatigue = energyLogs.reduce((a: number, l: any) => a + l.mental_fatigue, 0) / energyLogs.length;

  if (avgEnergy <= 2 && avgFatigue >= 4) {
    return {
      id: "",
      user_id: userId,
      prediction_type: "fatigue",
      risk_level: avgEnergy <= 1.5 ? "critical" : "high",
      title: `Energia média de ${avgEnergy.toFixed(1)}/5 com fadiga de ${avgFatigue.toFixed(1)}/5 nos últimos 3 dias`,
      details: { avg_energy: avgEnergy, avg_fatigue: avgFatigue, log_count: energyLogs.length },
      suggested_action: "Reduza a carga de estudo e treino — priorize sono e recuperação",
      resolved: false,
      resolved_at: null,
      created_at: new Date().toISOString(),
    };
  }
  return null;
}

// ─── Run All Analyses ───────────────────────────────────────────

export async function runPredictionAnalysis(userId: string): Promise<Prediction[]> {
  const results = await Promise.all([
    analyzeAcademicRisk(userId),
    analyzeFinancialRisk(userId),
    analyzeFatigueRisk(userId),
  ]);

  const predictions = results.filter(Boolean) as Prediction[];

  // Save new predictions (avoid duplicates for same type on same day)
  const today = format(new Date(), "yyyy-MM-dd");
  for (const pred of predictions) {
    const { data: existing } = await supabase
      .from("predictions")
      .select("id")
      .eq("user_id", userId)
      .eq("prediction_type", pred.prediction_type)
      .eq("resolved", false)
      .gte("created_at", `${today}T00:00:00`)
      .maybeSingle();

    if (!existing) {
      await supabase.from("predictions").insert({
        user_id: userId,
        prediction_type: pred.prediction_type,
        risk_level: pred.risk_level,
        title: pred.title,
        details: pred.details,
        suggested_action: pred.suggested_action,
      } as any);
    }
  }

  return predictions;
}

// ─── Hooks ──────────────────────────────────────────────────────

export function useActivePredictions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["predictions_active", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Prediction[]) || [];
    },
  });
}

export function useRunAnalysis() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      return runPredictionAnalysis(user.id);
    },
    onSuccess: (preds) => {
      qc.invalidateQueries({ queryKey: ["predictions_active"] });
      if (preds.length) {
        toast.warning(`⚠️ ${preds.length} alerta(s) detectado(s)`, {
          description: preds.map((p) => p.title).join(" | "),
        });
      } else {
        toast.success("✅ Nenhum risco detectado — tudo sob controle!");
      }
    },
  });
}

export function useResolvePrediction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("predictions")
        .update({ resolved: true, resolved_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions_active"] });
      toast.success("Alerta resolvido");
    },
  });
}

export { RISK_META };
