import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSubjects, useAcademicEvents } from "@/hooks/useStudies";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarClock, Loader2, Sparkles, Check, Pencil, Trash2 } from "lucide-react";
import { addDays, differenceInDays, format, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ScheduleItem {
  id: string;
  user_id: string;
  subject_id: string | null;
  event_id: string | null;
  title: string;
  scheduled_date: string;
  duration_minutes: number | null;
  start_time: string | null;
  completed: boolean;
}

export function StudyScheduleGenerator() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: subjects = [] } = useSubjects();
  const { data: events = [] } = useAcademicEvents();
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState("");

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
      return data as ScheduleItem[];
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

  const openEdit = (s: ScheduleItem) => {
    setEditing(s);
    setEditTitle(s.title);
    setEditDate(s.scheduled_date);
    setEditTime(s.start_time || "");
    setEditDuration(String(s.duration_minutes || 60));
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("study_schedules")
      .update({
        title: editTitle,
        scheduled_date: editDate,
        start_time: editTime || null,
        duration_minutes: parseInt(editDuration) || 60,
      } as any)
      .eq("id", editing.id);
    if (error) {
      toast.error("Erro ao salvar alterações");
    } else {
      toast.success("Sessão atualizada!");
      qc.invalidateQueries({ queryKey: ["study_schedules"] });
    }
    setEditing(null);
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase.from("study_schedules").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir sessão");
    } else {
      toast.success("Sessão excluída!");
      qc.invalidateQueries({ queryKey: ["study_schedules"] });
    }
  };

  const deleteAll = async () => {
    const { error } = await supabase
      .from("study_schedules")
      .delete()
      .eq("user_id", user!.id)
      .gte("scheduled_date", now.toISOString().split("T")[0]);
    if (error) {
      toast.error("Erro ao limpar cronograma");
    } else {
      toast.success("Cronograma limpo!");
      qc.invalidateQueries({ queryKey: ["study_schedules"] });
    }
  };

  const todayStr = format(now, "yyyy-MM-dd");
  const todaySchedules = schedules.filter(s => s.scheduled_date === todayStr);
  const futureSchedules = schedules.filter(s => s.scheduled_date > todayStr);

  const ScheduleRow = ({ s, showDate = false }: { s: ScheduleItem; showDate?: boolean }) => (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card group">
      <Checkbox
        checked={s.completed}
        onCheckedChange={(checked) => toggleComplete(s.id, !!checked)}
      />
      <div className="flex-1 min-w-0">
        {showDate && (
          <Badge variant="outline" className="text-xs mb-1">
            {format(parseISO(s.scheduled_date), "dd/MM EEE", { locale: ptBR })}
          </Badge>
        )}
        <p className={`text-sm ${s.completed ? "line-through text-muted-foreground" : "font-medium"}`}>{s.title}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {s.start_time && <span>⏰ {s.start_time}</span>}
          {s.duration_minutes && <span>⏱ {s.duration_minutes}min</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteSchedule(s.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {s.completed && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Cronograma de Estudos
        </h3>
        <div className="flex gap-2">
          {schedules.length > 0 && (
            <Button size="sm" variant="ghost" onClick={deleteAll} className="gap-1.5 text-destructive text-xs">
              <Trash2 className="h-3.5 w-3.5" /> Limpar tudo
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={generateSchedule} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Gerar automático
          </Button>
        </div>
      </div>

      {todaySchedules.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-primary">Hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaySchedules.map(s => <ScheduleRow key={s.id} s={s} />)}
          </CardContent>
        </Card>
      )}

      {futureSchedules.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Próximos dias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {futureSchedules.slice(0, 10).map(s => <ScheduleRow key={s.id} s={s} showDate />)}
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar sessão de estudo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>
              <div>
                <Label>Horário</Label>
                <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Duração (minutos)</Label>
              <Input type="number" value={editDuration} onChange={e => setEditDuration(e.target.value)} min={5} max={480} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
