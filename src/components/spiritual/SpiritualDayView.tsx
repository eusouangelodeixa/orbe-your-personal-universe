import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, CheckCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useActivePlan, usePlanDays, useMarkDayRead, SpiritualPlanDay } from "@/hooks/useSpiritual";

export function SpiritualDayView() {
  const { data: plan } = useActivePlan();
  const { data: days = [] } = usePlanDays(plan?.id || null);
  const markRead = useMarkDayRead();
  const [reflectionNotes, setReflectionNotes] = useState("");

  if (!plan) return null;

  // Find current day (first incomplete or last completed + 1)
  const nextDay = days.find((d) => !d.completed) || days[days.length - 1];
  const [viewDay, setViewDay] = useState<number>(nextDay?.day_number || 1);

  const day = days.find((d) => d.day_number === viewDay);
  if (!day) return null;

  const handleComplete = () => {
    markRead.mutate(
      { dayId: day.id, planId: plan.id, reflectionNotes: reflectionNotes || undefined },
      { onSuccess: () => setReflectionNotes("") }
    );
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          disabled={viewDay <= 1}
          onClick={() => setViewDay(viewDay - 1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">{plan.title}</p>
          <p className="text-sm font-medium">Dia {viewDay} / {plan.total_days}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={viewDay >= days.length}
          onClick={() => setViewDay(viewDay + 1)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Verse */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="py-4 space-y-3">
          <Badge variant="outline" className="text-xs">📖 {day.verse_reference}</Badge>
          <blockquote className="text-sm italic leading-relaxed border-l-2 border-primary/30 pl-3">
            "{day.verse_text}"
          </blockquote>
        </CardContent>
      </Card>

      {/* Explanation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">💡 Explicação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{day.explanation}</p>
        </CardContent>
      </Card>

      {/* Reflection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">🤔 Reflexão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {day.reflection_questions.map((q, i) => (
            <p key={i} className="text-sm text-muted-foreground">• {q}</p>
          ))}
          {!day.completed && (
            <Textarea
              placeholder="Suas reflexões (opcional)..."
              value={reflectionNotes}
              onChange={(e) => setReflectionNotes(e.target.value)}
              rows={3}
              className="mt-2"
            />
          )}
        </CardContent>
      </Card>

      {/* Application */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">✅ Aplicação Prática</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{day.practical_application}</p>
        </CardContent>
      </Card>

      {/* Check-in */}
      {day.completed ? (
        <div className="flex items-center justify-center gap-2 py-4 text-emerald-500">
          <CheckCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Leitura concluída</span>
        </div>
      ) : (
        <Button className="w-full" size="lg" onClick={handleComplete} disabled={markRead.isPending}>
          {markRead.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <BookOpen className="h-5 w-5 mr-2" />}
          Já estudei hoje
        </Button>
      )}
    </div>
  );
}
