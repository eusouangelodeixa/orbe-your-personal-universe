import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useSubjects, useAcademicEvents } from "@/hooks/useStudies";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarClock, Loader2, Sparkles, Check } from "lucide-react";
import { addDays, differenceInDays, format, parseISO, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function StudyScheduleGenerator() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: subjects = [] } = useSubjects();
  const { data: events = [] } = useAcademicEvents();
  const [generating, setGenerating] = useState(false);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["study_schedules", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_schedules")
        .select("*")
        .eq("user_id", user!.id)
        .gte("scheduled_date", new Date().toISOString().split("T")[0])
        .order("scheduled_date");
      if (error) throw error;
      return data as any[];
    },
  });

  const now = new Date();
  const pendingEvents = events.filter(
    e => (e.status === "pendente" || e.status === "em_andamento") && isAfter(parseISO(e.event_date), now)
  );

  const generateSchedule = async () => {
    if (!pendingEvents.length) {
      toast.info("Nenhum evento pendente para gerar cronograma");
      return;
    }

    setGenerating(true);
    try {
      // Delete existing future schedules
      await supabase
        .from("study_schedules")
        .delete()
        .eq("user_id", user!.id)
        .gte("scheduled_date", now.toISOString().split("T")[0]);

      const newSchedules: any[] = [];

      for (const event of pendingEvents) {
        const eventDate = parseISO(event.event_date);
        const daysUntil = differenceInDays(eventDate, now);
        if (daysUntil < 1) continue;

        const sub = subjects.find(s => s.id === event.subject_id);
        const subName = sub?.name || "Disciplina";

        // Create study sessions: more sessions for exams, fewer for assignments
        const isExam = event.type === "prova" || event.type === "revisao";
        const sessionCount = isExam ? Math.min(daysUntil, 5) : Math.min(daysUntil, 3);
        const interval = Math.max(1, Math.floor(daysUntil / sessionCount));

        for (let i = 0; i < sessionCount; i++) {
          const sessionDate = addDays(now, Math.min(1 + i * interval, daysUntil - 1));
          const isLastSession = i === sessionCount - 1;

          newSchedules.push({
            user_id: user!.id,
            subject_id: event.subject_id,
            event_id: event.id,
            title: isLastSession
              ? `📝 Revisão final: ${event.title}`
              : `📖 Estudar ${subName}: ${event.title}`,
            scheduled_date: format(sessionDate, "yyyy-MM-dd"),
            duration_minutes: isExam ? 90 : 60,
            start_time: isExam ? "19:00" : "20:00",
          });
        }
      }

      if (newSchedules.length > 0) {
        const { error } = await supabase.from("study_schedules").insert(newSchedules);
        if (error) throw error;
        toast.success(`${newSchedules.length} sessões de estudo criadas!`);
        qc.invalidateQueries({ queryKey: ["study_schedules"] });
      }
    } catch (e) {
      console.error("Error generating schedule:", e);
      toast.error("Erro ao gerar cronograma");
    } finally {
      setGenerating(false);
    }
  };

  const toggleComplete = async (id: string, completed: boolean) => {
    await supabase.from("study_schedules").update({ completed } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["study_schedules"] });
  };

  const todayStr = format(now, "yyyy-MM-dd");
  const todaySchedules = schedules.filter(s => s.scheduled_date === todayStr);
  const futureSchedules = schedules.filter(s => s.scheduled_date > todayStr);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Cronograma de Estudos
        </h3>
        <Button size="sm" variant="outline" onClick={generateSchedule} disabled={generating} className="gap-1.5">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Gerar automático
        </Button>
      </div>

      {todaySchedules.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-primary">Hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaySchedules.map(s => {
              const sub = subjects.find(x => x.id === s.subject_id);
              return (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card">
                  <Checkbox
                    checked={s.completed}
                    onCheckedChange={(checked) => toggleComplete(s.id, !!checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${s.completed ? "line-through text-muted-foreground" : "font-medium"}`}>{s.title}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {s.start_time && <span>⏰ {s.start_time}</span>}
                      {s.duration_minutes && <span>⏱ {s.duration_minutes}min</span>}
                    </div>
                  </div>
                  {s.completed && <Check className="h-4 w-4 text-emerald-400" />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {futureSchedules.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Próximos dias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {futureSchedules.slice(0, 10).map(s => (
              <div key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
                <Badge variant="outline" className="text-xs shrink-0">
                  {format(parseISO(s.scheduled_date), "dd/MM EEE", { locale: ptBR })}
                </Badge>
                <span className="truncate text-muted-foreground">{s.title}</span>
                {s.duration_minutes && <span className="text-xs text-muted-foreground shrink-0">{s.duration_minutes}min</span>}
              </div>
            ))}
            {futureSchedules.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-1">+{futureSchedules.length - 10} mais</p>
            )}
          </CardContent>
        </Card>
      )}

      {schedules.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum cronograma gerado</p>
            <p className="text-xs">Clique em "Gerar automático" para criar sessões de estudo baseadas nas datas de provas</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
