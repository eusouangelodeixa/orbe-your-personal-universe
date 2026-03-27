import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookHeart, Loader2, ChevronRight } from "lucide-react";
import { useSaveSpiritualProfile } from "@/hooks/useSpiritual";

const TRANSLATIONS = [
  { key: "NVI", label: "NVI", description: "Nova Versão Internacional" },
  { key: "ARA", label: "ARA", description: "Almeida Revista e Atualizada" },
  { key: "NTLH", label: "NTLH", description: "Nova Tradução na Linguagem de Hoje" },
] as const;

export function SpiritualOnboarding({ onComplete }: { onComplete: () => void }) {
  const save = useSaveSpiritualProfile();
  const [translation, setTranslation] = useState("NVI");
  const [reminderTime, setReminderTime] = useState("07:00");
  const [goal, setGoal] = useState("");

  const handleSubmit = () => {
    save.mutate(
      {
        preferred_translation: translation as any,
        reminder_time: reminderTime,
        spiritual_goal: goal || null,
        onboarding_completed: true,
      } as any,
      { onSuccess: onComplete }
    );
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BookHeart className="h-5 w-5 text-primary" /> Configurar Formação Espiritual
          </CardTitle>
          <p className="text-xs text-muted-foreground">Defina suas preferências para a jornada</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs mb-1.5 block">Tradução preferida</Label>
            <div className="space-y-2">
              {TRANSLATIONS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTranslation(t.key)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    translation === t.key ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
                  }`}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Horário do lembrete diário</Label>
            <Input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs mb-1 block">Objetivo espiritual (opcional)</Label>
            <Input
              placeholder="Ex: Fortalecer minha fé, disciplina na oração..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BookHeart className="h-4 w-4 mr-1" />}
            Iniciar Jornada Espiritual
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
