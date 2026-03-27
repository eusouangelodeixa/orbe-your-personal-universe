import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Brain, Loader2, ChevronRight, AlertCircle } from "lucide-react";
import { IntensiveStudyBlock, useSaveQuizResults } from "@/hooks/useIntensiveStudy";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface QuizQuestion {
  question: string;
  expectedAnswer: string; // used for self-assessment hint
  difficulty: 1 | 2 | 3;
}

interface AnswerState {
  question: string;
  user_answer: string;
  is_correct: boolean;
  response_time_s: number;
  confidence: number;
}

interface Props {
  block: IntensiveStudyBlock;
  sessionId: string;
  subjectName: string;
  onComplete: (score: number) => void;
}

async function generateQuizQuestions(
  topic: string,
  subjectName: string,
  difficulty: number
): Promise<QuizQuestion[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const resp = await supabase.functions.invoke("agent-orchestrator", {
      body: {
        stream: false,
        agent: "studies_central",
        messages: [
          {
            role: "user",
            content: `Você é um gerador de questões para estudo intensivo. Gere exatamente 3 questões sobre o tópico abaixo.

Disciplina: ${subjectName}
Tópico: ${topic}
Nível de dificuldade do aluno: ${difficulty}/5

REGRAS:
- Gere questões abertas (não múltipla escolha)
- Dificuldade progressiva: 1 fácil, 1 média, 1 difícil
- Para cada questão, inclua uma dica de resposta esperada
- Responda APENAS com um JSON válido no formato:
[
  {"question": "...", "expectedAnswer": "...", "difficulty": 1},
  {"question": "...", "expectedAnswer": "...", "difficulty": 2},
  {"question": "...", "expectedAnswer": "...", "difficulty": 3}
]
Não adicione outros campos nem texto fora do JSON.`,
          },
        ],
      },
    });

    const content = resp.data?.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallbackQuestions(topic);
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || !parsed.length) return fallbackQuestions(topic);
    return parsed.slice(0, 5) as QuizQuestion[];
  } catch {
    return fallbackQuestions(topic);
  }
}

function fallbackQuestions(topic: string): QuizQuestion[] {
  return [
    { question: `Explique em suas próprias palavras o conceito de: ${topic}`, expectedAnswer: "Explicação conceitual do tópico", difficulty: 1 },
    { question: `Cite um exemplo prático de aplicação de: ${topic}`, expectedAnswer: "Exemplo real ou exercício do tópico", difficulty: 2 },
    { question: `Qual é a principal dificuldade ou ponto crítico quando se trabalha com: ${topic}?`, expectedAnswer: "Ponto avançado / pegadinha do tópico", difficulty: 3 },
  ];
}

export function IntensiveStudyQuiz({ block, sessionId, subjectName, onComplete }: Props) {
  const { user } = useAuth();
  const saveResults = useSaveQuizResults();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [selfAssess, setSelfAssess] = useState<boolean | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [showHint, setShowHint] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    setLoading(true);
    generateQuizQuestions(block.topic, subjectName, block.difficulty_level).then((qs) => {
      setQuestions(qs);
      setLoading(false);
      startTimeRef.current = Date.now();
    });
  }, [block.id]);

  const currentQuestion = questions[currentIdx] ?? null;

  const handleSubmitAnswer = () => {
    if (!currentAnswer.trim() || selfAssess === null) return;
    const responseTime = Math.round((Date.now() - startTimeRef.current) / 1000);
    setAnswers((prev) => [
      ...prev,
      {
        question: currentQuestion.question,
        user_answer: currentAnswer.trim(),
        is_correct: selfAssess,
        response_time_s: responseTime,
        confidence,
      },
    ]);
    setSubmitted(true);
  };

  const handleNext = () => {
    setCurrentAnswer("");
    setSelfAssess(null);
    setConfidence(3);
    setShowHint(false);
    setSubmitted(false);
    startTimeRef.current = Date.now();

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      // All answered — save & compute score
      const allAnswers = [
        ...answers,
        {
          question: currentQuestion.question,
          user_answer: currentAnswer.trim(),
          is_correct: selfAssess ?? false,
          response_time_s: Math.round((Date.now() - startTimeRef.current) / 1000),
          confidence,
        },
      ];
      const score = Math.round((allAnswers.filter((a) => a.is_correct).length / allAnswers.length) * 100);
      saveResults.mutate({ blockId: block.id, sessionId, results: allAnswers });
      onComplete(score);
    }
  };

  const progressPct = questions.length > 0 ? ((currentIdx) / questions.length) * 100 : 0;

  if (loading) return (
    <Card className="max-w-xl mx-auto">
      <CardContent className="py-12 flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Gerando questões sobre <strong>{block.topic}</strong>…</p>
      </CardContent>
    </Card>
  );

  if (!currentQuestion) return null;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Quiz pós-bloco
          </span>
          <span>{currentIdx + 1}/{questions.length}</span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* Question card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Badge
              variant={currentQuestion.difficulty === 1 ? "secondary" : currentQuestion.difficulty === 2 ? "default" : "destructive"}
              className="text-xs"
            >
              {currentQuestion.difficulty === 1 ? "Fácil" : currentQuestion.difficulty === 2 ? "Média" : "Difícil"}
            </Badge>
            <Badge variant="outline" className="text-xs">{subjectName} — {block.topic}</Badge>
          </div>
          <CardTitle className="text-base leading-snug mt-2">{currentQuestion.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Sua resposta</Label>
            <Textarea
              placeholder="Escreva sua resposta aqui…"
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              rows={4}
              disabled={submitted}
            />
          </div>

          {!submitted && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setShowHint(!showHint)}
            >
              {showHint ? "Ocultar dica" : "Ver dica de resposta"}
            </Button>
          )}

          {showHint && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
              💡 <strong>Resposta esperada:</strong> {currentQuestion.expectedAnswer}
            </div>
          )}

          {!submitted && currentAnswer.trim() && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Autoavaliação — minha resposta foi:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={selfAssess === true ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setSelfAssess(true)}
                >
                  <CheckCircle className="h-4 w-4 text-emerald-500" /> Correta
                </Button>
                <Button
                  variant={selfAssess === false ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setSelfAssess(false)}
                >
                  <XCircle className="h-4 w-4 text-red-500" /> Incorreta
                </Button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Confiança na resposta</span>
                  <span className="font-medium">{confidence}/5</span>
                </div>
                <Slider
                  min={1} max={5} step={1}
                  value={[confidence]}
                  onValueChange={([v]) => setConfidence(v)}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSubmitAnswer}
                disabled={selfAssess === null}
              >
                {currentIdx < questions.length - 1 ? "Próxima questão" : "Finalizar Quiz"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {submitted && (
            <div className={`p-3 rounded-lg border text-sm ${selfAssess
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
            }`}>
              {selfAssess
                ? <><CheckCircle className="h-4 w-4 inline mr-1" /> Ótimo! Resposta marcada como correta.</>
                : <><XCircle className="h-4 w-4 inline mr-1" /> Resposta marcada como incorreta — o sistema vai reforçar este tópico.</>
              }
            </div>
          )}

          {submitted && (
            <Button className="w-full" onClick={handleNext}>
              {currentIdx < questions.length - 1 ? (
                <><span>Próxima questão</span> <ChevronRight className="h-4 w-4 ml-1" /></>
              ) : (
                <><span>Ver resultado</span> <ChevronRight className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Previous answers */}
      {answers.length > 0 && (
        <div className="space-y-1">
          {answers.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded border ${
              a.is_correct ? "border-emerald-500/30 text-emerald-600" : "border-red-500/30 text-red-600"
            }`}>
              {a.is_correct ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              <span className="flex-1 truncate">Q{i + 1}: {a.question.slice(0, 60)}…</span>
              <span>⏱ {a.response_time_s}s</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
