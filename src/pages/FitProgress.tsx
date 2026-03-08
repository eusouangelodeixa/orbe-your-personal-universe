import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Plus, Loader2, Scale, Camera, Image, Dumbbell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function FitProgress() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState({ weight: "", body_fat_pct: "", notes: "" });
  const [photos, setPhotos] = useState<string[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);

  // Exercise selection for charts
  const [selectedExercise, setSelectedExercise] = useState<string>("");

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const [progRes, logsRes] = await Promise.all([
      supabase.from("fit_progress" as any).select("*").eq("user_id", user!.id).order("record_date", { ascending: true }),
      supabase.from("fit_workout_logs" as any).select("*").eq("user_id", user!.id).order("workout_date", { ascending: true }),
    ]);
    setRecords((progRes.data as any) || []);
    setWorkoutLogs((logsRes.data as any) || []);
    setLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingPhoto(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${user!.id}/progress-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("fit-photos").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("fit-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setPhotos(prev => [...prev, ...urls]);
    setUploadingPhoto(false);
    if (photoRef.current) photoRef.current.value = "";
  };

  const saveRecord = async () => {
    if (!form.weight) { toast.error("Informe o peso"); return; }
    const { error } = await supabase.from("fit_progress" as any).insert({
      user_id: user!.id,
      weight: parseFloat(form.weight),
      body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : null,
      notes: form.notes || null,
      photos: photos.length > 0 ? photos : null,
    } as any);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Registro salvo! 📊");
    setDialogOpen(false);
    setForm({ weight: "", body_fat_pct: "", notes: "" });
    setPhotos([]);
    await supabase.from("fit_profiles" as any).update({ weight: parseFloat(form.weight) } as any).eq("user_id", user!.id);
    loadData();
  };

  // Weight chart data
  const weightData = records.map(r => ({
    date: new Date(r.record_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    peso: parseFloat(r.weight),
    gordura: r.body_fat_pct ? parseFloat(r.body_fat_pct) : null,
  }));

  // Exercise evolution data
  const allExercises = new Set<string>();
  workoutLogs.forEach(log => {
    log.exercises?.forEach((ex: any) => {
      if (ex.name && ex.sets?.length) allExercises.add(ex.name);
    });
  });
  const exerciseList = Array.from(allExercises);

  const exerciseChartData = selectedExercise ? workoutLogs
    .filter(log => log.exercises?.some((ex: any) => ex.name === selectedExercise && ex.sets?.length))
    .map(log => {
      const ex = log.exercises.find((e: any) => e.name === selectedExercise);
      const maxWeight = Math.max(...ex.sets.map((s: any) => parseFloat(s.weight) || 0));
      const maxReps = Math.max(...ex.sets.map((s: any) => parseInt(s.reps) || 0));
      return {
        date: new Date(log.workout_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        carga: maxWeight,
        reps: maxReps,
      };
    }) : [];

  // Photos from progress records
  const allPhotos = records
    .filter(r => r.photos?.length)
    .flatMap(r => r.photos.map((url: string) => ({ url, date: r.record_date, weight: r.weight })));

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" /> Evolução
            </h1>
            <p className="text-muted-foreground text-sm">Acompanhe seu progresso completo</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Novo registro</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar progresso</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Peso (kg)</Label>
                  <Input type="number" step="0.1" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="70.0" />
                </div>
                <div className="space-y-2">
                  <Label>Gordura corporal % (opcional)</Label>
                  <Input type="number" step="0.1" value={form.body_fat_pct} onChange={e => setForm(f => ({ ...f, body_fat_pct: e.target.value }))} placeholder="15.0" />
                </div>
                <div className="space-y-2">
                  <Label>Fotos de progresso</Label>
                  <div className="flex gap-2 flex-wrap">
                    {photos.map((url, i) => (
                      <img key={i} src={url} alt="Progresso" className="w-20 h-20 rounded-lg object-cover" />
                    ))}
                    <Button variant="outline" size="sm" className="h-20 w-20 gap-1 flex-col" onClick={() => photoRef.current?.click()} disabled={uploadingPhoto}>
                      {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-5 w-5" />}
                      <span className="text-xs">Foto</span>
                    </Button>
                    <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Como está se sentindo..." />
                </div>
                <Button onClick={saveRecord} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="weight">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weight">Peso</TabsTrigger>
            <TabsTrigger value="exercises">Exercícios</TabsTrigger>
            <TabsTrigger value="photos">Fotos</TabsTrigger>
          </TabsList>

          {/* Weight tab */}
          <TabsContent value="weight" className="space-y-4">
            {weightData.length > 1 ? (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4" />Evolução de peso</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis domain={["auto", "auto"]} className="text-xs" />
                        <Tooltip />
                        <Line type="monotone" dataKey="peso" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} name="Peso (kg)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Registre seu peso para ver o gráfico</p>
                  <p className="text-xs text-muted-foreground">Mínimo 2 registros</p>
                </CardContent>
              </Card>
            )}

            {/* Records list */}
            {records.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[...records].reverse().map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        {r.photos?.length > 0 && (
                          <img src={r.photos[0]} alt="" className="w-10 h-10 rounded object-cover" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{parseFloat(r.weight).toFixed(1)} kg</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(r.record_date).toLocaleDateString("pt-BR")}
                            {r.body_fat_pct && ` · ${r.body_fat_pct}% gordura`}
                          </p>
                        </div>
                      </div>
                      {r.notes && <p className="text-xs text-muted-foreground max-w-[150px] truncate">{r.notes}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Exercises evolution tab */}
          <TabsContent value="exercises" className="space-y-4">
            {exerciseList.length > 0 ? (
              <>
                <div className="space-y-2">
                  <Label>Exercício</Label>
                  <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                    <SelectTrigger><SelectValue placeholder="Selecione um exercício" /></SelectTrigger>
                    <SelectContent>
                      {exerciseList.map(ex => (
                        <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {exerciseChartData.length > 1 ? (
                  <Card>
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Dumbbell className="h-4 w-4" />Evolução de carga</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={exerciseChartData}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip />
                            <Bar dataKey="carga" fill="hsl(var(--primary))" name="Carga (kg)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                ) : selectedExercise ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">Registre este exercício mais vezes para ver a evolução</p>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Registre treinos com carga para acompanhar a evolução</p>
                  <p className="text-xs text-muted-foreground">Use o check-in no plano de treino</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Photos tab */}
          <TabsContent value="photos" className="space-y-4">
            {allPhotos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {allPhotos.map((photo, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden">
                    <img src={photo.url} alt="Progresso" className="w-full aspect-square object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                      <p className="text-white text-xs">{new Date(photo.date).toLocaleDateString("pt-BR")}</p>
                      <p className="text-white/80 text-xs">{parseFloat(photo.weight).toFixed(1)} kg</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhuma foto de progresso</p>
                  <p className="text-xs text-muted-foreground">Adicione fotos ao registrar seu progresso</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
