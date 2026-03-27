import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus } from "lucide-react";
import { useCreateHabit } from "@/hooks/useHabits";

const CATEGORIES = [
  { value: "studies", label: "Estudos", emoji: "📚" },
  { value: "fit", label: "Fitness", emoji: "💪" },
  { value: "finance", label: "Financeiro", emoji: "💰" },
  { value: "personal", label: "Pessoal", emoji: "🎯" },
  { value: "health", label: "Saúde", emoji: "❤️" },
] as const;

const FREQUENCIES = [
  { value: "daily", label: "Diário" },
  { value: "weekdays", label: "Dias úteis" },
  { value: "weekly", label: "Semanal" },
] as const;

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6", "#8b5cf6"];

export function HabitForm({ onCreated }: { onCreated?: () => void }) {
  const create = useCreateHabit();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("personal");
  const [frequency, setFrequency] = useState("daily");
  const [color, setColor] = useState("#6366f1");
  const [icon, setIcon] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    create.mutate(
      {
        title: title.trim(),
        description: null,
        frequency: frequency as any,
        category: category as any,
        linked_module: ["studies", "fit", "finance"].includes(category) ? category as any : null,
        icon: icon || null,
        color,
        target_per_period: 1,
      },
      {
        onSuccess: () => {
          setTitle("");
          setIcon("");
          onCreated?.();
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Hábito
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Ex: Meditar 10 minutos"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <Input
            placeholder="🧘"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-14 text-center"
          />
        </div>

        <div>
          <Label className="text-xs mb-1.5 block">Categoria</Label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  category === c.value ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-accent/50"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1.5 block">Frequência</Label>
          <div className="flex gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                onClick={() => setFrequency(f.value)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  frequency === f.value ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-accent/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs mb-1.5 block">Cor</Label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  color === c ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={!title.trim() || create.isPending}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          Criar Hábito
        </Button>
      </CardContent>
    </Card>
  );
}
