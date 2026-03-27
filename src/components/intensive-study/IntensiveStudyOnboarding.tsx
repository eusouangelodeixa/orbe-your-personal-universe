import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Zap, BookOpen, ChevronRight, ChevronLeft, Plus, Trash2,
  Target, Clock, Sun, Moon, Loader2, AlertTriangle,
} from "lucide-react";
import { useSubjects, useAcademicEvents } from "@/hooks/useStudies";
import {
  TopicInput, CircadiaConfig, computePriorityScore,
  buildAvailabilityMap, generatePlan, GeneratedBlock,
  useCreateIntensiveSession, useSaveIntensiveBlocks,
} from "@/hooks/useIntensiveStudy";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";

interface Props {
  onPlanCreated: (sessionId: string) => void;
}

const GOALS = [
  { value: "recovery", label: "Recuperação rápida", desc: "Foco nos tópicos mais críticos e urgentes", icon: "⚡" },
  { value: "exam_prep", label: "Preparação para prova", desc: "Cobertura sistemática do conteúdo da avaliação", icon: "📝" },
  { value: "mastery", label: "Domínio completo", desc: "Estudo profundo com testes de compreensão", icon: "🏆" },
  { value: "review", label: "Revisão intensiva", desc: "Revisão rápida de temas já estudados", icon: "🔄" },
] as const;

interface SubjectSelection {
  subject_id: string;
  subject_name: string;
  selected: boolean;
  difficulty: number;
  urgency: number;
  nearest_exam: string | null;
}

interface TopicRow extends TopicInput {
  id: string;
}

function generateId() {
  return Math.random().toString(36).slice(2);
}

export function IntensiveStudyOnboarding({ onPlanCreated }: Props) {
  const { user } = useAuth();
  const { data: subjects = [] } = useSubjects();
  const { data: allEvents = [] } = useAcademicEvents();
  const createSession = useCreateIntensiveSession();
  const saveBlocks = useSaveIntensiveBlocks();

  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);

  // Step 1 — Subject selection
  const [selections, setSelections] = useState<SubjectSelection[]>([]);

  // Step 2 — Topics
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [newTopicText, setNewTopicText] = useState("");
  const [topicSubjectId, setTopicSubjectId] = useState("");

  // Step 3 — Goal
  const [goal, setGoal] = useState<"recovery" | "exam_prep" | "mastery" | "review">("exam_prep");

  // Step 4 — Circadia
  const [circadia, setCircadia] = useState<CircadiaConfig>({
    wake_time: "07:00",
    sleep_time: "23:00",
    high_energy_start: "08:00",
    high_energy_end: "12:00",
  });

  // Step 5 — Generated plan preview
  const [generatedBlocks, setGeneratedBlocks] = useState<GeneratedBlock[]>([]);

  // Initialise selections when subjects load
  useEffect(() => {
    if (!subjects.length || selections.length) return;
    const today = new Date();
    const upcomingExams = allEvents.filter(
      (e) => e.type === "prova" && (e.status === "pendente" || e.status === "em_andamento")
    );
    setSelections(
      subjects.map((s) => {
        const exam = upcomingExams
          .filter((e) => e.subject_id === s.id)
          .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0];
        return {
          subject_id: s.id,
          subject_name: s.name,
          selected: false,
          difficulty: 3,
          urgency: exam ? Math.min(5, 6 - Math.max(1, differenceInDays(parseISO(exam.event_date), today))) : 3,
          nearest_exam: exam?.event_date ?? null,
        };
      })
    );
  }, [subjects, allEvents, selections.length]);

  const selectedSubs = selections.filter((s) => s.selected);

  // Auto-suggest topics from selected subjects' events when moving to step 2
  useEffect(() => {
    if (step !== 2 || !selectedSubs.length) return;
    const suggested: TopicRow[] = [];
    for (const sel of selectedSubs) {
      const events = allEvents
        .filter((e) => e.subject_id === sel.subject_id && e.content_topics)
        .slice(0, 3);
      for (const ev of events) {
        const tps = (ev.content_topics || "").split(",").map((t: string) => t.trim()).filter(Boolean);
        for (const tp of tps) {
          if (!suggested.find((s) => s.subject_id === sel.subject_id && s.topic === tp)) {
            suggested.push({
              id: generateId(),
              subject_id: sel.subject_id,
              subject_name: sel.subject_name,
              topic: tp,
              difficulty_level: sel.difficulty,
              urgency_level: sel.urgency,
              exam_date: sel.nearest_exam,
            });
          }
        }
      }
      // Always add at least one placeholder if no events
      if (!suggested.find((s) => s.subject_id === sel.subject_id)) {
        suggested.push({
          id: generateId(),
          subject_id: sel.subject_id,
          subject_name: sel.subject_name,
          topic: `Revisão geral — ${sel.subject_name}`,
          difficulty_level: sel.difficulty,
          urgency_level: sel.urgency,
          exam_date: sel.nearest_exam,
        });
      }
    }
    setTopics(suggested);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTopic = () => {
    if (!newTopicText.trim() || !topicSubjectId) return;
    const sel = selections.find((s) => s.subject_id === topicSubjectId);
    if (!sel) return;
    setTopics((prev) => [
      ...prev,
      {
        id: generateId(),
        subject_id: topicSubjectId,
        subject_name: sel.subject_name,
        topic: newTopicText.trim(),
        difficulty_level: sel.difficulty,
        urgency_level: sel.urgency,
        exam_date: sel.nearest_exam,
      },
    ]);
    setNewTopicText("");
  };

  const removeTopic = (id: string) => setTopics((prev) => prev.filter((t) => t.id !== id));

  const handleGeneratePlan = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const slots = await buildAvailabilityMap(user.id, format(new Date(), "yyyy-MM-dd"), circadia);
      if (!slots.length) {
        toast.error("Nenhum slot livre encontrado para hoje. Ajuste os horários.");
        setGenerating(false);
        return;
      }
      const blocks = generatePlan(topics, slots);
      if (!blocks.length) {
        toast.error("Não foi possível gerar blocos. Tente adicionar mais disciplinas ou ajustar os horários.");
        setGenerating(false);
        return;
      }
      setGeneratedBlocks(blocks);
      setStep(5);
    } catch {
      toast.error("Erro ao calcular disponibilidade");
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmPlan = async () => {
    if (!user || !generatedBlocks.length) return;
    setGenerating(true);
    try {
      const session = await createSession.mutateAsync({
        goal,
        status: "planned",
        plan_date: format(new Date(), "yyyy-MM-dd"),
        wake_time: circadia.wake_time,
        sleep_time: circadia.sleep_time,
        high_energy_start: circadia.high_energy_start,
        high_energy_end: circadia.high_energy_end,
        total_blocks: generatedBlocks.length,
        notes: null,
      });
      await saveBlocks.mutateAsync({ sessionId: session.id, blocks: generatedBlocks });
      toast.success(`🚀 Plano intensivo criado com ${generatedBlocks.length} blocos!`);
      onPlanCreated(session.id);
    } catch {
      toast.error("Erro ao salvar plano");
    } finally {
      setGenerating(false);
    }
  };

  const STEP_LABELS = ["Disciplinas", "Tópicos", "Objetivo", "Circadia", "Plano"];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, idx) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
              idx + 1 < step ? "bg-primary text-primary-foreground" :
              idx + 1 === step ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" :
              "bg-muted text-muted-foreground"
            }`}>
              {idx + 1 < step ? "✓" : idx + 1}
            </div>
            <span className={`text-xs hidden sm:block ${idx + 1 === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {idx < STEP_LABELS.length - 1 && (
              <div className={`h-px flex-1 transition-colors ${idx + 1 < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 — Disciplinas */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Disciplinas críticas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Selecione as disciplinas e ajuste a dificuldade e urgência para este intensivo
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {subjects.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma disciplina cadastrada ainda.</p>
              </div>
            )}
            {selections.map((sel) => (
              <div key={sel.subject_id} className={`rounded-lg border p-4 space-y-3 transition-colors ${sel.selected ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={sel.subject_id}
                    checked={sel.selected}
                    onCheckedChange={(checked) =>
                      setSelections((prev) =>
                        prev.map((s) => s.subject_id === sel.subject_id ? { ...s, selected: !!checked } : s)
                      )
                    }
                  />
                  <label htmlFor={sel.subject_id} className="font-medium cursor-pointer flex-1">
                    {sel.subject_name}
                  </label>
                  {sel.nearest_exam && (
                    <Badge variant="destructive" className="text-xs">
                      Prova em {differenceInDays(parseISO(sel.nearest_exam), new Date())}d
                    </Badge>
                  )}
                </div>
                {sel.selected && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Dificuldade</span>
                        <span className="font-medium text-foreground">{sel.difficulty}/5</span>
                      </div>
                      <Slider
                        min={1} max={5} step={1}
                        value={[sel.difficulty]}
                        onValueChange={([v]) =>
                          setSelections((prev) =>
                            prev.map((s) => s.subject_id === sel.subject_id ? { ...s, difficulty: v } : s)
                          )
                        }
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Urgência</span>
                        <span className="font-medium text-foreground">{sel.urgency}/5</span>
                      </div>
                      <Slider
                        min={1} max={5} step={1}
                        value={[sel.urgency]}
                        onValueChange={([v]) =>
                          setSelections((prev) =>
                            prev.map((s) => s.subject_id === sel.subject_id ? { ...s, urgency: v } : s)
                          )
                        }
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Score de prioridade:{" "}
                      <span className="font-bold text-primary">
                        {computePriorityScore(sel.difficulty, sel.urgency, sel.nearest_exam).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <Button
              className="w-full"
              disabled={!selectedSubs.length}
              onClick={() => setStep(2)}
            >
              Continuar <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Tópicos */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Tópicos de estudo
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Tópicos sugeridos automaticamente. Edite ou adicione os seus.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {topics.map((t) => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.topic}</p>
                    <p className="text-xs text-muted-foreground">{t.subject_name}</p>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeTopic(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {!topics.length && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum tópico ainda. Adicione abaixo.
                </p>
              )}
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label className="text-sm">Adicionar tópico</Label>
              <div className="flex gap-2">
                <select
                  className="flex h-9 w-auto rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={topicSubjectId}
                  onChange={(e) => setTopicSubjectId(e.target.value)}
                >
                  <option value="">Disciplina...</option>
                  {selectedSubs.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
                  ))}
                </select>
                <Input
                  placeholder="Nome do tópico"
                  value={newTopicText}
                  onChange={(e) => setNewTopicText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTopic()}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={addTopic}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={!topics.length} className="flex-1">
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Objetivo */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Objetivo do intensivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={goal} onValueChange={(v) => setGoal(v as typeof goal)}>
              {GOALS.map((g) => (
                <div
                  key={g.value}
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    goal === g.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                  }`}
                  onClick={() => setGoal(g.value)}
                >
                  <RadioGroupItem value={g.value} id={g.value} className="mt-0.5" />
                  <div>
                    <label htmlFor={g.value} className="font-medium cursor-pointer">
                      {g.icon} {g.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Circadia */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-amber-500" />
              Janela Circadiana
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Informe seus horários para que o motor respeite sua energia biológica
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Sun className="h-3.5 w-3.5 text-amber-500" /> Acordar
                </Label>
                <Input
                  type="time"
                  value={circadia.wake_time}
                  onChange={(e) => setCircadia((c) => ({ ...c, wake_time: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Moon className="h-3.5 w-3.5 text-blue-500" /> Dormir
                </Label>
                <Input
                  type="time"
                  value={circadia.sleep_time}
                  onChange={(e) => setCircadia((c) => ({ ...c, sleep_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                ⚡ Janela de alta energia (blocos pesados serão agendados aqui)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="time"
                    value={circadia.high_energy_start}
                    onChange={(e) => setCircadia((c) => ({ ...c, high_energy_start: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Input
                    type="time"
                    value={circadia.high_energy_end}
                    onChange={(e) => setCircadia((c) => ({ ...c, high_energy_end: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleGeneratePlan} disabled={generating} className="flex-1">
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                {generating ? "Gerando..." : "Gerar Plano"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5 — Preview do plano */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Plano Gerado — {format(new Date(), "dd/MM/yyyy")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {generatedBlocks.length} blocos de estudo distribuídos pela sua janela disponível
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {generatedBlocks.map((blk, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <div className="text-center w-14 shrink-0">
                  <p className="text-xs font-mono text-muted-foreground">{blk.start_time}</p>
                  <p className="text-xs text-muted-foreground">{blk.duration_min}min</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{blk.subject_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{blk.topic}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    variant={blk.priority_score >= 4 ? "destructive" : blk.priority_score >= 3 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    P: {blk.priority_score.toFixed(1)}
                  </Badge>
                  <div className="flex gap-1">
                    <span className="text-xs text-muted-foreground">D:{blk.difficulty_level}</span>
                    <span className="text-xs text-muted-foreground">U:{blk.urgency_level}</span>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(4)} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" /> Ajustar
              </Button>
              <Button onClick={handleConfirmPlan} disabled={generating} className="flex-1 bg-primary">
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                {generating ? "Salvando..." : "Iniciar Intensivo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
