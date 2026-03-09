import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Dumbbell, Plus, Loader2, Sparkles, CheckCircle2, Calendar, Upload, PenLine, Trash2, FileDown, Pencil, Save, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  createOrbeDoc, finalizeDoc, drawHeader, drawSectionTitle,
  drawListItem, checkPage,
} from "@/lib/pdfTemplate";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest?: string;
  weight?: string;
}

interface WorkoutDay {
  name: string;
  exercises: Exercise[];
}

export default function FitWorkout() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  // Log dialog
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, { sets: { reps: string; weight: string }[] }>>({});
  const [logForm, setLogForm] = useState({ workout_name: "", duration_minutes: "", mood: "bom", notes: "", workout_date: new Date().toISOString().slice(0, 10) });

  // Manual plan dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualText, setManualText] = useState("");

  // PDF upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Inline editing
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<{ title: string; days: WorkoutDay[] } | null>(null);

  // Log editing
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogForm, setEditLogForm] = useState({ workout_name: "", duration_minutes: "", mood: "bom", notes: "", workout_date: "" });

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const [plansRes, logsRes] = await Promise.all([
      supabase.from("fit_workout_plans" as any).select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("fit_workout_logs" as any).select("*").eq("user_id", user!.id).order("workout_date", { ascending: false }).limit(30),
    ]);
    setPlans((plansRes.data as any) || []);
    setLogs((logsRes.data as any) || []);
    setLoading(false);
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("fit-generate", { body: { type: "workout" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Plano de treino gerado! 🎉");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar plano");
    }
    setGenerating(false);
  };

  const openCheckin = (day: WorkoutDay) => {
    setSelectedDay(day);
    setLogForm(f => ({ ...f, workout_name: day.name }));
    const initial: Record<string, { sets: { reps: string; weight: string }[] }> = {};
    day.exercises.forEach(ex => {
      initial[ex.name] = {
        sets: Array.from({ length: ex.sets }, () => ({ reps: String(ex.reps).replace(/[^0-9]/g, '') || "12", weight: ex.weight || "" }))
      };
    });
    setExerciseLogs(initial);
    setLogDialogOpen(true);
  };

  const saveLog = async () => {
    if (!logForm.workout_name) { toast.error("Informe o nome do treino"); return; }
    const exercises = selectedDay ? Object.entries(exerciseLogs).map(([name, data]) => ({
      name, sets: data.sets,
    })) : [];
    const { error } = await supabase.from("fit_workout_logs" as any).insert({
      user_id: user!.id, workout_name: logForm.workout_name,
      workout_date: logForm.workout_date,
      duration_minutes: logForm.duration_minutes ? parseInt(logForm.duration_minutes) : null,
      mood: logForm.mood, notes: logForm.notes || null, exercises,
      plan_id: plans.find(p => p.active)?.id || null,
    } as any);
    if (error) { toast.error("Erro ao salvar treino"); return; }
    toast.success("Treino registrado! 💪");
    setLogDialogOpen(false);
    setSelectedDay(null);
    setLogForm({ workout_name: "", duration_minutes: "", mood: "bom", notes: "", workout_date: new Date().toISOString().slice(0, 10) });
    loadData();
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${user!.id}/workout-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("fit-photos").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("fit-photos").getPublicUrl(path);
      await supabase.from("fit_workout_plans" as any).update({ active: false } as any).eq("user_id", user!.id);
      await supabase.from("fit_workout_plans" as any).insert({
        user_id: user!.id, title: file.name.replace(".pdf", ""), source: "pdf",
        plan_data: { raw_text: "Plano importado via PDF" }, pdf_url: urlData.publicUrl, active: true,
      } as any);
      toast.success("Plano importado via PDF! 📄");
      loadData();
    } catch (err: any) { toast.error(err.message || "Erro ao importar PDF"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const saveManualPlan = async () => {
    if (!manualTitle.trim()) { toast.error("Informe o título"); return; }
    const lines = manualText.split("\n").filter(l => l.trim());
    const days: WorkoutDay[] = [];
    let currentDay: WorkoutDay | null = null;
    lines.forEach(line => {
      if (line.startsWith("#") || line.startsWith("Dia") || line.startsWith("Treino")) {
        if (currentDay) days.push(currentDay);
        currentDay = { name: line.replace(/^#+\s*/, "").trim(), exercises: [] };
      } else if (currentDay && line.trim().startsWith("-")) {
        currentDay.exercises.push({ name: line.replace(/^-\s*/, "").trim(), sets: 3, reps: "12" });
      } else if (currentDay) {
        currentDay.exercises.push({ name: line.trim(), sets: 3, reps: "12" });
      }
    });
    if (currentDay) days.push(currentDay);
    await supabase.from("fit_workout_plans" as any).update({ active: false } as any).eq("user_id", user!.id);
    await supabase.from("fit_workout_plans" as any).insert({
      user_id: user!.id, title: manualTitle, source: "manual",
      plan_data: days.length > 0 ? { title: manualTitle, days } : { raw_text: manualText }, active: true,
    } as any);
    toast.success("Plano salvo! ✅");
    setManualOpen(false); setManualTitle(""); setManualText(""); loadData();
  };

  const deletePlan = async (planId: string) => {
    await supabase.from("fit_workout_plans" as any).delete().eq("id", planId);
    toast.success("Plano removido"); loadData();
  };

  const activatePlan = async (planId: string) => {
    await supabase.from("fit_workout_plans" as any).update({ active: false } as any).eq("user_id", user!.id);
    await supabase.from("fit_workout_plans" as any).update({ active: true } as any).eq("id", planId);
    toast.success("Plano ativado"); loadData();
  };

  // === INLINE EDITING ===
  const startEditing = () => {
    const ap = plans.find(p => p.active);
    if (!ap?.plan_data?.days) { toast.error("Este plano não pode ser editado inline"); return; }
    setEditData({ title: ap.title, days: JSON.parse(JSON.stringify(ap.plan_data.days)) });
    setEditing(true);
  };

  const cancelEditing = () => { setEditing(false); setEditData(null); };

  const saveEditing = async () => {
    const ap = plans.find(p => p.active);
    if (!ap || !editData) return;
    const { error } = await supabase.from("fit_workout_plans" as any).update({
      title: editData.title,
      plan_data: { ...ap.plan_data, title: editData.title, days: editData.days },
    } as any).eq("id", ap.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Plano atualizado! ✅");
    setEditing(false); setEditData(null); loadData();
  };

  const addExerciseToDay = (dayIdx: number) => {
    if (!editData) return;
    const next = { ...editData, days: [...editData.days] };
    next.days[dayIdx] = { ...next.days[dayIdx], exercises: [...next.days[dayIdx].exercises, { name: "Novo exercício", sets: 3, reps: "12" }] };
    setEditData(next);
  };

  const removeExercise = (dayIdx: number, exIdx: number) => {
    if (!editData) return;
    const next = { ...editData, days: [...editData.days] };
    next.days[dayIdx] = { ...next.days[dayIdx], exercises: next.days[dayIdx].exercises.filter((_, i) => i !== exIdx) };
    setEditData(next);
  };

  const updateExercise = (dayIdx: number, exIdx: number, field: keyof Exercise, value: string | number) => {
    if (!editData) return;
    const next = { ...editData, days: [...editData.days] };
    next.days[dayIdx] = { ...next.days[dayIdx], exercises: [...next.days[dayIdx].exercises] };
    next.days[dayIdx].exercises[exIdx] = { ...next.days[dayIdx].exercises[exIdx], [field]: value };
    setEditData(next);
  };

  const addDay = () => {
    if (!editData) return;
    setEditData({ ...editData, days: [...editData.days, { name: `Treino ${String.fromCharCode(65 + editData.days.length)}`, exercises: [] }] });
  };

  const removeDay = (idx: number) => {
    if (!editData) return;
    setEditData({ ...editData, days: editData.days.filter((_, i) => i !== idx) });
  };

  // === LOG EDIT/DELETE ===
  const startEditLog = (log: any) => {
    setEditingLogId(log.id);
    setEditLogForm({
      workout_name: log.workout_name,
      duration_minutes: log.duration_minutes?.toString() || "",
      mood: log.mood || "bom",
      notes: log.notes || "",
      workout_date: log.workout_date,
    });
  };

  const saveEditLog = async () => {
    if (!editingLogId) return;
    const { error } = await supabase.from("fit_workout_logs" as any).update({
      workout_name: editLogForm.workout_name,
      workout_date: editLogForm.workout_date,
      duration_minutes: editLogForm.duration_minutes ? parseInt(editLogForm.duration_minutes) : null,
      mood: editLogForm.mood,
      notes: editLogForm.notes || null,
    } as any).eq("id", editingLogId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Treino atualizado! ✅");
    setEditingLogId(null);
    loadData();
  };

  const deleteLog = async (logId: string) => {
    const { error } = await supabase.from("fit_workout_logs" as any).delete().eq("id", logId);
    if (error) { toast.error("Erro ao apagar"); return; }
    toast.success("Treino removido");
    loadData();
  };

  // === PDF EXPORT ===
  const exportPDF = () => {
    const ap = plans.find(p => p.active);
    if (!ap) return;
    const doc = createOrbeDoc();
    let y = drawHeader(doc, ap.title || "Plano de Treino", "MÓDULO FIT — TREINO");

    if (ap.plan_data?.days) {
      ap.plan_data.days.forEach((day: WorkoutDay) => {
        y = checkPage(doc, y, 40);
        y = drawSectionTitle(doc, y, day.name);
        day.exercises?.forEach(ex => {
          const detail = `${ex.name}  —  ${ex.sets}×${ex.reps}${ex.weight ? ` · ${ex.weight}` : ""}${ex.rest ? ` · Descanso: ${ex.rest}` : ""}`;
          y = drawListItem(doc, y, detail);
        });
        y += 4;
      });
    } else {
      const text = ap.plan_data?.raw_text || JSON.stringify(ap.plan_data, null, 2);
      const lines = doc.splitTextToSize(text, 170);
      lines.forEach((line: string) => {
        y = drawListItem(doc, y, line);
      });
    }

    finalizeDoc(doc);
    doc.save(`${ap.title || "plano-treino"}.pdf`);
    toast.success("PDF exportado! 📄");
  };

  const activePlan = plans.find(p => p.active);

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Dumbbell className="h-6 w-6 text-primary" /> Plano de Treino
            </h1>
            <p className="text-muted-foreground text-sm">Gerado por IA, importado ou manual</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={logDialogOpen && !selectedDay} onOpenChange={(o) => { if (!o) { setLogDialogOpen(false); setSelectedDay(null); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSelectedDay(null); setLogDialogOpen(true); }}>
                  <CheckCircle2 className="h-4 w-4" /> Check-in
                </Button>
              </DialogTrigger>
            </Dialog>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManualOpen(true)}>
              <PenLine className="h-4 w-4" /> Manual
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 relative" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} PDF
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
            </Button>
            <Button onClick={generatePlan} disabled={generating} size="sm" className="gap-1.5">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar IA
            </Button>
          </div>
        </div>

        {/* Active Plan */}
        {activePlan ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                {editing ? (
                  <Input value={editData?.title || ""} onChange={e => setEditData(d => d ? { ...d, title: e.target.value } : d)} className="h-8 text-base font-semibold" />
                ) : (
                  <CardTitle className="text-base">{activePlan.title}</CardTitle>
                )}
                <div className="flex items-center gap-1.5">
                  {editing ? (
                    <>
                      <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={saveEditing}><Save className="h-3 w-3" /> Salvar</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={cancelEditing}><X className="h-3 w-3" /> Cancelar</Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="default">Ativo</Badge>
                      {activePlan.plan_data?.days && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEditing}><Pencil className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportPDF}><FileDown className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePlan(activePlan.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </div>
              {!editing && (
                <CardDescription>
                  {activePlan.source === "ai" ? "Gerado por IA" : activePlan.source === "pdf" ? "Importado de PDF" : "Criado manualmente"} em{" "}
                  {new Date(activePlan.created_at).toLocaleDateString("pt-BR")}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {editing && editData ? (
                <div className="space-y-4">
                  {editData.days.map((day, di) => (
                    <div key={di} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input value={day.name} onChange={e => {
                          const next = { ...editData, days: [...editData.days] };
                          next.days[di] = { ...next.days[di], name: e.target.value };
                          setEditData(next);
                        }} className="h-7 text-sm font-medium flex-1" />
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeDay(di)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                      {day.exercises.map((ex, ei) => (
                        <div key={ei} className="flex items-center gap-1.5 pl-2">
                          <Input value={ex.name} onChange={e => updateExercise(di, ei, "name", e.target.value)} className="h-7 text-xs flex-1" placeholder="Exercício" />
                          <Input type="number" value={ex.sets} onChange={e => updateExercise(di, ei, "sets", parseInt(e.target.value) || 0)} className="h-7 text-xs w-14" placeholder="Séries" />
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input value={ex.reps} onChange={e => updateExercise(di, ei, "reps", e.target.value)} className="h-7 text-xs w-14" placeholder="Reps" />
                          <Input value={ex.weight || ""} onChange={e => updateExercise(di, ei, "weight", e.target.value)} className="h-7 text-xs w-16" placeholder="Carga" />
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeExercise(di, ei)}><X className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 w-full" onClick={() => addExerciseToDay(di)}>
                        <Plus className="h-3 w-3" /> Adicionar exercício
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1 w-full" onClick={addDay}>
                    <Plus className="h-3 w-3" /> Adicionar dia
                  </Button>
                </div>
              ) : activePlan.plan_data?.days ? (
                <div className="space-y-4">
                  {activePlan.plan_data.days.map((day: WorkoutDay, i: number) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{day.name}</p>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openCheckin(day)}>
                          <CheckCircle2 className="h-3 w-3" /> Check-in
                        </Button>
                      </div>
                      {day.exercises?.map((ex, j) => (
                        <div key={j} className="flex justify-between text-sm pl-3">
                          <span className="text-muted-foreground">{ex.name}</span>
                          <span>{ex.sets}x{ex.reps} {ex.weight && `· ${ex.weight}`}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {activePlan.plan_data?.raw_text || JSON.stringify(activePlan.plan_data, null, 2)}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">Nenhum plano de treino ativo</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={generatePlan} disabled={generating} className="gap-1.5">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar com IA
                </Button>
                <Button variant="outline" onClick={() => setManualOpen(true)} className="gap-1.5"><PenLine className="h-4 w-4" /> Criar manual</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other plans */}
        {plans.filter(p => !p.active).length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Planos anteriores</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {plans.filter(p => !p.active).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => activatePlan(p.id)}>Ativar</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePlan(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Workout Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" />Histórico de treinos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="py-2 border-b last:border-0">
                  {editingLogId === log.id ? (
                    <div className="space-y-3">
                      <Input value={editLogForm.workout_name} onChange={e => setEditLogForm(f => ({ ...f, workout_name: e.target.value }))} className="h-8 text-sm" placeholder="Nome do treino" />
                      <div className="grid grid-cols-3 gap-2">
                        <Input type="date" value={editLogForm.workout_date} onChange={e => setEditLogForm(f => ({ ...f, workout_date: e.target.value }))} className="h-8 text-xs" />
                        <Input type="number" value={editLogForm.duration_minutes} onChange={e => setEditLogForm(f => ({ ...f, duration_minutes: e.target.value }))} className="h-8 text-xs" placeholder="Min" />
                        <Select value={editLogForm.mood} onValueChange={v => setEditLogForm(f => ({ ...f, mood: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="otimo">😁</SelectItem>
                            <SelectItem value="bom">🙂</SelectItem>
                            <SelectItem value="normal">😐</SelectItem>
                            <SelectItem value="ruim">😓</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea value={editLogForm.notes} onChange={e => setEditLogForm(f => ({ ...f, notes: e.target.value }))} className="text-xs min-h-[60px]" placeholder="Notas..." />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs gap-1 flex-1" onClick={saveEditLog}><Save className="h-3 w-3" /> Salvar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingLogId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{log.workout_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.workout_date).toLocaleDateString("pt-BR")}
                            {log.duration_minutes && ` · ${log.duration_minutes}min`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {log.mood === "otimo" ? "😁" : log.mood === "bom" ? "🙂" : log.mood === "normal" ? "😐" : "😓"}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditLog(log)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteLog(log.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      </div>
                      {log.exercises?.length > 0 && (
                        <div className="mt-2 pl-3 space-y-1">
                          {log.exercises.map((ex: any, i: number) => (
                            <div key={i} className="text-xs text-muted-foreground flex justify-between">
                              <span>{ex.name}</span>
                              <span>{ex.sets?.map((s: any) => `${s.weight || "—"}kg×${s.reps}`).join(" | ")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Check-in dialog */}
      <Dialog open={logDialogOpen} onOpenChange={(o) => { if (!o) { setLogDialogOpen(false); setSelectedDay(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar treino{selectedDay ? ` — ${selectedDay.name}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!selectedDay && (
              <div className="space-y-2">
                <Label>Nome do treino</Label>
                <Input value={logForm.workout_name} onChange={e => setLogForm(f => ({ ...f, workout_name: e.target.value }))} placeholder="Ex: Treino A - Peito e Tríceps" />
              </div>
            )}
            {selectedDay && selectedDay.exercises.map((ex, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <p className="font-medium text-sm">{ex.name}</p>
                <div className="space-y-1">
                  {exerciseLogs[ex.name]?.sets.map((s, si) => (
                    <div key={si} className="flex gap-2 items-center">
                      <span className="text-xs text-muted-foreground w-8">S{si + 1}</span>
                      <Input type="number" placeholder="kg" className="h-8 text-xs w-20" value={s.weight}
                        onChange={e => { const next = { ...exerciseLogs }; next[ex.name].sets[si].weight = e.target.value; setExerciseLogs(next); }} />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input type="number" placeholder="reps" className="h-8 text-xs w-20" value={s.reps}
                        onChange={e => { const next = { ...exerciseLogs }; next[ex.name].sets[si].reps = e.target.value; setExerciseLogs(next); }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <Label>Data do treino</Label>
              <Input type="date" value={logForm.workout_date} onChange={e => setLogForm(f => ({ ...f, workout_date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input type="number" value={logForm.duration_minutes} onChange={e => setLogForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="60" />
              </div>
              <div className="space-y-2">
                <Label>Como foi?</Label>
                <Select value={logForm.mood} onValueChange={v => setLogForm(f => ({ ...f, mood: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="otimo">😁 Ótimo</SelectItem>
                    <SelectItem value="bom">🙂 Bom</SelectItem>
                    <SelectItem value="normal">😐 Normal</SelectItem>
                    <SelectItem value="ruim">😓 Ruim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas sobre o treino..." />
            </div>
            <Button onClick={saveLog} className="w-full">Salvar treino</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual plan dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar plano manualmente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Meu plano de treino" />
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Textarea value={manualText} onChange={e => setManualText(e.target.value)}
                placeholder={"Treino A - Peito e Tríceps\n- Supino reto 4x12\n- Supino inclinado 3x12\n\nTreino B - Costas e Bíceps\n- Puxada frontal 4x12"}
                className="min-h-[200px]" />
              <p className="text-xs text-muted-foreground">Use linhas começando com "Treino" para separar os dias e "-" para os exercícios</p>
            </div>
            <Button onClick={saveManualPlan} className="w-full">Salvar plano</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
