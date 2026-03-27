import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Flame, BookOpen, Award, RefreshCw, Loader2 } from "lucide-react";
import {
  useActivePlan, usePlanDays, useSpiritualStreak, useSpiritualProgress,
  useTodayVerse, useGenerateDailyVerse, SPIRITUAL_THEMES, useDeleteSpiritualProfile
} from "@/hooks/useSpiritual";

export function SpiritualDashboardView({ onStartPlan }: { onStartPlan: () => void }) {
  const { data: plan } = useActivePlan();
  const { data: days = [] } = usePlanDays(plan?.id ?? null);
  const { data: streak } = useSpiritualStreak();
  const { data: progress } = useSpiritualProgress();
  const { data: todayVerse } = useTodayVerse();
  const generateVerse = useGenerateDailyVerse();
  const deleteProfile = useDeleteSpiritualProfile();

  const completedDays = days.filter((d) => d.completed).length;
  const progressPct = days.length ? Math.round((completedDays / days.length) * 100) : 0;
  const themeLabel = plan
    ? Object.values(SPIRITUAL_THEMES)
        .flatMap((g) => g.themes)
        .find((t) => t.key === plan.theme)?.label || plan.theme
    : "";

  return (
    <div className="space-y-4">
      {/* Top metrics */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-primary flex items-center justify-center gap-1">
              <Flame className="h-5 w-5 text-amber-500" /> {streak?.currentStreak || 0}
            </p>
            <p className="text-xs text-muted-foreground">Sequência</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{streak?.bestStreak || 0}</p>
            <p className="text-xs text-muted-foreground">Maior streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold">{progress?.completed || 0}</p>
            <p className="text-xs text-muted-foreground">Planos concluídos</p>
          </CardContent>
        </Card>
      </div>

      {/* Active plan */}
      {plan ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Plano Ativo
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{plan.plan_type}</Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Deseja apagar seu plano atual e iniciar um novo?")) {
                      deleteProfile.mutate();
                    }
                  }}
                  disabled={deleteProfile.isPending}
                >
                  Refazer Plano
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium">{plan.title}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Dia {completedDays} / {plan.total_days}</span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </CardContent>
        </Card>
      ) : (
        <Card className="text-center py-6">
          <CardContent className="space-y-3">
            <BookOpen className="h-8 w-8 text-primary mx-auto opacity-60" />
            <p className="text-sm text-muted-foreground">Nenhum plano ativo</p>
            <Button onClick={onStartPlan}>Iniciar novo plano</Button>
          </CardContent>
        </Card>
      )}

      {/* Daily verse */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">🙏 Versículo do Dia</CardTitle>
            {!todayVerse && (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => generateVerse.mutate()} disabled={generateVerse.isPending}>
                {generateVerse.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Gerar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {todayVerse ? (
            <div className="space-y-2">
              <Badge variant="outline" className="text-xs">📖 {todayVerse.verse_reference}</Badge>
              <blockquote className="text-sm italic leading-relaxed border-l-2 border-primary/30 pl-3">
                "{todayVerse.verse_text}"
              </blockquote>
              <p className="text-xs text-muted-foreground">{todayVerse.explanation}</p>
              <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-medium">✅ {todayVerse.application}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Clique em "Gerar" para receber o versículo de hoje</p>
          )}
        </CardContent>
      </Card>

      {/* Themes studied */}
      {progress && progress.themesStudied.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" /> Temas estudados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {progress.themesStudied.map((t) => {
                const theme = Object.values(SPIRITUAL_THEMES)
                  .flatMap((g) => g.themes)
                  .find((th) => th.key === t);
                return (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {theme?.emoji} {theme?.label || t}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
