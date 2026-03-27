import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Moon, Sun, Coffee, Monitor, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { useSaveCircadianProfile } from "@/hooks/useCircadia";

const STEPS = ["Horários", "Comportamento", "Contexto"];

export function CircadiaOnboarding({ onComplete }: { onComplete: () => void }) {
  const save = useSaveCircadianProfile();
  const [step, setStep] = useState(0);

  // Step 1: Horários
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");
  const [flexWindow, setFlexWindow] = useState(15);

  // Step 2: Comportamento
  const [sleepLatency, setSleepLatency] = useState(15);
  const [screenUsage, setScreenUsage] = useState("medium");
  const [wakeDifficulty, setWakeDifficulty] = useState(3);
  const [consistencyLevel, setConsistencyLevel] = useState("irregular");

  // Step 3: Contexto
  const [objective, setObjective] = useState("regular_routine");
  const [caffeineUsage, setCaffeineUsage] = useState(false);
  const [caffeineCutoff, setCaffeineCutoff] = useState("14:00");

  const handleSubmit = () => {
    save.mutate(
      {
        target_wake_time: wakeTime,
        target_sleep_time: sleepTime,
        flex_window_minutes: flexWindow,
        sleep_latency_estimate: sleepLatency,
        screen_usage: screenUsage as any,
        wake_difficulty: wakeDifficulty,
        consistency_level: consistencyLevel as any,
        objective: objective as any,
        caffeine_usage: caffeineUsage,
        caffeine_cutoff: caffeineUsage ? caffeineCutoff : null,
        onboarding_completed: true,
      } as any,
      { onSuccess: onComplete }
    );
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
              i <= step ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground text-muted-foreground"
            }`}>{i + 1}</div>
            <span className={`text-xs hidden sm:inline ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Moon className="h-5 w-5 text-indigo-400" />
            {step === 0 && "Defina seus horários ideais"}
            {step === 1 && "Comportamento de sono"}
            {step === 2 && "Contexto fisiológico"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Horários */}
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1"><Sun className="h-3 w-3 text-amber-500" /> Acordar</Label>
                  <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1"><Moon className="h-3 w-3 text-indigo-400" /> Dormir</Label>
                  <Input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <Label>Flexibilidade (± minutos)</Label>
                  <span className="font-medium">±{flexWindow}min</span>
                </div>
                <Slider min={5} max={45} step={5} value={[flexWindow]} onValueChange={([v]) => setFlexWindow(v)} />
              </div>
            </>
          )}

          {/* Step 2: Comportamento */}
          {step === 1 && (
            <>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <Label>Tempo para adormecer</Label>
                  <span className="font-medium">{sleepLatency}min</span>
                </div>
                <Slider min={5} max={60} step={5} value={[sleepLatency]} onValueChange={([v]) => setSleepLatency(v)} />
              </div>

              <div>
                <Label className="text-xs mb-1.5 block flex items-center gap-1"><Monitor className="h-3 w-3" /> Uso de tela antes de dormir</Label>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setScreenUsage(v)}
                      className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${
                        screenUsage === v ? "border-primary bg-primary/10 font-medium" : "border-border"
                      }`}
                    >
                      {v === "low" ? "🟢 Baixo" : v === "medium" ? "🟡 Médio" : "🔴 Alto"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <Label>Dificuldade para acordar</Label>
                  <span className="font-medium">{wakeDifficulty}/5</span>
                </div>
                <Slider min={1} max={5} step={1} value={[wakeDifficulty]} onValueChange={([v]) => setWakeDifficulty(v)} />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Fácil</span><span>Muito difícil</span>
                </div>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">Consistência atual</Label>
                <div className="flex gap-2">
                  {[
                    { v: "irregular", l: "Irregular" },
                    { v: "somewhat", l: "Parcial" },
                    { v: "consistent", l: "Consistente" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setConsistencyLevel(o.v)}
                      className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${
                        consistencyLevel === o.v ? "border-primary bg-primary/10 font-medium" : "border-border"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 3: Contexto */}
          {step === 2 && (
            <>
              <div>
                <Label className="text-xs mb-1.5 block">Objetivo principal</Label>
                <div className="space-y-2">
                  {[
                    { v: "wake_early", l: "☀️ Acordar mais cedo" },
                    { v: "regular_routine", l: "🔄 Regular rotina" },
                    { v: "cognitive_performance", l: "🧠 Performance cognitiva" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setObjective(o.v)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm border transition-colors ${
                        objective === o.v ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-accent/50"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1"><Coffee className="h-3 w-3" /> Consome cafeína?</Label>
                  <button
                    onClick={() => setCaffeineUsage(!caffeineUsage)}
                    className={`w-12 h-6 rounded-full transition-colors ${caffeineUsage ? "bg-primary" : "bg-muted"}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${caffeineUsage ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {caffeineUsage && (
                  <div>
                    <Label className="text-xs mb-1 block">Horário de corte</Label>
                    <Input type="time" value={caffeineCutoff} onChange={(e) => setCaffeineCutoff(e.target.value)} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex gap-2 pt-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1">
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={save.isPending} className="flex-1">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Moon className="h-4 w-4 mr-1" />}
                Ativar Circadia
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
