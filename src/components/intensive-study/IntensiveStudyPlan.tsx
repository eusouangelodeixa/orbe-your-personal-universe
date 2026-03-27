import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock, Zap, CheckCircle, AlertCircle, XCircle,
  Play, BarChart3, BookOpen, Brain,
} from "lucide-react";
import {
  IntensiveStudySession, IntensiveStudyBlock,
  useIntensiveBlocks,
} from "@/hooks/useIntensiveStudy";
import { useSubjects } from "@/hooks/useStudies";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface Props {
  session: IntensiveStudySession;
  onStartExecution: (blockId: string) => void;
}

const STATUS_META: Record<string, { label: string; color: string; Icon: typeof CheckCircle }> = {
  planned: { label: "Planejado", color: "text-muted-foreground", Icon: Clock },
  running: { label: "Em execução", color: "text-blue-500", Icon: Play },
  completed: { label: "Concluído", color: "text-emerald-500", Icon: CheckCircle },
  partial: { label: "Parcial", color: "text-amber-500", Icon: AlertCircle },
  not_completed: { label: "Não concluído", color: "text-red-500", Icon: XCircle },
};

const COMPREHENSION_META = {
  understood: { label: "Entendido", color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
  partial: { label: "Parcial", color: "bg-amber-500/20 text-amber-700 dark:text-amber-400" },
  not_understood: { label: "Não entendido", color: "bg-red-500/20 text-red-700 dark:text-red-400" },
};

const GOAL_LABELS = {
  recovery: "⚡ Recuperação rápida",
  exam_prep: "📝 Preparação para prova",
  mastery: "🏆 Domínio completo",
  review: "🔄 Revisão intensiva",
};

export function IntensiveStudyPlan({ session, onStartExecution }: Props) {
  const { data: blocks = [], isLoading } = useIntensiveBlocks(session.id);
  const { data: subjects = [] } = useSubjects();

  const doneBlocks = blocks.filter((b) => b.status === "completed" || b.status === "partial");
  const totalStudyMin = doneBlocks.reduce((a, b) => a + b.duration_min, 0);
  const comprehensionRate = doneBlocks.length
    ? Math.round((doneBlocks.filter((b) => b.comprehension === "understood").length / doneBlocks.length) * 100)
    : null;

  // Group blocks by subject for the summary chart
  const bySubject: Record<string, { name: string; color: string; done: number; total: number; quizAvg: number | null }> = {};
  for (const blk of blocks) {
    const sub = subjects.find((s) => s.id === blk.subject_id);
    const key = blk.subject_id ?? "other";
    if (!bySubject[key]) {
      bySubject[key] = { name: sub?.name ?? "Livre", color: sub?.color ?? "#6366f1", done: 0, total: 0, quizAvg: null };
    }
    bySubject[key].total++;
    if (blk.status === "completed" || blk.status === "partial") {
      bySubject[key].done++;
      if (blk.quiz_score != null) {
        const prev = bySubject[key].quizAvg ?? 0;
        bySubject[key].quizAvg = Math.round((prev + blk.quiz_score) / (bySubject[key].done));
      }
    }
  }

  // Timeline data for recharts
  const timelineData = blocks.map((blk, idx) => ({
    name: `B${idx + 1}`,
    score: blk.quiz_score ?? null,
    priority: blk.priority_score,
  })).filter((d) => d.score !== null);

  const nextPendingBlock = blocks.find((b) => b.status === "planned");

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Badge variant="outline" className="mb-1">{GOAL_LABELS[session.goal]}</Badge>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {totalStudyMin} min estudados</span>
            <span>•</span>
            <span>{doneBlocks.length}/{blocks.length} blocos</span>
            {comprehensionRate !== null && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1"><Brain className="h-3.5 w-3.5" /> {comprehensionRate}% compreensão</span>
              </>
            )}
          </div>
        </div>
        {nextPendingBlock && (
          <Button onClick={() => onStartExecution(nextPendingBlock.id)}>
            <Zap className="h-4 w-4 mr-1" /> Continuar
          </Button>
        )}
      </div>

      {/* Overall progress */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progresso geral</span>
          <span>{Math.round((doneBlocks.length / Math.max(blocks.length, 1)) * 100)}%</span>
        </div>
        <Progress
          value={(doneBlocks.length / Math.max(blocks.length, 1)) * 100}
          className="h-2"
        />
      </div>

      {/* Block list timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Timeline do plano
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-80">
            <div className="space-y-0 px-4 pb-4">
              {blocks.map((blk, idx) => {
                const sub = subjects.find((s) => s.id === blk.subject_id);
                const meta = STATUS_META[blk.status] ?? STATUS_META.planned;
                const Icon = meta.Icon;
                const compMeta = blk.comprehension
                  ? COMPREHENSION_META[blk.comprehension]
                  : null;
                const isNext = blk.id === nextPendingBlock?.id;

                return (
                  <div key={blk.id} className="relative flex gap-3 py-3">
                    {/* Connector line */}
                    {idx < blocks.length - 1 && (
                      <div className="absolute left-[11px] top-9 bottom-0 w-0.5 bg-border" />
                    )}
                    {/* Icon */}
                    <div className={`shrink-0 mt-1 z-10 ${meta.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {/* Content */}
                    <div className={`flex-1 min-w-0 rounded-lg p-3 ${
                      isNext ? "border-2 border-primary bg-primary/5" : "border border-border bg-card"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {sub && (
                              <span
                                className="inline-block w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: sub.color }}
                              />
                            )}
                            <span className="font-medium text-sm truncate">{sub?.name ?? "Livre"}</span>
                            {isNext && <Badge className="text-xs py-0">Próximo</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{blk.topic}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {blk.start_time && (
                            <p className="text-xs font-mono text-muted-foreground">{blk.start_time}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{blk.duration_min}min</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${meta.color}`}>
                          {meta.label}
                        </Badge>
                        {compMeta && (
                          <Badge className={`text-xs border-0 ${compMeta.color}`}>
                            {compMeta.label}
                          </Badge>
                        )}
                        {blk.quiz_score != null && (
                          <Badge variant="secondary" className="text-xs">
                            Quiz: {Math.round(blk.quiz_score)}%
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          P: {Number(blk.priority_score).toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Per-subject breakdown */}
      {Object.keys(bySubject).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(bySubject).map(([key, s]) => (
            <Card key={key}>
              <CardContent className="py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-medium truncate">{s.name}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Blocos</span>
                  <span>{s.done}/{s.total}</span>
                </div>
                <Progress value={(s.done / Math.max(s.total, 1)) * 100} className="h-1.5 mb-2" />
                {s.quizAvg !== null && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Brain className="h-3 w-3" /> Quiz médio: <span className={`font-medium ${s.quizAvg >= 80 ? "text-emerald-500" : s.quizAvg >= 60 ? "text-amber-500" : "text-red-500"}`}>
                      {s.quizAvg}%
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Score evolution chart */}
      {timelineData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Evolução de score por bloco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [`${v}%`, "Score"]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
