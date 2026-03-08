import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Plus, Trash2, Clock, BookOpen, User, GraduationCap, Loader2, MessageSquare, Calendar } from "lucide-react";
import { useSubjects, useAddSubject, useDeleteSubject, Subject } from "@/hooks/useStudies";
import { useNavigate } from "react-router-dom";

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const TYPES: Record<string, string> = { teorica: "Teórica", pratica: "Prática", laboratorio: "Laboratório" };
const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function Disciplinas() {
  const { data: subjects = [], isLoading } = useSubjects();
  const addSubject = useAddSubject();
  const deleteSubject = useDeleteSubject();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "", teacher: "", course: "", semester: "", type: "teorica",
    weekly_hours: 0, color: COLORS[0],
    schedule: [] as { day: string; start: string; end: string }[],
  });
  const [scheduleEntry, setScheduleEntry] = useState({ day: "Segunda", start: "08:00", end: "10:00" });
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addSubject.mutate({
      name: form.name, teacher: form.teacher || null, course: form.course || null,
      semester: form.semester || null, type: form.type, weekly_hours: form.weekly_hours,
      schedule: form.schedule, color: form.color,
    }, {
      onSuccess: () => {
        setForm({ name: "", teacher: "", course: "", semester: "", type: "teorica", weekly_hours: 0, color: COLORS[0], schedule: [] });
        setOpen(false);
      },
    });
  };

  const addScheduleSlot = () => {
    setForm(f => ({ ...f, schedule: [...f.schedule, { ...scheduleEntry }] }));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Disciplinas</h1>
            <p className="text-muted-foreground text-sm">Gerencie suas matérias e acesse a agenda e chatbot</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/agenda")}>
              <Calendar className="h-4 w-4 mr-2" /> Agenda
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nova Disciplina</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nova Disciplina</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Cálculo I" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Professor</Label><Input value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} /></div>
                    <div><Label>Curso</Label><Input value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Semestre</Label><Input value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} placeholder="2026.1" /></div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Carga (h/sem)</Label><Input type="number" value={form.weekly_hours} onChange={e => setForm(f => ({ ...f, weekly_hours: Number(e.target.value) }))} /></div>
                  </div>

                  {/* Color */}
                  <div>
                    <Label>Cor</Label>
                    <div className="flex gap-2 mt-1">
                      {COLORS.map(c => (
                        <button key={c} className={`w-7 h-7 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                      ))}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <Label>Horários</Label>
                    <div className="flex gap-2 mt-1">
                      <Select value={scheduleEntry.day} onValueChange={v => setScheduleEntry(s => ({ ...s, day: v }))}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="time" value={scheduleEntry.start} onChange={e => setScheduleEntry(s => ({ ...s, start: e.target.value }))} className="w-[100px]" />
                      <Input type="time" value={scheduleEntry.end} onChange={e => setScheduleEntry(s => ({ ...s, end: e.target.value }))} className="w-[100px]" />
                      <Button variant="outline" size="icon" onClick={addScheduleSlot}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {form.schedule.map((s, i) => (
                        <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setForm(f => ({ ...f, schedule: f.schedule.filter((_, j) => j !== i) }))}>
                          {s.day} {s.start}-{s.end} ✕
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={handleAdd} disabled={addSubject.isPending}>
                    {addSubject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : subjects.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma disciplina cadastrada ainda.</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((sub) => (
              <Card key={sub.id} className="group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: sub.color }} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{sub.name}</CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => deleteSubject.mutate(sub.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Badge variant="outline" className="w-fit text-xs">{TYPES[sub.type] || sub.type}</Badge>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {sub.teacher && <div className="flex items-center gap-2 text-muted-foreground"><User className="h-3.5 w-3.5" /> {sub.teacher}</div>}
                  {sub.course && <div className="flex items-center gap-2 text-muted-foreground"><GraduationCap className="h-3.5 w-3.5" /> {sub.course} {sub.semester && `• ${sub.semester}`}</div>}
                  {sub.weekly_hours > 0 && <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {sub.weekly_hours}h/semana</div>}
                  {sub.schedule?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sub.schedule.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{s.day} {s.start}-{s.end}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/agenda?disciplina=${sub.id}`)}>
                      <BookOpen className="h-3.5 w-3.5 mr-1" /> Agenda
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/chatbot/${sub.id}`)}>
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Chatbot
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
