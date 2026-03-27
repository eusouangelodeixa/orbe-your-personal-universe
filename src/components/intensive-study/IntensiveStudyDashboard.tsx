import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, BookOpen, Brain, Clock, TrendingUp, AlertTriangle, Zap
} from "lucide-react";
import { useIntensiveSessions, useIntensiveBlocks } from "@/hooks/useIntensiveStudy";
import { useSubjects } from "@/hooks/useStudies";
import { format, parseISO, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function SessionRow({ sessionId }: { sessionId: string }) {
  const { data: blocks = [] } = useIntensiveBlocks(sessionId);
  const done = blocks.filter((b) => b.status === "completed" || b.status === "partial");
  const understood = done.filter((b) => b.comprehension === "understood").length;
  const comprehension = done.length ? Math.round((understood / done.length) * 100) : null;
  const totalMin = done.reduce((a, b) => a + b.duration_min, 0);
  return { blocks, done, comprehension, totalMin };
}

export function IntensiveStudyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: sessions = [] } = useIntensiveSessions();
  const { data: subjects = [] } = useSubjects();

  // Aggregate stats across all sessions
  const { data: allBlocks = [] } = useQuery({
    queryKey: ["intensive_all_blocks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intensive_study_blocks")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const doneBlocks = allBlocks.filter((b) => b.status === "completed" || b.status === "partial");
  const totalHours = Math.round(doneBlocks.reduce((a: number, b: any) => a + b.duration_min, 0) / 60 * 10) / 10;
  const globalComprehension = doneBlocks.length
    ? Math.round((doneBlocks.filter((b: any) => b.comprehension === "understood").length / doneBlocks.length) * 100)
    : 0;
  const sessionsThisWeek = sessions.filter((s) =>
    parseISO(s.created_at) >= subWeeks(new Date(), 1)
  ).length;

  // Needs attention: subjects with avg quiz < 60%
  const bySubject: Record<string, { name: string; color: string; quizScores: number[] }> = {};
  for (const blk of allBlocks) {
    if (blk.subject_id && blk.quiz_score != null) {
      const sub = subjects.find((s: any) => s.id === blk.subject_id);
      if (!bySubject[blk.subject_id]) {
        bySubject[blk.subject_id] = { name: sub?.name ?? "Desconhecida", color: sub?.color ?? "#6366f1", quizScores: [] };
      }
      bySubject[blk.subject_id].quizScores.push(blk.quiz_score);
    }
  }
  const subjectStats = Object.entries(bySubject).map(([id, s]) => ({
    id,
    name: s.name,
    color: s.color,
    avgScore: Math.round(s.quizScores.reduce((a, b) => a + b, 0) / s.quizScores.length),
    sessions: s.quizScores.length,
  })).sort((a, b) => a.avgScore - b.avgScore);

  const needsAttention = subjectStats.filter((s) => s.avgScore < 60);

  // Weekly chart data (sessions per day this week)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return format(d, "yyyy-MM-dd");
  });
  const weekData = weekDays.map((day) => ({
    label: format(parseISO(day), "EEE", { locale: ptBR }),
    blocos: allBlocks.filter((b: any) => b.created_at?.startsWith(day) && (b.status === "completed" || b.status === "partial")).length,
  }));

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="py-4">
            <p className="text-2xl font-bold font-display text-primary">{totalHours}h</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Total estudado
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="py-4">
            <p className="text-2xl font-bold font-display text-emerald-500">{globalComprehension}%</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Brain className="h-3 w-3" /> Compreensão
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="py-4">
            <p className="text-2xl font-bold font-display text-blue-500">{sessions.length}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Sessões totais
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="py-4">
            <p className="text-2xl font-bold font-display text-amber-500">{sessionsThisWeek}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Esta semana
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Blocos concluídos — últimos 7 dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="blocos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Disciplinas que precisam de atenção (quiz &lt; 60%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {needsAttention.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-sm flex-1">{s.name}</span>
                <Badge variant="destructive" className="text-xs">{s.avgScore}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Per-subject performance */}
      {subjectStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Desempenho por disciplina
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subjectStats.map((s) => (
              <div key={s.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span>{s.name}</span>
                  </div>
                  <span className={`text-xs font-medium ${
                    s.avgScore >= 80 ? "text-emerald-500" : s.avgScore >= 60 ? "text-amber-500" : "text-red-500"
                  }`}>{s.avgScore}%</span>
                </div>
                <Progress value={s.avgScore} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sessões recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/estudos/intensivo?session=${s.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {format(parseISO(s.plan_date), "dd MMM yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.completed_blocks}/{s.total_blocks} blocos
                  </p>
                </div>
                <Badge
                  variant={s.status === "completed" ? "default" : s.status === "running" || s.status === "planned" ? "outline" : "secondary"}
                  className="text-xs"
                >
                  {s.status === "completed" ? "Concluído" :
                   s.status === "running" ? "Em progresso" :
                   s.status === "planned" ? "Planejado" :
                   s.status === "partial" ? "Parcial" : "Não concluído"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 && (
        <Card className="text-center py-10">
          <CardContent>
            <Zap className="h-10 w-10 text-primary mx-auto mb-2 opacity-60" />
            <p className="text-sm text-muted-foreground">Nenhuma sessão intensiva ainda.</p>
            <Button className="mt-3" onClick={() => navigate("/estudos/intensivo")}>
              Criar primeira sessão
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
