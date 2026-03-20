import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Flashcard } from "@/hooks/useFlashcards";
import { cn } from "@/lib/utils";

interface Props {
  dueCards: Flashcard[];
  allCards: Flashcard[];
  onReview: (card: Flashcard, quality: number) => void;
  onExit: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FlashcardReview({ dueCards, allCards, onReview, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const card = dueCards[index];

  // Build multiple-choice options: correct + 3 wrong from other cards
  const options = useMemo(() => {
    if (!card) return [];
    const others = allCards
      .filter(c => c.id !== card.id && c.back !== card.back)
      .map(c => c.back);
    const unique = [...new Set(others)];
    const wrong = shuffleArray(unique).slice(0, 3);
    const all = shuffleArray([
      { text: card.back, correct: true },
      ...wrong.map(t => ({ text: t, correct: false })),
    ]);
    return all;
  }, [card?.id, allCards]);

  if (!card) return null;

  const handleSelect = (idx: number) => {
    if (confirmed) return;
    setSelected(idx);
  };

  const handleConfirm = () => {
    if (selected === null) return;
    setConfirmed(true);
  };

  const handleNext = () => {
    const isCorrect = selected !== null && options[selected]?.correct;
    // Map to SM-2 quality: correct = 4 (good), wrong = 1 (fail)
    const quality = isCorrect ? 4 : 1;
    onReview(card, quality);

    if (index + 1 < dueCards.length) {
      setIndex(i => i + 1);
      setSelected(null);
      setConfirmed(false);
    } else {
      onExit();
    }
  };

  const hasEnoughOptions = options.length >= 2;

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" /> Revisão
        </h1>
        <Badge variant="outline">{index + 1} / {dueCards.length}</Badge>
      </div>

      {/* Question */}
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Pergunta</p>
          <p className="text-lg font-medium">{card.front}</p>
        </CardContent>
      </Card>

      {/* Multiple choice options */}
      {hasEnoughOptions ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Selecione a resposta correta:</p>
          {options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrectOption = opt.correct;
            let variant: string = "border-border bg-card";

            if (confirmed) {
              if (isCorrectOption) variant = "border-emerald-500 bg-emerald-500/10 text-emerald-600";
              else if (isSelected && !isCorrectOption) variant = "border-destructive bg-destructive/10 text-destructive";
            } else if (isSelected) {
              variant = "border-primary bg-primary/10";
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={confirmed}
                className={cn(
                  "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                  "hover:border-primary/50 disabled:hover:border-transparent",
                  "active:scale-[0.98]",
                  variant,
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-sm flex-1">{opt.text}</span>
                  {confirmed && isCorrectOption && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
                  {confirmed && isSelected && !isCorrectOption && <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Fallback: show/hide answer when not enough alternatives */
        <Card className="cursor-pointer" onClick={() => !confirmed && setConfirmed(true)}>
          <CardContent className="py-8 text-center">
            {confirmed ? (
              <p className="text-base text-muted-foreground">{card.back}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Toque para ver a resposta</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {!confirmed && hasEnoughOptions && (
        <Button onClick={handleConfirm} disabled={selected === null} className="w-full gap-2">
          Confirmar resposta
        </Button>
      )}

      {confirmed && (
        <div className="flex gap-2">
          {!hasEnoughOptions && (
            <>
              <Button variant="destructive" onClick={() => { onReview(card, 1); handleNextFallback(); }} className="flex-1 gap-2">
                <XCircle className="h-4 w-4" /> Errei
              </Button>
              <Button onClick={() => { onReview(card, 4); handleNextFallback(); }} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Acertei
              </Button>
            </>
          )}
          {hasEnoughOptions && (
            <Button onClick={handleNext} className="w-full gap-2">
              <ArrowRight className="h-4 w-4" />
              {index + 1 < dueCards.length ? "Próximo" : "Finalizar"}
            </Button>
          )}
        </div>
      )}

      <Button variant="ghost" onClick={onExit} className="w-full">Sair da revisão</Button>
    </div>
  );

  function handleNextFallback() {
    if (index + 1 < dueCards.length) {
      setIndex(i => i + 1);
      setSelected(null);
      setConfirmed(false);
    } else {
      onExit();
    }
  }
}
