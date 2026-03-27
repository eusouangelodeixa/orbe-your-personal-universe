import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass, Loader2, RefreshCw, ThumbsUp, Minus, ThumbsDown } from "lucide-react";
import { useTodayRecommendation, useGenerateRecommendation, useGiveFeedback, RecommendationItem } from "@/hooks/useDecisionEngine";

const PRIORITY_COLORS = {
  high: "border-l-red-500 bg-red-500/5",
  medium: "border-l-amber-500 bg-amber-500/5",
  low: "border-l-blue-500 bg-blue-500/5",
};

export function DailyRecommendation() {
  const { data: rec, isLoading } = useTodayRecommendation();
  const generate = useGenerateRecommendation();
  const giveFeedback = useGiveFeedback();

  if (isLoading) return <div className="animate-pulse h-32 rounded-xl bg-muted" />;

  if (!rec) return (
    <Card>
      <CardContent className="py-6 text-center space-y-3">
        <Compass className="h-8 w-8 text-primary mx-auto opacity-60" />
        <p className="text-sm text-muted-foreground">Motor de Decisão ainda não gerou recomendações para hoje</p>
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Compass className="h-4 w-4 mr-1" />}
          Gerar Recomendações
        </Button>
      </CardContent>
    </Card>
  );

  const recs: RecommendationItem[] = Array.isArray(rec.recommendations) ? rec.recommendations : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" /> Recomendações do Motor
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${generate.isPending ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        {rec.energy_snapshot && (
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
            <span>⚡ E:{(rec.energy_snapshot as any).energy}/5</span>
            <span>🧠 F:{(rec.energy_snapshot as any).fatigue}/5</span>
            <span>💪 M:{(rec.energy_snapshot as any).motivation}/5</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {recs.map((r, idx) => (
          <div key={idx} className={`p-3 rounded-lg border-l-4 ${PRIORITY_COLORS[r.priority]}`}>
            <div className="flex items-start gap-2">
              <span className="text-sm shrink-0">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1 italic">{r.reason}</p>
              </div>
              <Badge
                variant={r.priority === "high" ? "destructive" : r.priority === "medium" ? "default" : "secondary"}
                className="text-[10px] h-4 shrink-0"
              >
                {r.priority === "high" ? "Alta" : r.priority === "medium" ? "Média" : "Baixa"}
              </Badge>
            </div>
          </div>
        ))}

        {/* Feedback */}
        {!rec.feedback && (
          <div className="flex items-center justify-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Útil?</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => giveFeedback.mutate({ id: rec.id, feedback: "helpful" })}
            >
              <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => giveFeedback.mutate({ id: rec.id, feedback: "neutral" })}
            >
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => giveFeedback.mutate({ id: rec.id, feedback: "not_helpful" })}
            >
              <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        )}
        {rec.feedback && (
          <p className="text-xs text-muted-foreground text-center pt-2 border-t">
            Feedback registrado — obrigado!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
