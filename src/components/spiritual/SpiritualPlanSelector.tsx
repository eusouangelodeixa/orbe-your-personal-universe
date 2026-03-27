import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2 } from "lucide-react";
import { useCreatePlan, SPIRITUAL_THEMES, PLAN_TYPES } from "@/hooks/useSpiritual";

export function SpiritualPlanSelector() {
  const create = useCreatePlan();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("intermediate");

  const handleCreate = () => {
    if (!selectedTheme) return;
    create.mutate({ theme: selectedTheme, planType: selectedType });
  };

  return (
    <div className="space-y-4">
      {/* Themes */}
      {Object.entries(SPIRITUAL_THEMES).map(([groupKey, group]) => (
        <Card key={groupKey}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{group.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {group.themes.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSelectedTheme(t.key)}
                  className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                    selectedTheme === t.key
                      ? "border-primary bg-primary/10 font-medium scale-105 shadow-sm"
                      : "border-border hover:bg-accent/50"
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Duration selector */}
      {selectedTheme && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Duração do plano</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PLAN_TYPES.map((pt) => (
              <button
                key={pt.key}
                onClick={() => setSelectedType(pt.key)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selectedType === pt.key ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{pt.label}</p>
                    <p className="text-xs text-muted-foreground">{pt.description}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{pt.days}d</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create button */}
      {selectedTheme && (
        <Button className="w-full" size="lg" onClick={handleCreate} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <BookOpen className="h-5 w-5 mr-2" />}
          Criar Plano de Estudo
        </Button>
      )}
    </div>
  );
}
