import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingUp, Plus, Loader2, Scale } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function FitProgress() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    weight: "",
    body_fat_pct: "",
    notes: "",
  });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const { data } = await supabase
      .from("fit_progress" as any)
      .select("*")
      .eq("user_id", user!.id)
      .order("record_date", { ascending: true });
    setRecords((data as any) || []);
    setLoading(false);
  };

  const saveRecord = async () => {
    if (!form.weight) {
      toast.error("Informe o peso");
      return;
    }
    const { error } = await supabase.from("fit_progress" as any).insert({
      user_id: user!.id,
      weight: parseFloat(form.weight),
      body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : null,
      notes: form.notes || null,
    } as any);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Registro salvo! 📊");
      setDialogOpen(false);
      setForm({ weight: "", body_fat_pct: "", notes: "" });

      // Also update fit_profiles weight
      await supabase
        .from("fit_profiles" as any)
        .update({ weight: parseFloat(form.weight) } as any)
        .eq("user_id", user!.id);

      loadData();
    }
  };

  const chartData = records.map(r => ({
    date: new Date(r.record_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    peso: parseFloat(r.weight),
    gordura: r.body_fat_pct ? parseFloat(r.body_fat_pct) : null,
  }));

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
              <TrendingUp className="h-6 w-6 text-primary" />
              Evolução
            </h1>
            <p className="text-muted-foreground text-sm">Acompanhe seu progresso</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Novo registro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar progresso</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Peso (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.weight}
                    onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                    placeholder="70.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gordura corporal % (opcional)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.body_fat_pct}
                    onChange={e => setForm(f => ({ ...f, body_fat_pct: e.target.value }))}
                    placeholder="15.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Como está se sentindo..."
                  />
                </div>
                <Button onClick={saveRecord} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Weight Chart */}
        {chartData.length > 1 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Evolução de peso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={["auto", "auto"]} className="text-xs" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="peso"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                      name="Peso (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">Registre seu peso para acompanhar a evolução</p>
              <p className="text-xs text-muted-foreground">Mínimo 2 registros para gerar o gráfico</p>
            </CardContent>
          </Card>
        )}

        {/* Records list */}
        {records.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...records].reverse().map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{parseFloat(r.weight).toFixed(1)} kg</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.record_date).toLocaleDateString("pt-BR")}
                      {r.body_fat_pct && ` · ${r.body_fat_pct}% gordura`}
                    </p>
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground max-w-[150px] truncate">{r.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
