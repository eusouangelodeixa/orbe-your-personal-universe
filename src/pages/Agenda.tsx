import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, FileText, ClipboardList, BookOpen, RotateCw, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSubjects, useAcademicEvents, useAddAcademicEvent, useUpdateAcademicEvent, useDeleteAcademicEvent, AcademicEvent } from "@/hooks/useStudies";
import { useSearchParams } from "react-router-dom";

const EVENT_TYPES: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  prova: { label: "Prova", icon: FileText, color: "text-red-500" },
  trabalho: { label: "Trabalho", icon: ClipboardList, color: "text-amber-500" },
  atividade: { label: "Atividade", icon: BookOpen, color: "text-blue-500" },
  revisao: { label: "Revisão", icon: RotateCw, color: "text-emerald-500" },
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "destructive" },
  em_andamento: { label: "Em andamento", variant: "default" },
  entregue: { label: "Entregue", variant: "secondary" },
  realizado: { label: "Realizado", variant: "secondary" },
};

const emptyForm = (subjectId = "") => ({
  subject_id: subjectId, type: "prova", title: "", description: "",
  event_date: "", content_topics: "", weight: "", is_group: false, status: "pendente",
});

export default function Agenda() {
  const [searchParams] = useSearchParams();
  const filterSubjectId = searchParams.get("disciplina") || "";

  const { data: subjects = [] } = useSubjects();
  const { data: allEvents = [], isLoading } = useAcademicEvents(filterSubjectId || undefined);
  const addEvent = useAddAcademicEvent();
  const updateEvent = useUpdateAcademicEvent();
  const deleteEvent = useDeleteAcademicEvent();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState(filterSubjectId || "all");
  const [form, setForm] = useState(emptyForm(filterSubjectId));

  const filteredEvents = useMemo(() => {
    if (selectedSubject === "all") return allEvents;
    return allEvents.filter(e => e.subject_id === selectedSubject);
  }, [allEvents, selectedSubject]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm(filterSubjectId)); setOpen(true); };
  const openEdit = (ev: AcademicEvent) => {
    setEditingId(ev.id);
    setForm({
      subject_id: ev.subject_id, type: ev.type, title: ev.title,
      description: ev.description || "", event_date: ev.event_date.slice(0, 16),
      content_topics: ev.content_topics || "", weight: ev.weight?.toString() || "",
      is_group: ev.is_group, status: ev.status,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.subject_id || !form.title || !form.event_date) return;
    const payload = {
      subject_id: form.subject_id, type: form.type, title: form.title,
      description: form.description || null, event_date: form.event_date,
      due_date: form.event_date, content_topics: form.content_topics || null,
      weight: form.weight ? Number(form.weight) : null, is_group: form.is_group,
      status: form.status, reminder_config: [],
    };
    if (editingId) {
      updateEvent.mutate({ id: editingId, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      addEvent.mutate(payload, { onSuccess: () => { setForm(emptyForm(filterSubjectId)); setOpen(false); } });
    }
  };

  const cycleStatus = (ev: AcademicEvent) => {
    const order = ["pendente", "em_andamento", "entregue", "realizado"];
    const next = order[(order.indexOf(ev.status) + 1) % order.length];
    updateEvent.mutate({ id: ev.id, status: next });
  };

  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || "";
  const getSubjectColor = (id: string) => subjects.find(s => s.id === id)?.color || "#888";

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const eventsOnDay = (day: Date) =>
    filteredEvents.filter(e => isSameDay(parseISO(e.event_date), day));

  const today = new Date();
  const weekDays = eachDayOfInterval({ start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) });

  const isPending = editingId ? updateEvent.isPending : addEvent.isPending;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Agenda Acadêmica</h1>
            <p className="text-muted-foreground text-sm">Provas, trabalhos, atividades e revisões</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar disciplina" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Evento</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? "Editar Evento" : "Novo Evento Acadêmico"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Disciplina *</Label>
                    <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tipo *</Label>
                      <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(EVENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                  <div><Label>Data/Hora *</Label><Input type="datetime-local" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} /></div>
                  <div><Label>Conteúdo/Tópicos</Label><Input value={form.content_topics} onChange={e => setForm(f => ({ ...f, content_topics: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    {form.type === "prova" && <div><Label>Peso na nota</Label><Input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} /></div>}
                    {form.type === "trabalho" && (
                      <div className="flex items-center gap-2 pt-6">
                        <Checkbox checked={form.is_group} onCheckedChange={v => setForm(f => ({ ...f, is_group: !!v }))} />
                        <Label>Trabalho em grupo</Label>
                      </div>
                    )}
                  </div>
                  <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="month">
          <TabsList>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mês</TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
          </TabsList>

          {/* WEEK VIEW */}
          <TabsContent value="week">
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(day => (
                <Card key={day.toISOString()} className={`min-h-[140px] ${isSameDay(day, today) ? "border-primary" : ""}`}>
                  <CardHeader className="p-2 pb-1">
                    <p className="text-xs font-medium text-center">{format(day, "EEE dd", { locale: ptBR })}</p>
                  </CardHeader>
                  <CardContent className="p-2 pt-0 space-y-1">
                    {eventsOnDay(day).map(ev => {
                      const meta = EVENT_TYPES[ev.type];
                      return (
                        <div key={ev.id} className="text-xs p-1.5 rounded border cursor-pointer hover:bg-muted/50" onClick={() => openEdit(ev)}>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getSubjectColor(ev.subject_id) }} />
                            <span className="truncate font-medium">{ev.title}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className={`text-[10px] ${meta?.color}`}>{meta?.label}</span>
                            <Badge variant={STATUS_MAP[ev.status]?.variant || "outline"} className="text-[10px] h-4 px-1">{STATUS_MAP[ev.status]?.label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* MONTH VIEW */}
          <TabsContent value="month">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="font-semibold capitalize">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</span>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {calendarDays.map(day => {
                const dayEvents = eventsOnDay(day);
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                return (
                  <div key={day.toISOString()} className={`min-h-[80px] p-1 rounded border text-xs ${!isCurrentMonth ? "opacity-30" : ""} ${isSameDay(day, today) ? "border-primary bg-primary/5" : "border-border/50"}`}>
                    <div className="font-medium text-right mb-0.5">{format(day, "d")}</div>
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} className="truncate text-[10px] px-1 rounded mb-0.5 cursor-pointer" style={{ backgroundColor: getSubjectColor(ev.subject_id) + "22", color: getSubjectColor(ev.subject_id) }} onClick={() => openEdit(ev)}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground text-center">+{dayEvents.length - 3}</div>}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* LIST VIEW */}
          <TabsContent value="list">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filteredEvents.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum evento encontrado.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {filteredEvents.map(ev => {
                  const meta = EVENT_TYPES[ev.type];
                  const Icon = meta?.icon || FileText;
                  return (
                    <Card key={ev.id} className="group">
                      <CardContent className="flex items-center gap-3 py-3 px-4">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getSubjectColor(ev.subject_id) }} />
                        <Icon className={`h-4 w-4 shrink-0 ${meta?.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{ev.title}</span>
                            <Badge variant="outline" className="text-xs shrink-0">{getSubjectName(ev.subject_id)}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(ev.event_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            {ev.content_topics && ` • ${ev.content_topics}`}
                            {ev.weight && ` • Peso: ${ev.weight}`}
                            {ev.is_group && " • Em grupo"}
                          </div>
                        </div>
                        <Badge variant={STATUS_MAP[ev.status]?.variant || "outline"} className="cursor-pointer shrink-0" onClick={() => cycleStatus(ev)}>
                          {STATUS_MAP[ev.status]?.label}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEdit(ev)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteEvent.mutate(ev.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
