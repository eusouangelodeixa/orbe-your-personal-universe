import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Moon, Sun, TrendingUp, Flame, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import {
  useCircadianProfile, useTodaySession, useSleepHistory, useConfirmWake,
  useCircadianScore, useCircadianInsights, useAcknowledgeInsight,
  useCircadianAdjustments, useRespondAdjustment, useCreateTodaySession,
  detectPatterns,
} from "@/hooks/useCircadia";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-red-500";
  return (
    <div className="text-center">
      <p className={`text-4xl font-bold ${color}`}>{score}</p>
      <p className="text-xs text-muted-foreground">/100</p>
    </div>
  );
}

export function CircadiaDashboardView() {
  const { data: profile } = useCircadianProfile();
  const { data: todaySession } = useTodaySession();
  const { data: sessions = [] } = useSleepHistory(14);
  const confirmWake = useConfirmWake();
  const createSession = useCreateTodaySession();
  const scoreData = useCircadianScore(14);
  const { data: insights = [] } = useCircadianInsights();
  const ackInsight = useAcknowledgeInsight();
  const { data: adjustments = [] } = useCircadianAdjustments();
  const respondAdj = useRespondAdjustment();

  const pattern = sessions.length ? detectPatterns(sessions) : null;

  // Chart data
  const chartData = sessions
    .filter((s) => s.wake_confirmed)
    .map((s) => ({
      date: format(parseISO(s.session_date), "dd/MM", { locale: ptBR }),
      planejado: parseInt(format(parseISO(s.planned_wake), "HH")) * 60 + parseInt(format(parseISO(s.planned_wake), "mm")),
      real: s.actual_wake ? parseInt(format(parseISO(s.actual_wake), "HH")) * 60 + parseInt(format(parseISO(s.actual_wake), "mm")) : null,
      score: s.score,
    }));

  return (
    <div className="space-y-4">
      {/* Top Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <ScoreGauge score={scoreData.avgScore} />
            <p className="text-xs text-muted-foreground mt-1">Score Circadiano</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-4xl font-bold text-primary flex items-center justify-center gap-1">
              <Flame className="h-5 w-5 text-amber-500" /> {scoreData.streak}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Streak (dias)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-4xl font-bold">{pattern?.avgDeviation || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Desvio médio (min)</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Session */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {todaySession?.wake_confirmed ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-400" />}
            Sessão de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!todaySession ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-muted-foreground">Nenhuma sessão gerada para hoje</p>
              <Button onClick={() => createSession.mutate()} disabled={createSession.isPending} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-1 ${createSession.isPending ? "animate-spin" : ""}`} /> Gerar sessão
              </Button>
            </div>
          ) : todaySession.wake_confirmed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">☀️ Acordou às {format(parseISO(todaySession.actual_wake!), "HH:mm")}</span>
                <Badge variant={todaySession.score! >= 80 ? "default" : todaySession.score! >= 60 ? "secondary" : "destructive"}>
                  Score: {todaySession.score}/100
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Desvio: {todaySession.deviation_minutes! > 0 ? "+" : ""}{todaySession.deviation_minutes}min
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm">Planejado: acordar às <strong>{format(parseISO(todaySession.planned_wake), "HH:mm")}</strong></p>
              <Button onClick={() => confirmWake.mutate({ sessionId: todaySession.id })} disabled={confirmWake.isPending} size="lg">
                {confirmWake.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Sun className="h-5 w-5 mr-2" />}
                Provei que acordei
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Status */}
      {profile && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Perfil: Dormir {profile.target_sleep_time.slice(0,5)} → Acordar {profile.target_wake_time.slice(0,5)}</span>
              <Badge variant="outline" className="text-[10px]">
                {pattern && pattern.consistencyPct >= 80 ? "🟢 Estável" : pattern && pattern.consistencyPct >= 50 ? "🟡 Parcial" : "🔴 Desregulado"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart: Real vs Planned */}
      {chartData.length > 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Horário real vs planejado — 14 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, "0")}`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value: number) => `${Math.floor(value / 60)}:${(value % 60).toString().padStart(2, "0")}`}
                />
                <Area type="monotone" dataKey="planejado" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 4" />
                <Area type="monotone" dataKey="real" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Planejado</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Real</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">💡 Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((ins) => (
              <div key={ins.id} className="flex items-start justify-between gap-2 p-2 rounded-lg border border-border">
                <p className="text-xs flex-1">{ins.message}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => ackInsight.mutate(ins.id)}>✓</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Adjustments */}
      {adjustments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Sugestões de ajuste
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {adjustments.map((adj) => (
              <div key={adj.id} className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
                <p className="text-xs">{adj.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Atual: <strong>{adj.current_value}</strong> → Sugerido: <strong>{adj.suggested_value}</strong>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs h-7 flex-1" onClick={() => respondAdj.mutate({ id: adj.id, accept: true })}>
                    ✅ Aceitar
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7 flex-1" onClick={() => respondAdj.mutate({ id: adj.id, accept: false })}>
                    ❌ Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recurring delays */}
      {pattern && pattern.recurring_delays.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Atraso recorrente detectado: <strong>{pattern.recurring_delays.join(", ")}</strong>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
