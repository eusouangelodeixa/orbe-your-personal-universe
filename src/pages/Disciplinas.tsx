import { useState, useRef } from "react";
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
import { Plus, Trash2, Clock, User, GraduationCap, Loader2, Calendar, Pencil, Upload, FileText, Check, X } from "lucide-react";
import { useSubjects, useAddSubject, useUpdateSubject, useDeleteSubject, Subject } from "@/hooks/useStudies";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const TYPES: Record<string, string> = { teorica: "Teórica", pratica: "Prática", laboratorio: "Laboratório" };
const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

type ExtractedSubject = {
  name: string;
  teacher?: string | null;
  schedule: { day: string; start: string; end: string }[];
  weekly_hours?: number;
  type?: string;
  course?: string;
  semester?: string;
  selected?: boolean;
};

const emptyForm = () => ({
  name: "", teacher: "", course: "", semester: "", type: "teorica",
  weekly_hours: 0, color: COLORS[0],
  schedule: [] as { day: string; start: string; end: string }[],
});

export default function Disciplinas() {
  const { data: subjects = [], isLoading } = useSubjects();
  const addSubject = useAddSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState(emptyForm());
  const [scheduleEntry, setScheduleEntry] = useState({ day: "Segunda", start: "08:00", end: "10:00" });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // PDF upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractedSubjects, setExtractedSubjects] = useState<ExtractedSubject[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (sub: Subject) => {
    setEditingId(sub.id);
    setForm({
      name: sub.name, teacher: sub.teacher || "", course: sub.course || "",
      semester: sub.semester || "", type: sub.type, weekly_hours: sub.weekly_hours,
      schedule: sub.schedule || [], color: sub.color,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name, teacher: form.teacher || null, course: form.course || null,
      semester: form.semester || null, type: form.type, weekly_hours: form.weekly_hours,
      schedule: form.schedule, color: form.color, ementa_url: null, ementa_text: null,
    };
    if (editingId) {
      updateSubject.mutate({ id: editingId, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      addSubject.mutate(payload, { onSuccess: () => { setForm(emptyForm()); setOpen(false); } });
    }
  };

  const addScheduleSlot = () => {
    setForm(f => ({ ...f, schedule: [...f.schedule, { ...scheduleEntry }] }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O arquivo deve ter no máximo 20MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setExtractedSubjects([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-subjects-pdf`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      const data = await resp.json();
      const subs = (data.subjects || []).map((s: ExtractedSubject) => ({ ...s, selected: true }));
      setExtractedSubjects(subs);

      if (subs.length === 0) {
        toast({ title: "Nenhuma disciplina encontrada", description: "O PDF não contém informações de disciplinas reconhecíveis.", variant: "destructive" });
      } else {
        toast({ title: `${subs.length} disciplina(s) encontrada(s)!`, description: "Revise e confirme quais deseja importar." });
      }
    } catch (err: any) {
      toast({ title: "Erro ao processar PDF", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleSubjectSelection = (index: number) => {
    setExtractedSubjects(prev => prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s));
  };

  const importSelected = async () => {
    const selected = extractedSubjects.filter(s => s.selected);
    if (!selected.length) {
      toast({ title: "Selecione ao menos uma disciplina", variant: "destructive" });
      return;
    }

    setSaving(true);
    let imported = 0;

    for (const sub of selected) {
      try {
        const colorIndex = imported % COLORS.length;
        await new Promise<void>((resolve, reject) => {
          addSubject.mutate(
            {
              name: sub.name,
              teacher: sub.teacher || null,
              course: sub.course || null,
              semester: sub.semester || null,
              type: sub.type || "teorica",
              weekly_hours: sub.weekly_hours || 0,
              schedule: sub.schedule || [],
              color: COLORS[colorIndex],
              ementa_url: null,
              ementa_text: null,
            },
            { onSuccess: () => { imported++; resolve(); }, onError: reject }
          );
        });
      } catch (err) {
        console.error("Failed to import subject:", sub.name, err);
      }
    }

    toast({ title: `${imported} disciplina(s) importada(s)!`, description: "Suas disciplinas foram adicionadas com sucesso." });
    setExtractedSubjects([]);
    setUploadOpen(false);
    setSaving(false);
  };

  const isPending = editingId ? updateSubject.isPending : addSubject.isPending;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Disciplinas</h1>
            <p className="text-muted-foreground text-sm">Gerencie suas matérias e acesse a agenda e chatbot</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/agenda")}>
              <Calendar className="h-4 w-4 mr-2" /> Agenda
            </Button>

            {/* PDF Upload Dialog */}
            <Dialog open={uploadOpen} onOpenChange={(v) => { setUploadOpen(v); if (!v) setExtractedSubjects([]); }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" /> Importar PDF
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Importar Disciplinas do PDF</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Faça upload do PDF com sua grade horária. O sistema irá extrair automaticamente as disciplinas com horários, professores e carga horária.
                  </p>

                  {/* Upload area */}
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 rounded-lg p-8 flex flex-col items-center gap-3 transition-colors disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-10 w-10 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Analisando documento com IA...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-10 w-10 text-muted-foreground" />
                          <span className="text-sm font-medium">Clique para selecionar o PDF ou imagem</span>
                          <span className="text-xs text-muted-foreground">PDF, PNG, JPG — máx. 20MB</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Extracted subjects preview */}
                  {extractedSubjects.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Disciplinas encontradas ({extractedSubjects.filter(s => s.selected).length}/{extractedSubjects.length} selecionadas)</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const allSelected = extractedSubjects.every(s => s.selected);
                            setExtractedSubjects(prev => prev.map(s => ({ ...s, selected: !allSelected })));
                          }}
                        >
                          {extractedSubjects.every(s => s.selected) ? "Desmarcar todas" : "Selecionar todas"}
                        </Button>
                      </div>

                      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                        {extractedSubjects.map((sub, idx) => (
                          <Card
                            key={idx}
                            className={`cursor-pointer transition-all ${sub.selected ? "border-primary/50 bg-primary/5" : "opacity-60"}`}
                            onClick={() => toggleSubjectSelection(idx)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={sub.selected}
                                  onCheckedChange={() => toggleSubjectSelection(idx)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0 space-y-1">
                                  <p className="font-medium text-sm truncate">{sub.name}</p>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    {sub.teacher && (
                                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {sub.teacher}</span>
                                    )}
                                    {sub.weekly_hours && sub.weekly_hours > 0 && (
                                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {sub.weekly_hours}h/sem</span>
                                    )}
                                    {sub.type && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{TYPES[sub.type] || sub.type}</Badge>
                                    )}
                                  </div>
                                  {sub.schedule?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {sub.schedule.map((s, i) => (
                                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                                          {s.day} {s.start}-{s.end}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {extractedSubjects.length > 0 && (
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setExtractedSubjects([]); setUploadOpen(false); }}>Cancelar</Button>
                    <Button onClick={importSelected} disabled={saving || !extractedSubjects.some(s => s.selected)}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      Importar {extractedSubjects.filter(s => s.selected).length} disciplina(s)
                    </Button>
                  </DialogFooter>
                )}
              </DialogContent>
            </Dialog>

            {/* Manual create */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nova Disciplina</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? "Editar Disciplina" : "Nova Disciplina"}</DialogTitle></DialogHeader>
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
                  <div>
                    <Label>Cor</Label>
                    <div className="flex gap-2 mt-1">
                      {COLORS.map(c => (
                        <button key={c} className={`w-7 h-7 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                      ))}
                    </div>
                  </div>
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
                  <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : subjects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground">Nenhuma disciplina cadastrada ainda.</p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" /> Importar do PDF
                </Button>
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" /> Criar manualmente
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((sub) => (
              <Card key={sub.id} className="group relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/disciplina/${sub.id}`)}>
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: sub.color }} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{sub.name}</CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sub)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSubject.mutate(sub.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
                  {sub.ementa_url && <Badge variant="secondary" className="text-xs">📄 Ementa</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
