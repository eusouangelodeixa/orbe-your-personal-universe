import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Play, Pause, SkipForward, CheckCircle, XCircle,
  AlertCircle, BookOpen, Coffee, ArrowRight, Zap,
  Timer, ChevronRight,
} from "lucide-react";
import {
  IntensiveStudyBlock, IntensiveStudySession,
  useIntensiveBlocks, useUpdateIntensiveBlock, useUpdateIntensiveSession,
} from "@/hooks/useIntensiveStudy";
import { useSubjects } from "@/hooks/useStudies";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  session: IntensiveStudySession;
  onBlockComplete: (blockId: string) => void;
  onSessionComplete: () => void;
}

type Phase = "focus" | "break";

export function IntensiveStudyExecution({ session, onBlockComplete, onSessionComplete }: Props) {
  const { user } = useAuth();
  const { data: blocks = [], isLoading } = useIntensiveBlocks(session.id);
  const { data: subjects = [] } = useSubjects();
  const updateBlock = useUpdateIntensiveBlock();
  const updateSession = useUpdateIntensiveSession();

  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("focus");
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const pendingBlocks = blocks.filter((b) => b.status === "planned" || b.status === "running");
  const currentBlock = pendingBlocks[currentBlockIdx] ?? null;
  const nextBlock = pendingBlocks[currentBlockIdx + 1] ?? null;
  const progressPct = blocks.length > 0
    ? Math.round(((session.completed_blocks ?? 0) / blocks.length) * 100)
    : 0;

  useEffect(() => {
    if (!currentBlock) return;
    const dur = phase === "focus" ? currentBlock.duration_min * 60 : 10 * 60;
    setTimeLeft(dur);
    setElapsed(0);
    setIsRunning(false);
  }, [currentBlock?.id, phase]);

  const playBeep = useCallback(() => {
    try {
      const ctx = audioRef.current || new AudioContext();
      audioRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.25;
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          playBeep();
          if (phase === "focus") {
            toast.success("✅ Bloco concluído! Hora da pausa.");
            setPhase("break");
          } else {
            toast.info("☕ Pausa encerrada! Próximo bloco.");
            setPhase("focus");
          }
          return 0;
        }
        return prev - 1;
      });
      setElapsed((e) => e + 1);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, phase, playBeep]);

  const handleStart = async () => {
    if (!currentBlock) return;
    setIsRunning(true);
    if (currentBlock.status === "planned") {
      updateBlock.mutate({
        id: currentBlock.id,
        sessionId: session.id,
        status: "running",
      });
      updateSession.mutate({ id: session.id, status: "running" });
    }
  };

  const markBlock = async (
    comprehension: "understood" | "partial" | "not_understood"
  ) => {
    if (!currentBlock) return;
    await updateBlock.mutateAsync({
      id: currentBlock.id,
      sessionId: session.id,
      status: "completed",
      comprehension,
    });

    // Log into pomodoro_sessions for integration
    if (user) {
      const today = new Date().toISOString().split("T")[0];
      const focusSec = currentBlock.duration_min * 60;
      const { data: existing } = await supabase
        .from("pomodoro_sessions")
        .select("id, completed_pomodoros, total_focus_seconds")
        .eq("user_id", user.id)
        .eq("subject_id", currentBlock.subject_id ?? "")
        .eq("session_date", today)
        .maybeSingle();

      const pomodoroCount = Math.floor(currentBlock.duration_min / 25);
      if (existing) {
        await supabase
          .from("pomodoro_sessions")
          .update({
            completed_pomodoros: (existing as any).completed_pomodoros + pomodoroCount,
            total_focus_seconds: (existing as any).total_focus_seconds + focusSec,
          } as any)
          .eq("id", (existing as any).id);
      } else if (currentBlock.subject_id) {
        await supabase.from("pomodoro_sessions").insert({
          user_id: user.id,
          subject_id: currentBlock.subject_id,
          completed_pomodoros: pomodoroCount,
          total_focus_seconds: focusSec,
          session_date: today,
        } as any);
      }
    }

    onBlockComplete(currentBlock.id);
    setIsRunning(false);
    setPhase("focus");

    if (currentBlockIdx >= pendingBlocks.length - 1) {
      await updateSession.mutateAsync({ id: session.id, status: "completed" });
      toast.success("🏆 Sessão intensiva concluída!");
      onSessionComplete();
    } else {
      setCurrentBlockIdx((i) => i + 1);
      toast.success("✅ Bloco marcado! Próxima disciplina carregada.");
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (!currentBlock) return (
    <Card className="text-center py-10">
      <CardContent>
        <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold mb-1">Todos os blocos concluídos!</h3>
        <p className="text-sm text-muted-foreground">Ótimo trabalho. Veja seu progresso no dashboard.</p>
        <Button className="mt-4" onClick={onSessionComplete}>Ver Dashboard</Button>
      </CardContent>
    </Card>
  );

  const subjectColor = subjects.find((s) => s.id === currentBlock.subject_id)?.color ?? "#6366f1";
  const totalTimeSec = phase === "focus" ? currentBlock.duration_min * 60 : 10 * 60;
  const progressTimer = ((totalTimeSec - timeLeft) / totalTimeSec) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Overall session progress */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progresso da sessão</span>
          <span>{session.completed_blocks ?? 0}/{blocks.length} blocos</span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* Main execution card */}
      <Card className="overflow-hidden" style={{ borderTop: `4px solid ${subjectColor}` }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <Badge
                variant="outline"
                className="mb-1 text-xs"
                style={{ borderColor: subjectColor, color: subjectColor }}
              >
                {phase === "focus" ? (
                  <><BookOpen className="h-3 w-3 mr-1" /> Foco</>
                ) : (
                  <><Coffee className="h-3 w-3 mr-1" /> Pausa</>
                )}
              </Badge>
              <CardTitle className="text-xl">{currentBlock.subject_id
                ? subjects.find((s) => s.id === currentBlock.subject_id)?.name ?? "Disciplina"
                : "Estudo Livre"}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{currentBlock.topic}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              Bloco {currentBlockIdx + 1}/{pendingBlocks.length}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Timer */}
          <div className="flex flex-col items-center gap-3">
            <div className="text-7xl font-mono font-bold tracking-tight tabular-nums">
              {formatTime(timeLeft)}
            </div>
            <Progress value={progressTimer} className="h-2 w-full max-w-xs" />
            <div className="flex items-center gap-3">
              <Button
                size="lg"
                className="h-14 w-14 rounded-full"
                onClick={isRunning ? () => setIsRunning(false) : handleStart}
              >
                {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
              </Button>
              {isRunning && (
                <Button variant="outline" size="icon" onClick={() => setIsRunning(false)} title="Pular pausa">
                  <SkipForward className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Comprehension signals — only show after starting */}
          {elapsed > 30 && phase === "focus" && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-2 text-center">Concluir este bloco como:</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="flex-col h-16 gap-1 border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-600"
                  onClick={() => markBlock("understood")}
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs">Entendi</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-col h-16 gap-1 border-amber-500/50 hover:bg-amber-500/10 text-amber-600"
                  onClick={() => markBlock("partial")}
                >
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">Parcial</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-col h-16 gap-1 border-red-500/50 hover:bg-red-500/10 text-red-600"
                  onClick={() => markBlock("not_understood")}
                >
                  <XCircle className="h-4 w-4" />
                  <span className="text-xs">Não entendi</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pomodoro mapping */}
      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground mb-2">Estrutura Pomodoro do bloco</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: Math.max(1, Math.ceil(currentBlock.duration_min / 25)) }).map((_, i) => {
              const pomLabel = i === 0 ? "Revisão inicial"
                : i === Math.ceil(currentBlock.duration_min / 25) - 1 ? "Revisão final"
                : "Exercícios / Prática";
              return (
                <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-xs">
                  <Timer className="h-3 w-3 text-primary" />
                  <span>{i + 1}. {pomLabel}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Next block preview */}
      {nextBlock && (
        <Card className="opacity-70">
          <CardContent className="py-3 flex items-center gap-3">
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Próxima disciplina</p>
              <p className="text-sm font-medium truncate">
                {subjects.find((s) => s.id === nextBlock.subject_id)?.name ?? "Disciplina"} — {nextBlock.topic}
              </p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {nextBlock.duration_min}min
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
