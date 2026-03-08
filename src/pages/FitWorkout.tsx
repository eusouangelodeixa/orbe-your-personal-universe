import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Dumbbell, Plus, Loader2, Sparkles, CheckCircle2, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function FitWorkout() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    workout_name: "",
    duration_minutes: "",
    mood: "bom",
    notes: "",
  });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const [plansRes, logsRes] = await Promise.all([
      supabase.from("fit_workout_plans" as any).select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("fit_workout_logs" as any).select("*").eq("user_id", user!.id).order("workout_date", { ascending: false }).limit(20),
    ]);
    setPlans((plansRes.data as any) || []);
    setLogs((logsRes.data as any) || []);
    setLoading(false);
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("fit-generate", {
        body: { type: "workout" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Plano de treino gerado! 🎉");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar plano");
    }
    setGenerating(false);
  };

  const saveLog = async () => {
    if (!logForm.workout_name) {
      toast.error("Informe o nome do treino");
      return;
    }
    const { error } = await supabase.from("fit_workout_logs" as any).insert({
      user_id: user!.id,
      workout_name: logForm.workout_name,
      duration_minutes: logForm.duration_minutes ? parseInt(logForm.duration_minutes) : null,
      mood: logForm.mood,
      notes: logForm.notes || null,
      plan_id: plans.find(p => p.active)?.id || null,
    } as any);
    if (error) {
      toast.error("Erro ao salvar treino");
    } else {
      toast.success("Treino registrado! 💪");
      setLogDialogOpen(false);
      setLogForm({ workout_name: "", duration_minutes: "", mood: "bom", notes: "" });
      loadData();
    }
  };

  const activePlan = plans.find(p => p.active);

  if (loading) {
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
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Dumbbell className="h-6 w-6 text-primary" />
              Plano de Treino
            </h1>
            <p className="text-muted-foreground text-sm">Gerado por IA ou personalizado por você</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Registrar treino
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar treino</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do treino</Label>
                    <Input
                      value={logForm.workout_name}
                      onChange={e => setLogForm(f => ({ ...f, workout_name: e.target.value }))}
                      placeholder="Ex: Treino A - Peito e Tríceps"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Duração (min)</Label>
                      <Input
                        type="number"
                        value={logForm.duration_minutes}
                        onChange={e => setLogForm(f => ({ ...f, duration_minutes: e.target.value }))}
                        placeholder="60"
                      />
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
                    <Textarea
                      value={logForm.notes}
                      onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Notas sobre o treino..."
                    />
                  </div>
                  <Button onClick={saveLog} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={generatePlan} disabled={generating} size="sm" className="gap-1.5">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar com IA
            </Button>
          </div>
        </div>

        {/* Active Plan */}
        {activePlan ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{activePlan.title}</CardTitle>
                <Badge variant="default">Ativo</Badge>
              </div>
              <CardDescription>
                Gerado por {activePlan.source === "ai" ? "IA" : "você"} em{" "}
                {new Date(activePlan.created_at).toLocaleDateString("pt-BR")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activePlan.plan_data?.days ? (
                <div className="space-y-4">
                  {activePlan.plan_data.days.map((day: any, i: number) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <p className="font-medium text-sm">{day.name}</p>
                      {day.exercises?.map((ex: any, j: number) => (
                        <div key={j} className="flex justify-between text-sm pl-3">
                          <span className="text-muted-foreground">{ex.name}</span>
                          <span>{ex.sets}x{ex.reps} {ex.weight && `· ${ex.weight}kg`}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {typeof activePlan.plan_data === "string" ? activePlan.plan_data : JSON.stringify(activePlan.plan_data, null, 2)}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">Nenhum plano de treino ativo</p>
              <Button onClick={generatePlan} disabled={generating} className="gap-1.5">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar plano com IA
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Histórico de treinos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{log.workout_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.workout_date).toLocaleDateString("pt-BR")}
                      {log.duration_minutes && ` · ${log.duration_minutes}min`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {log.mood === "otimo" ? "😁" : log.mood === "bom" ? "🙂" : log.mood === "normal" ? "😐" : "😓"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
