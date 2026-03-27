import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Wallet, GraduationCap, Dumbbell, TrendingUp, TrendingDown,
  ArrowUpCircle, ArrowDownCircle, AlertTriangle, CalendarDays,
  CheckSquare, Loader2, Brain, Timer
} from "lucide-react";
import { useIncomes, useExpenses, useWallets } from "@/hooks/useFinance";
import { useSubjects, useAcademicEvents } from "@/hooks/useStudies";
import { useDueFlashcards } from "@/hooks/useFlashcards";
import { useCurrency, SUPPORTED_CURRENCIES } from "@/contexts/CurrencyContext";
import { useExchangeRates, convertToBRL } from "@/hooks/useExchangeRates";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isAfter, isBefore, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DailyRecommendation } from "@/components/decision/DailyRecommendation";
import { PredictionAlerts } from "@/components/predictions/PredictionAlerts";
import { EnergyCheckIn } from "@/components/energy/EnergyCheckIn";

export default function UnifiedDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatMoney, currency } = useCurrency();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Finance data
  const { data: incomes = [], isLoading: li } = useIncomes(month, year);
  const { data: expenses = [], isLoading: le } = useExpenses(month, year);
  const { data: wallets = [], isLoading: lw } = useWallets();

  // Exchange rates
  const requiredCurrencies = [...new Set(wallets.map((w: any) => w.currency || "BRL").filter((c: string) => c !== "BRL"))] as string[];
  const { data: exchangeRates } = useExchangeRates(requiredCurrencies.length > 0 ? requiredCurrencies : undefined);

  const toSystemCurrency = (amount: number, fromCurrency: string): number => {
    const sysCur = currency.code;
    if (fromCurrency === sysCur) return amount;
    const inBRL = convertToBRL(amount, fromCurrency, exchangeRates?.rates);
    if (sysCur === "BRL") return inBRL;
    const sysRate = exchangeRates?.rates?.[sysCur];
    if (!sysRate || sysRate === 0) return inBRL;
    return inBRL * sysRate;
  };

  const getWalletCurrency = (walletId?: string | null): string => {
    if (!walletId) return "BRL";
    const w = wallets.find((w) => w.id === walletId);
    return (w as any)?.currency || "BRL";
  };

  const convertItem = (amount: number, walletId?: string | null): number =>
    toSystemCurrency(amount, getWalletCurrency(walletId));

  const renda = incomes.reduce((a, i) => a + convertItem(Number(i.amount), i.wallet_id), 0);
  const totalGastos = expenses.reduce((a, e) => a + convertItem(Number(e.amount), e.wallet_id), 0);
  const fluxo = renda - totalGastos;
  const totalCarteiras = wallets.reduce((a, w) => a + toSystemCurrency(Number(w.balance), (w as any).currency || "BRL"), 0);

  // Studies data
  const { data: subjects = [] } = useSubjects();
  const { data: allEvents = [] } = useAcademicEvents();
  const { data: dueFlashcards = [] } = useDueFlashcards();
  const pendingEvents = allEvents.filter(ev => ev.status === "pendente" || ev.status === "em_andamento");
  const upcomingEvents = pendingEvents.filter(ev => isAfter(parseISO(ev.event_date), now) && isBefore(parseISO(ev.event_date), addDays(now, 7)));

  // Pomodoro today
  const today = now.toISOString().split("T")[0];
  const { data: pomodoroToday = [] } = useQuery({
    queryKey: ["pomodoro_today_unified", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("pomodoro_sessions").select("*").eq("user_id", user!.id).eq("session_date", today);
      return (data as any[]) || [];
    },
  });
  const totalFocusMin = pomodoroToday.reduce((a: number, p: any) => a + Math.floor(p.total_focus_seconds / 60), 0);

  // Fit data
  const { data: fitProfile } = useQuery({
    queryKey: ["fit_profile_unified", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("fit_profiles" as any).select("*").eq("user_id", user!.id).maybeSingle();
      return data as any;
    },
  });
  const { data: recentWorkouts = [] } = useQuery({
    queryKey: ["recent_workouts_unified", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("fit_workout_logs" as any).select("*").eq("user_id", user!.id).order("workout_date", { ascending: false }).limit(5);
      return (data as any[]) || [];
    },
  });

  // Tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks_unified", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("user_id", user!.id).neq("status", "concluida").order("due_date").limit(5);
      return (data as any[]) || [];
    },
  });

  const isLoading = li || le || lw;
  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Visão Geral</h1>
          <p className="text-muted-foreground">Resumo consolidado de tudo</p>
        </div>

        {/* Finance Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-primary cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/dashboard")}>
            <CardHeader className="pb-1"><CardTitle className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Renda</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold font-display text-primary">{formatMoney(renda)}</p></CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/dashboard")}>
            <CardHeader className="pb-1"><CardTitle className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Gastos</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold font-display text-destructive">{formatMoney(totalGastos)}</p></CardContent>
          </Card>
          <Card className={`border-l-4 ${fluxo >= 0 ? "border-l-primary" : "border-l-destructive"} cursor-pointer hover:bg-accent/50 transition-colors`} onClick={() => navigate("/dashboard")}>
            <CardHeader className="pb-1"><CardTitle className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Fluxo</CardTitle></CardHeader>
            <CardContent><p className={`text-xl font-bold font-display ${fluxo >= 0 ? "text-primary" : "text-destructive"}`}>{formatMoney(fluxo)}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/dashboard")}>
            <CardHeader className="pb-1"><CardTitle className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Patrimônio</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold font-display text-primary">{formatMoney(totalCarteiras)}</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Studies Summary */}
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/estudos")}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-display">Estudos</CardTitle>
                </div>
                <div className="flex gap-1.5">
                  {dueFlashcards.length > 0 && <Badge variant="outline" className="text-xs gap-1"><Brain className="h-3 w-3" />{dueFlashcards.length}</Badge>}
                  <Badge variant="outline" className="text-xs gap-1"><Timer className="h-3 w-3" />{totalFocusMin}min</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-3 text-sm">
                <span className="text-muted-foreground">{subjects.length} disciplinas</span>
                <span className="text-muted-foreground">{pendingEvents.length} pendentes</span>
              </div>
              {upcomingEvents.slice(0, 3).map(ev => {
                const sub = subjects.find(s => s.id === ev.subject_id);
                return (
                  <div key={ev.id} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub?.color || "#3b82f6" }} />
                    <span className="truncate flex-1">{ev.title}</span>
                    <span className="text-muted-foreground shrink-0">{format(parseISO(ev.event_date), "dd/MM")}</span>
                  </div>
                );
              })}
              {upcomingEvents.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento nos próximos 7 dias</p>}
            </CardContent>
          </Card>

          {/* Fit Summary */}
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/fit")}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-display">Fitness</CardTitle>
                </div>
                {fitProfile?.weight && <Badge variant="outline" className="text-xs">{fitProfile.weight} kg</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {fitProfile ? (
                <>
                  <div className="flex gap-3 text-sm text-muted-foreground">
                    {fitProfile.goal && <span>Meta: {fitProfile.goal}</span>}
                    {fitProfile.experience_level && <span>Nível: {fitProfile.experience_level}</span>}
                  </div>
                  {recentWorkouts.length > 0 ? (
                    recentWorkouts.slice(0, 3).map((w: any) => (
                      <div key={w.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                        <span className="truncate">{w.workout_name}</span>
                        <span className="text-muted-foreground">{new Date(w.workout_date).toLocaleDateString("pt-BR")}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum treino recente</p>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Complete o onboarding fitness</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); navigate("/fit/onboarding"); }}>Iniciar</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tasks */}
        {tasks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-display">Tarefas Pendentes</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/tarefas")}>Ver todas</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {tasks.map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted/50">
                  <span className={`w-2 h-2 rounded-full ${t.priority === "alta" ? "bg-destructive" : t.priority === "media" ? "bg-amber-500" : "bg-muted-foreground"}`} />
                  <span className="truncate flex-1">{t.title}</span>
                  {t.due_date && <span className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Intelligence & Direction Layer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DailyRecommendation />
          <EnergyCheckIn />
        </div>

        <PredictionAlerts />
      </div>
    </AppLayout>
  );
}
