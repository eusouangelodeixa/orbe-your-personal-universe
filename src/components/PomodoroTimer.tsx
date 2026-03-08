import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, RotateCcw, SkipForward, Coffee, BookOpen, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Phase = "focus" | "short_break" | "long_break";

const PHASE_CONFIG: Record<Phase, { label: string; icon: typeof BookOpen; minutes: number; color: string }> = {
  focus: { label: "Foco", icon: BookOpen, minutes: 25, color: "text-primary" },
  short_break: { label: "Pausa Curta", icon: Coffee, minutes: 5, color: "text-emerald-500" },
  long_break: { label: "Pausa Longa", icon: Coffee, minutes: 15, color: "text-blue-500" },
};

interface Props {
  subjectName: string;
  subjectId: string;
}

export function PomodoroTimer({ subjectName, subjectId }: Props) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("focus");
  const [timeLeft, setTimeLeft] = useState(PHASE_CONFIG.focus.minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [totalFocusSeconds, setTotalFocusSeconds] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [todayStats, setTodayStats] = useState<{ pomodoros: number; focusMin: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load today's stats
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("pomodoro_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)
      .eq("session_date", today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTodayStats({
            pomodoros: (data as any).completed_pomodoros,
            focusMin: Math.floor((data as any).total_focus_seconds / 60),
          });
        }
      });
  }, [user, subjectId]);

  const saveSession = useCallback(async (pomodoros: number, focusSec: number) => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    
    // Check if session exists for today
    const { data: existing } = await supabase
      .from("pomodoro_sessions")
      .select("id, completed_pomodoros, total_focus_seconds")
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)
      .eq("session_date", today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("pomodoro_sessions")
        .update({
          completed_pomodoros: (existing as any).completed_pomodoros + pomodoros,
          total_focus_seconds: (existing as any).total_focus_seconds + focusSec,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", (existing as any).id);
    } else {
      await supabase.from("pomodoro_sessions").insert({
        user_id: user.id,
        subject_id: subjectId,
        completed_pomodoros: pomodoros,
        total_focus_seconds: focusSec,
        session_date: today,
      } as any);
    }

    setTodayStats(prev => ({
      pomodoros: (prev?.pomodoros || 0) + pomodoros,
      focusMin: Math.floor(((prev?.focusMin || 0) * 60 + focusSec) / 60),
    }));
  }, [user, subjectId]);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = audioRef.current || new AudioContext();
      audioRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);
      }, 400);
    } catch {}
  }, [soundEnabled]);

  const switchPhase = useCallback((next: Phase) => {
    setPhase(next);
    setTimeLeft(PHASE_CONFIG[next].minutes * 60);
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          playBeep();
          if (phase === "focus") {
            const next = completedPomodoros + 1;
            setCompletedPomodoros(next);
            // Save completed pomodoro with focus time
            const focusTime = PHASE_CONFIG.focus.minutes * 60;
            saveSession(1, focusTime);
            toast.success(`🎉 Pomodoro #${next} concluído!`);
            const nextPhase = next % 4 === 0 ? "long_break" : "short_break";
            setTimeout(() => switchPhase(nextPhase), 500);
          } else {
            toast.info("Pausa finalizada! Hora de focar 🚀");
            setTimeout(() => switchPhase("focus"), 500);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, phase, completedPomodoros, playBeep, switchPhase, saveSession]);

  const totalSeconds = PHASE_CONFIG[phase].minutes * 60;
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const reset = () => {
    setIsRunning(false);
    setTimeLeft(PHASE_CONFIG[phase].minutes * 60);
  };

  const skip = () => {
    if (phase === "focus") {
      const nextPhase = (completedPomodoros + 1) % 4 === 0 ? "long_break" : "short_break";
      switchPhase(nextPhase);
    } else {
      switchPhase("focus");
    }
  };

  const PhaseIcon = PHASE_CONFIG[phase].icon;

  return (
    <div className="space-y-4">
      {/* Timer Card */}
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-6">
            <div className="flex items-center gap-2">
              <PhaseIcon className={`h-5 w-5 ${PHASE_CONFIG[phase].color}`} />
              <span className={`font-semibold text-lg ${PHASE_CONFIG[phase].color}`}>
                {PHASE_CONFIG[phase].label}
              </span>
              {phase === "focus" && (
                <Badge variant="outline" className="text-xs ml-2">{subjectName}</Badge>
              )}
            </div>

            <div className="text-7xl font-mono font-bold tracking-tight tabular-nums text-foreground">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>

            <Progress value={progress} className="h-2 w-full max-w-xs" />

            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={reset} title="Reiniciar">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="lg" className="h-14 w-14 rounded-full" onClick={() => setIsRunning(!isRunning)}>
                {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
              </Button>
              <Button variant="outline" size="icon" onClick={skip} title="Pular">
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setSoundEnabled(!soundEnabled)}>
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5 mr-1" /> : <VolumeX className="h-3.5 w-3.5 mr-1" />}
              {soundEnabled ? "Som ligado" : "Som desligado"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-primary">{completedPomodoros}</p>
            <p className="text-xs text-muted-foreground">Sessão atual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-primary">{4 - (completedPomodoros % 4)}</p>
            <p className="text-xs text-muted-foreground">Até pausa longa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-primary">{todayStats?.pomodoros || 0}</p>
            <p className="text-xs text-muted-foreground">Pomodoros hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-primary">{todayStats?.focusMin || 0}</p>
            <p className="text-xs text-muted-foreground">Min. foco hoje</p>
          </CardContent>
        </Card>
      </div>

      {/* Pomodoro dots */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Progresso da sessão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: Math.max(completedPomodoros, 4) }).map((_, i) => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full transition-colors ${i < completedPomodoros ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          {completedPomodoros === 0 && (
            <p className="text-xs text-muted-foreground mt-2">Inicie seu primeiro pomodoro para estudar {subjectName}!</p>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Técnica Pomodoro:</strong> 25 min de foco → 5 min de pausa. A cada 4 ciclos, faça uma pausa longa de 15 min.
            Use o tempo de foco para revisar, resolver exercícios ou ler a ementa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
