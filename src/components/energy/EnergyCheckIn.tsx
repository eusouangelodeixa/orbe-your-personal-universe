import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Zap, Brain, Heart, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTodayEnergy, useEnergyTrend, useLogEnergy, getEnergyRecommendation, EnergyLog } from "@/hooks/useEnergy";

const MOOD_OPTIONS = [
  { value: "great", label: "Ótimo", emoji: "😄" },
  { value: "good", label: "Bem", emoji: "🙂" },
  { value: "neutral", label: "Neutro", emoji: "😐" },
  { value: "low", label: "Baixo", emoji: "😞" },
  { value: "bad", label: "Péssimo", emoji: "😩" },
] as const;

export function EnergyCheckIn() {
  const { data: todayLog, isLoading } = useTodayEnergy();
  const trend = useEnergyTrend(7);
  const logEnergy = useLogEnergy();

  const [energy, setEnergy] = useState(3);
  const [fatigue, setFatigue] = useState(3);
  const [motivation, setMotivation] = useState(3);
  const [mood, setMood] = useState<string>("neutral");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);

  const rec = getEnergyRecommendation(
    todayLog?.energy_level ?? energy,
    todayLog?.mental_fatigue ?? fatigue,
    todayLog?.motivation ?? motivation
  );

  const TrendIcon = trend.trend === "rising" ? TrendingUp : trend.trend === "falling" ? TrendingDown : Minus;

  const handleSubmit = () => {
    logEnergy.mutate(
      { energy_level: energy, mental_fatigue: fatigue, motivation, mood: mood as any, notes: notes || null },
      { onSuccess: () => setShowForm(false) }
    );
  };

  if (isLoading) return <div className="animate-pulse h-32 rounded-xl bg-muted" />;

  // Already checked in today — show summary
  if (todayLog && !showForm) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Energia hoje
            </CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowForm(true)}>
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center p-2 rounded-lg bg-amber-500/10">
              <p className="text-2xl font-bold text-amber-500">{todayLog.energy_level}</p>
              <p className="text-[10px] text-muted-foreground">Energia</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-500/10">
              <p className="text-2xl font-bold text-red-500">{todayLog.mental_fatigue}</p>
              <p className="text-[10px] text-muted-foreground">Fadiga</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-500/10">
              <p className="text-2xl font-bold text-blue-500">{todayLog.motivation}</p>
              <p className="text-[10px] text-muted-foreground">Motivação</p>
            </div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-card space-y-1">
            <p className="text-sm font-medium">{rec.icon} {rec.label}</p>
            <p className="text-xs text-muted-foreground">{rec.description}</p>
          </div>
          {trend.avgEnergy > 0 && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <TrendIcon className={`h-3.5 w-3.5 ${trend.trend === "rising" ? "text-emerald-500" : trend.trend === "falling" ? "text-red-500" : ""}`} />
              <span>Média 7d: {trend.avgEnergy} energia · {trend.avgFatigue} fadiga</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Check-in form
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" /> Check-in de Energia
        </CardTitle>
        <p className="text-xs text-muted-foreground">Como você está se sentindo agora?</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <Label className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" /> Energia</Label>
              <span className="font-medium">{energy}/5</span>
            </div>
            <Slider min={1} max={5} step={1} value={[energy]} onValueChange={([v]) => setEnergy(v)} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <Label className="flex items-center gap-1"><Brain className="h-3 w-3 text-red-500" /> Fadiga mental</Label>
              <span className="font-medium">{fatigue}/5</span>
            </div>
            <Slider min={1} max={5} step={1} value={[fatigue]} onValueChange={([v]) => setFatigue(v)} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <Label className="flex items-center gap-1"><Heart className="h-3 w-3 text-blue-500" /> Motivação</Label>
              <span className="font-medium">{motivation}/5</span>
            </div>
            <Slider min={1} max={5} step={1} value={[motivation]} onValueChange={([v]) => setMotivation(v)} />
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1.5 block">Humor</Label>
          <div className="flex gap-2">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMood(m.value)}
                className={`flex-1 p-2 rounded-lg border text-center transition-colors ${
                  mood === m.value ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
                }`}
              >
                <span className="text-lg">{m.emoji}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
              </button>
            ))}
          </div>
        </div>

        <Textarea
          placeholder="Observações (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm"
        />

        {/* Preview recommendation */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs font-medium">{rec.icon} Recomendação: {rec.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={logEnergy.isPending}>
          {logEnergy.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
          Registrar Energia
        </Button>
      </CardContent>
    </Card>
  );
}
