import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen, CalendarDays, FileText, ClipboardList, RotateCw, Timer,
  GraduationCap, Loader2, BarChart3, CalendarClock, Zap,
} from "lucide-react";
import { useSubjects, useAcademicEvents } from "@/hooks/useStudies";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isAfter, isBefore, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { GradesDashboard } from "@/components/GradesDashboard";
import { StudyScheduleGenerator } from "@/components/StudyScheduleGenerator";
import { IntensiveStudyDashboard } from "@/components/intensive-study/IntensiveStudyDashboard";

const EVENT_TYPES: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  prova: { label: "Prova", icon: FileText, color: "text-red-500" },
  trabalho: { label: "Trabalho", icon: ClipboardList, color: "text-amber-500" },
  atividade: { label: "Atividade", icon: BookOpen, color: "text-blue-500" },
  revisao: { label: "Revisão", icon: RotateCw, color: "text-emerald-500" },
};

export default function StudiesDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: subjects = [], isLoading: loadingSubjects } = useSubjects();
  const { data: allEvents = [], isLoading: loadingEvents } = useAcademicEvents();

  // Pomodoro stats for today
  const today = new Date().toISOString().split("T")[0];
  const { data: pomodoroToday = [] } = useQuery({
    queryKey: ["pomodoro_today", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pomodoro_sessions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("session_date", today);
      if (error) throw error;
      return data as any[];
    },
  });

  const now = new Date();
  const nextWeek = addDays(now, 7);

  const pendingEvents = allEvents.filter(
    ev => ev.status === "pendente" || ev.status === "em_andamento"
  );
  const upcomingEvents = pendingEvents
    .filter(ev => isAfter(parseISO(ev.event_date), now) && isBefore(parseISO(ev.event_date), nextWeek));
  const overdueEvents = pendingEvents
    .filter(ev => isBefore(parseISO(ev.event_date), now));
  const completedEvents = allEvents.filter(ev => ev.status === "entregue" || ev.status === "realizado");

  const totalPomodorosToday = pomodoroToday.reduce((a, p) => a + p.completed_pomodoros, 0);
  const totalFocusMinToday = pomodoroToday.reduce((a, p) => a + Math.floor(p.total_focus_seconds / 60), 0);

  const isLoading = loadingSubjects || loadingEvents;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Dashboard de Estudos</h1>
          <p className="text-muted-foreground">Visão geral das suas disciplinas e atividades acadêmicas</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Disciplinas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display text-primary">{subjects.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Ativas no semestre</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display text-destructive">{pendingEvents.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {overdueEvents.length > 0 ? `${overdueEvents.length} atrasado(s)` : "Eventos a concluir"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Concluídos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display text-primary">{completedEvents.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Entregues / Realizados</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Foco Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold font-display text-primary">{totalPomodorosToday}</p>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{totalFocusMinToday} min de foco</p>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Events */}
        {overdueEvents.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-base font-display text-destructive">⚠️ Atrasados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueEvents.slice(0, 5).map(ev => {
                const sub = subjects.find(s => s.id === ev.subject_id);
                const meta = EVENT_TYPES[ev.type];
                const daysLate = differenceInDays(now, parseISO(ev.event_date));
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 bg-card cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => navigate(`/disciplina/${ev.subject_id}`)}
                  >
                    <div className="w-1 h-10 rounded-full bg-destructive" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{ev.title}</span>
                      <div className="text-xs text-muted-foreground">
                        {sub?.name} • {daysLate} dia(s) atrasado
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-xs">{meta?.label || ev.type}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Upcoming 7 days */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <CardTitle className="font-display">Próximos 7 Dias</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/agenda")}>
                Ver Agenda
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map(ev => {
                const sub = subjects.find(s => s.id === ev.subject_id);
                const meta = EVENT_TYPES[ev.type];
                const Icon = meta?.icon || FileText;
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/disciplina/${ev.subject_id}`)}
                  >
                    <div className="w-1 h-10 rounded-full" style={{ backgroundColor: sub?.color || "#3b82f6" }} />
                    <Icon className={`h-4 w-4 shrink-0 ${meta?.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{ev.title}</span>
                        <Badge variant="outline" className={`text-xs ${meta?.color || ""}`}>{meta?.label || ev.type}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(ev.event_date), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                        {sub && <span> • {sub.name}</span>}
                      </div>
                    </div>
                    <Badge variant={ev.status === "pendente" ? "destructive" : "default"} className="text-xs shrink-0">
                      {ev.status === "pendente" ? "Pendente" : "Em andamento"}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                🎉 Nenhum evento pendente nos próximos 7 dias
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tabs for subjects, grades, and schedule */}
        <Tabs defaultValue="subjects">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="subjects" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" />Disciplinas</TabsTrigger>
            <TabsTrigger value="grades" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Notas</TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Cronograma</TabsTrigger>
            <TabsTrigger value="intensivo" className="gap-1.5"><Zap className="h-3.5 w-3.5" />Intensivo</TabsTrigger>
          </TabsList>

          <TabsContent value="subjects">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <CardTitle className="font-display">Disciplinas</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/disciplinas")}>
                    Gerenciar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {subjects.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {subjects.map(sub => {
                      const subEvents = allEvents.filter(e => e.subject_id === sub.id);
                      const subPending = subEvents.filter(e => e.status === "pendente" || e.status === "em_andamento").length;
                      const subDone = subEvents.filter(e => e.status === "entregue" || e.status === "realizado").length;
                      const pomSub = pomodoroToday.find(p => p.subject_id === sub.id);
                      return (
                        <div
                          key={sub.id}
                          className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/disciplina/${sub.id}`)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color }} />
                            <span className="font-medium text-sm truncate">{sub.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {subPending > 0 && <Badge variant="destructive" className="text-xs">{subPending} pendente(s)</Badge>}
                            {subDone > 0 && <Badge variant="secondary" className="text-xs">{subDone} concluído(s)</Badge>}
                            {pomSub && <Badge variant="outline" className="text-xs">🍅 {pomSub.completed_pomodoros} hoje</Badge>}
                            {sub.ementa_url && <Badge variant="outline" className="text-xs">📄 Ementa</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma disciplina cadastrada</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/disciplinas")}>
                      Cadastrar disciplina
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grades">
            <GradesDashboard />
          </TabsContent>

          <TabsContent value="schedule">
            <StudyScheduleGenerator />
          </TabsContent>

          <TabsContent value="intensivo">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> Motor de Estudo Intensivo
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Sessões adaptativas de recuperação acadêmica
                  </p>
                </div>
                <Button onClick={() => navigate("/estudos/intensivo")}>
                  <Zap className="h-4 w-4 mr-1" /> Nova Sessão
                </Button>
              </div>
              <IntensiveStudyDashboard />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
