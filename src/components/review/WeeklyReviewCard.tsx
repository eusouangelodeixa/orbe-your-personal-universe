import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Loader2, RefreshCw, Star, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useLatestReview, useReviewHistory, useGenerateReview, WeeklyReview } from "@/hooks/useWeeklyReview";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "text-emerald-500" : score >= 6 ? "text-amber-500" : "text-red-500";
  return <span className={`text-2xl font-bold ${color}`}>{score}/10</span>;
}

export function WeeklyReviewCard() {
  const { data: latest, isLoading } = useLatestReview();
  const generate = useGenerateReview();

  if (isLoading) return <div className="animate-pulse h-40 rounded-xl bg-muted" />;

  if (!latest) return (
    <Card className="text-center py-8">
      <CardContent className="space-y-3">
        <Calendar className="h-8 w-8 text-primary mx-auto opacity-60" />
        <p className="text-sm text-muted-foreground">Nenhum review semanal ainda</p>
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Gerar Review
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Review — Semana {format(parseISO(latest.week_start), "dd/MM", { locale: ptBR })} a {format(parseISO(latest.week_end), "dd/MM", { locale: ptBR })}
          </CardTitle>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => generate.mutate()} disabled={generate.isPending}>
            <RefreshCw className={`h-3 w-3 mr-1 ${generate.isPending ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div className="flex items-center justify-between">
          {latest.overall_score && <ScoreBadge score={latest.overall_score} />}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {latest.study_hours != null && <span>📚 {latest.study_hours}h estudo</span>}
            {latest.workout_count != null && <span>💪 {latest.workout_count} treinos</span>}
            {latest.energy_avg != null && <span>⚡ {latest.energy_avg} energia</span>}
            {latest.habits_completion_pct != null && <span>🎯 {latest.habits_completion_pct}% hábitos</span>}
          </div>
        </div>

        {/* Financial health */}
        {latest.financial_health && (
          <div className={`text-xs p-2 rounded-lg ${
            latest.financial_health === "positive" ? "bg-emerald-500/10 text-emerald-600" :
            latest.financial_health === "negative" ? "bg-red-500/10 text-red-600" :
            "bg-muted text-muted-foreground"
          }`}>
            💰 Saúde financeira: {latest.financial_health === "positive" ? "Positiva" : latest.financial_health === "negative" ? "Negativa" : "Neutra"}
          </div>
        )}

        {/* Highlights */}
        {latest.highlights.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" /> Destaques</p>
            <ul className="space-y-0.5">
              {latest.highlights.map((h, i) => (
                <li key={i} className="text-xs text-emerald-600 dark:text-emerald-400">✓ {h}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Lowlights */}
        {latest.lowlights && latest.lowlights.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1 flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-500" /> Pontos de atenção</p>
            <ul className="space-y-0.5">
              {latest.lowlights.map((l, i) => (
                <li key={i} className="text-xs text-red-600 dark:text-red-400">⚠ {l}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Adjustments */}
        {latest.adjustments.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1">📋 Ajustes sugeridos</p>
            <ul className="space-y-0.5">
              {latest.adjustments.map((a, i) => (
                <li key={i} className="text-xs text-muted-foreground">→ {a}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReviewHistory() {
  const { data: reviews = [] } = useReviewHistory();
  if (!reviews.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Histórico de Reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {reviews.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
            <div className="text-center w-12 shrink-0">
              <p className={`text-lg font-bold ${(r.overall_score ?? 0) >= 7 ? "text-emerald-500" : (r.overall_score ?? 0) >= 5 ? "text-amber-500" : "text-red-500"}`}>
                {r.overall_score}
              </p>
              <p className="text-[9px] text-muted-foreground">/10</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">
                {format(parseISO(r.week_start), "dd/MM", { locale: ptBR })} — {format(parseISO(r.week_end), "dd/MM", { locale: ptBR })}
              </p>
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                {r.study_hours != null && <span>{r.study_hours}h estudo</span>}
                {r.workout_count != null && <span>{r.workout_count} treinos</span>}
                {r.habits_completion_pct != null && <span>{r.habits_completion_pct}% hábitos</span>}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
