import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Zap, ArrowLeft, LayoutDashboard, PlayCircle, BookOpen, Target,
} from "lucide-react";
import { IntensiveStudyOnboarding } from "@/components/intensive-study/IntensiveStudyOnboarding";
import { IntensiveStudyPlan } from "@/components/intensive-study/IntensiveStudyPlan";
import { IntensiveStudyExecution } from "@/components/intensive-study/IntensiveStudyExecution";
import { IntensiveStudyQuiz } from "@/components/intensive-study/IntensiveStudyQuiz";
import { IntensiveStudyDashboard } from "@/components/intensive-study/IntensiveStudyDashboard";
import {
  useIntensiveSession, useIntensiveBlocks, useTodayIntensiveSession,
} from "@/hooks/useIntensiveStudy";
import { useSubjects } from "@/hooks/useStudies";
import { toast } from "sonner";

type AppView = "home" | "onboarding" | "plan" | "execution" | "quiz";

export default function IntensiveStudy() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<AppView>("home");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    searchParams.get("session")
  );
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const { data: todaySession } = useTodayIntensiveSession();
  const { data: session } = useIntensiveSession(activeSessionId);
  const { data: blocks = [] } = useIntensiveBlocks(activeSessionId);
  const { data: subjects = [] } = useSubjects();

  // If URL has ?session= open the plan view immediately
  useEffect(() => {
    if (searchParams.get("session") && activeSessionId) {
      setView("plan");
    }
  }, []);

  // Resume today's session if it exists and user hasn't navigated away
  useEffect(() => {
    if (todaySession && view === "home") {
      setActiveSessionId(todaySession.id);
    }
  }, [todaySession]);

  const activeBlock = blocks.find((b) => b.id === activeBlockId) ?? null;
  const activeSubject = subjects.find((s) => s.id === activeBlock?.subject_id);

  const handlePlanCreated = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setSearchParams({ session: sessionId });
    setView("plan");
  };

  const handleStartExecution = (blockId: string) => {
    setActiveBlockId(blockId);
    setView("execution");
  };

  const handleBlockComplete = (blockId: string) => {
    setActiveBlockId(blockId);
    setView("quiz");
  };

  const handleQuizComplete = (score: number) => {
    setQuizScore(score);
    toast.info(`Quiz concluído com ${score}% de acerto`, {
      description: score >= 80 ? "🎉 Ótimo desempenho!" : score >= 60 ? "👍 Continue praticando." : "📌 Tópico será reforçado.",
    });
    setView("plan");
  };

  const handleSessionComplete = () => {
    setView("home");
    setActiveBlockId(null);
  };

  const VIEW_TITLES: Record<AppView, string> = {
    home: "Estudo Intensivo",
    onboarding: "Nova Sessão Intensiva",
    plan: "Plano da Sessão",
    execution: "Executando...",
    quiz: "Quiz Pós-Bloco",
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {view !== "home" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (view === "execution" || view === "quiz") setView("plan");
                    else if (view === "plan" || view === "onboarding") setView("home");
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Zap className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold font-display">{VIEW_TITLES[view]}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Motor adaptativo de recuperação acadêmica
            </p>
          </div>
          {view === "home" && (
            <Button onClick={() => setView("onboarding")} className="shrink-0">
              <Zap className="h-4 w-4 mr-1" /> Nova Sessão
            </Button>
          )}
        </div>

        {/* Onboarding */}
        {view === "onboarding" && (
          <IntensiveStudyOnboarding onPlanCreated={handlePlanCreated} />
        )}

        {/* Plan */}
        {view === "plan" && session && (
          <IntensiveStudyPlan
            session={session}
            onStartExecution={handleStartExecution}
          />
        )}

        {/* Execution */}
        {view === "execution" && session && (
          <IntensiveStudyExecution
            session={session}
            onBlockComplete={handleBlockComplete}
            onSessionComplete={handleSessionComplete}
          />
        )}

        {/* Quiz */}
        {view === "quiz" && activeBlock && session && (
          <IntensiveStudyQuiz
            block={activeBlock}
            sessionId={session.id}
            subjectName={activeSubject?.name ?? "Disciplina"}
            onComplete={handleQuizComplete}
          />
        )}

        {/* Home — tabs */}
        {view === "home" && (
          <Tabs defaultValue={todaySession ? "today" : "history"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="today" className="gap-1.5">
                <PlayCircle className="h-3.5 w-3.5" /> Hoje
                {todaySession && (
                  <Badge className="ml-1 text-xs py-0 px-1.5 h-4">
                    {todaySession.status === "running" ? "▶" : "📋"}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <LayoutDashboard className="h-3.5 w-3.5" /> Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-4">
              {todaySession ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Você tem uma sessão planejada para hoje</p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setActiveSessionId(todaySession.id);
                        setSearchParams({ session: todaySession.id });
                        setView("plan");
                      }}
                    >
                      <PlayCircle className="h-4 w-4 mr-1" /> Retomar
                    </Button>
                  </div>
                  <IntensiveStudyPlan
                    session={todaySession}
                    onStartExecution={handleStartExecution}
                  />
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Nenhuma sessão para hoje</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Crie uma sessão intensiva e o motor vai montar seu plano automaticamente
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-sm">
                    {[
                      { icon: Target, label: "Priorização por algoritmo" },
                      { icon: BookOpen, label: "Integração com Pomodoro" },
                      { icon: Zap, label: "Adaptação por quiz" },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border">
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="text-xs text-muted-foreground text-center">{label}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => setView("onboarding")}>
                    <Zap className="h-4 w-4 mr-1" /> Iniciar Sessão Intensiva
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <IntensiveStudyDashboard />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
