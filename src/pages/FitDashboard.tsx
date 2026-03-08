import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dumbbell, Utensils, TrendingUp, MessageCircle, Bell, ChevronRight,
  Loader2, Scale, Target, Calendar
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const DAYS = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

export default function FitDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
  const [progressRecords, setProgressRecords] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);

  // Reminder form
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderForm, setReminderForm] = useState({ title: "", type: "treino", time: "07:00", days: [] as string[] });

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const [profileRes, logsRes, progressRes, remindersRes] = await Promise.all([
      supabase.from("fit_profiles" as any).select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("fit_workout_logs" as any).select("*").eq("user_id", user!.id).order("workout_date", { ascending: false }).limit(7),
      supabase.from("fit_progress" as any).select("*").eq("user_id", user!.id).order("record_date", { ascending: false }).limit(10),
      supabase.from("fit_reminders" as any).select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    ]);

    if (!profileRes.data || !(profileRes.data as any).onboarding_completed) {
      navigate("/fit/onboarding");
      return;
    }

    setProfile(profileRes.data);
    setWorkoutLogs((logsRes.data as any) || []);
    setProgressRecords((progressRes.data as any) || []);
    setReminders((remindersRes.data as any) || []);
    setLoading(false);
  };

  const saveReminder = async () => {
    if (!reminderForm.title || !reminderForm.time) { toast.error("Preencha título e horário"); return; }
    const { error } = await supabase.from("fit_reminders" as any).insert({
      user_id: user!.id,
      title: reminderForm.title,
      type: reminderForm.type,
      time: reminderForm.time,
      days: reminderForm.days,
    } as any);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Lembrete criado! ⏰");
    setReminderOpen(false);
    setReminderForm({ title: "", type: "treino", time: "07:00", days: [] });
    loadData();
  };

  const toggleReminder = async (id: string, enabled: boolean) => {
    await supabase.from("fit_reminders" as any).update({ enabled } as any).eq("id", id);
    setReminders(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
  };

  const deleteReminder = async (id: string) => {
    await supabase.from("fit_reminders" as any).delete().eq("id", id);
    setReminders(prev => prev.filter(r => r.id !== id));
    toast.success("Lembrete removido");
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  const bmi = profile?.bmi ? parseFloat(profile.bmi).toFixed(1) : "—";
  const goalLabels: Record<string, string> = {
    perda_gordura: "🔥 Perda de gordura",
    ganho_massa: "💪 Ganho de massa",
    hipertrofia: "🏋️ Hipertrofia",
    manutencao: "⚖️ Manutenção",
    condicionamento: "🏃 Condicionamento",
    saude_geral: "❤️ Saúde geral",
  };

  const weeklyTarget = profile?.weekly_availability?.length || 0;
  const thisWeekLogs = workoutLogs.filter(l => {
    const d = new Date(l.workout_date);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    return d >= weekStart;
  }).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display flex items-center gap-2">
              <Dumbbell className="h-8 w-8 text-primary" /> Fit
            </h1>
            <p className="text-muted-foreground">{goalLabels[profile?.goal] || "Seu módulo de saúde e fitness"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/fit/onboarding")}>Editar perfil</Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <Scale className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{profile?.weight || "—"}<span className="text-sm text-muted-foreground">kg</span></p>
              <p className="text-xs text-muted-foreground">Peso atual</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Target className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{bmi}</p>
              <p className="text-xs text-muted-foreground">IMC</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{thisWeekLogs}<span className="text-sm text-muted-foreground">/{weeklyTarget}</span></p>
              <p className="text-xs text-muted-foreground">Treinos esta semana</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{workoutLogs.length}</p>
              <p className="text-xs text-muted-foreground">Treinos registrados</p>
            </CardContent>
          </Card>
        </div>

        {weeklyTarget > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Progresso semanal</CardTitle></CardHeader>
            <CardContent>
              <Progress value={(thisWeekLogs / weeklyTarget) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground mt-2">{thisWeekLogs} de {weeklyTarget} treinos realizados</p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/fit/treino">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="p-3 rounded-lg bg-primary/10"><Dumbbell className="h-6 w-6 text-primary" /></div>
                <div className="flex-1">
                  <p className="font-medium">Plano de Treino</p>
                  <p className="text-sm text-muted-foreground">Ver plano, registrar treino</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link to="/fit/alimentacao">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="p-3 rounded-lg bg-primary/10"><Utensils className="h-6 w-6 text-primary" /></div>
                <div className="flex-1">
                  <p className="font-medium">Plano Alimentar</p>
                  <p className="text-sm text-muted-foreground">Refeições, lista de compras</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link to="/fit/progresso">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="p-3 rounded-lg bg-primary/10"><TrendingUp className="h-6 w-6 text-primary" /></div>
                <div className="flex-1">
                  <p className="font-medium">Evolução</p>
                  <p className="text-sm text-muted-foreground">Gráficos, fotos e medidas</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link to="/fit/chat">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="p-3 rounded-lg bg-primary/10"><MessageCircle className="h-6 w-6 text-primary" /></div>
                <div className="flex-1">
                  <p className="font-medium">Nutricionista IA</p>
                  <p className="text-sm text-muted-foreground">Chat especializado</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Smart Reminders Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Lembretes Automáticos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              O ORBE Fit envia lembretes inteligentes via WhatsApp automaticamente com base no seu perfil:
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span>🏋️</span> <span>Treino nos dias da sua disponibilidade semanal</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>🍽️</span> <span>Refeições nos horários do seu plano alimentar</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>💧</span> <span>Hidratação ao longo do dia</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>💊</span> <span>Suplementos (se cadastrados)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>⚠️</span> <span>Alerta de inatividade após 3 dias sem treinar</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Ative as notificações WhatsApp no seu perfil para receber os lembretes.
            </p>
          </CardContent>
        </Card>

        {/* Recent workouts */}
        {workoutLogs.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Últimos treinos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {workoutLogs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{log.workout_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.workout_date).toLocaleDateString("pt-BR")}
                      {log.duration_minutes && ` · ${log.duration_minutes}min`}
                    </p>
                  </div>
                  {log.mood && (
                    <Badge variant="outline" className="text-xs">
                      {log.mood === "otimo" ? "😁" : log.mood === "bom" ? "🙂" : log.mood === "normal" ? "😐" : "😓"} {log.mood}
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
