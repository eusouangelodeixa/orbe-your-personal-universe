import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Brain, RotateCw, Trash2, Sparkles, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { useSubjects } from "@/hooks/useStudies";
import { useFlashcards, useDueFlashcards, useAddFlashcard, useAddFlashcardsBatch, useReviewFlashcard, useDeleteFlashcard, Flashcard } from "@/hooks/useFlashcards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Flashcards() {
  const { data: subjects = [] } = useSubjects();
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const subjectFilter = selectedSubject === "all" ? undefined : selectedSubject;
  const { data: allCards = [], isLoading } = useFlashcards(subjectFilter);
  const { data: dueCards = [], isLoading: loadingDue } = useDueFlashcards(subjectFilter);
  const addCard = useAddFlashcard();
  const addBatch = useAddFlashcardsBatch();
  const reviewCard = useReviewFlashcard();
  const deleteCard = useDeleteFlashcard();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ front: "", back: "", subject_id: "" });
  const [generating, setGenerating] = useState(false);
  const [genSubject, setGenSubject] = useState("");
  const [genTopic, setGenTopic] = useState("");
  const [genCount, setGenCount] = useState("5");

  // Review state
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleCreate = () => {
    if (!form.front.trim() || !form.back.trim()) return;
    addCard.mutate({ front: form.front.trim(), back: form.back.trim(), subject_id: form.subject_id || undefined }, {
      onSuccess: () => { setForm({ front: "", back: "", subject_id: "" }); setCreateOpen(false); },
    });
  };

  const handleGenerate = async () => {
    if (!genSubject) return;
    setGenerating(true);
    try {
      const subject = subjects.find(s => s.id === genSubject);
      const { data, error } = await supabase.functions.invoke("solve-academic", {
        body: {
          prompt: `Gere ${genCount} flashcards sobre "${genTopic || subject?.name || "a disciplina"}". 
          Disciplina: ${subject?.name || "Geral"}
          ${subject?.ementa_text ? `Ementa: ${subject.ementa_text}` : ""}
          
          Responda em JSON puro: [{"front": "pergunta", "back": "resposta"}]
          Gere flashcards concisos e objetivos.`,
          mode: "json",
        },
      });
      if (error) throw error;
      const result = data?.result || data?.text || "";
      const match = result.match(/\[[\s\S]*?\]/);
      if (match) {
        const cards = JSON.parse(match[0]);
        if (Array.isArray(cards) && cards.length > 0) {
          addBatch.mutate(cards.map((c: any) => ({ front: c.front, back: c.back, subject_id: genSubject })));
        }
      } else {
        toast.error("Não foi possível gerar flashcards");
      }
    } catch {
      toast.error("Erro ao gerar flashcards");
    }
    setGenerating(false);
  };

  const startReview = () => {
    if (dueCards.length === 0) { toast.info("Nenhum flashcard para revisar agora!"); return; }
    setReviewMode(true);
    setReviewIndex(0);
    setShowAnswer(false);
  };

  const handleReview = (quality: number) => {
    const card = dueCards[reviewIndex];
    reviewCard.mutate({ card, quality });
    if (reviewIndex + 1 < dueCards.length) {
      setReviewIndex(i => i + 1);
      setShowAnswer(false);
    } else {
      setReviewMode(false);
      toast.success("Sessão de revisão concluída! 🎉");
    }
  };

  if (isLoading || loadingDue) {
    return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  // Review mode
  if (reviewMode && dueCards.length > 0) {
    const card = dueCards[reviewIndex];
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto space-y-6 pt-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" /> Revisão
            </h1>
            <Badge variant="outline">{reviewIndex + 1} / {dueCards.length}</Badge>
          </div>

          <Card className="min-h-[250px] flex flex-col justify-center cursor-pointer" onClick={() => setShowAnswer(true)}>
            <CardContent className="text-center py-12">
              <p className="text-lg font-medium mb-4">{card.front}</p>
              {showAnswer ? (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-base text-muted-foreground">{card.back}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">Toque para ver a resposta</p>
              )}
            </CardContent>
          </Card>

          {showAnswer && (
            <div className="grid grid-cols-4 gap-2">
              <Button variant="destructive" onClick={() => handleReview(0)} className="flex-col h-auto py-3">
                <XCircle className="h-5 w-5 mb-1" />
                <span className="text-xs">Errei</span>
              </Button>
              <Button variant="outline" onClick={() => handleReview(2)} className="flex-col h-auto py-3 text-orange-500 border-orange-500/30">
                <ArrowRight className="h-5 w-5 mb-1" />
                <span className="text-xs">Difícil</span>
              </Button>
              <Button variant="outline" onClick={() => handleReview(4)} className="flex-col h-auto py-3 text-blue-500 border-blue-500/30">
                <CheckCircle2 className="h-5 w-5 mb-1" />
                <span className="text-xs">Bom</span>
              </Button>
              <Button onClick={() => handleReview(5)} className="flex-col h-auto py-3 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="h-5 w-5 mb-1" />
                <span className="text-xs">Fácil</span>
              </Button>
            </div>
          )}

          <Button variant="ghost" onClick={() => setReviewMode(false)} className="w-full">Sair da revisão</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" /> Flashcards
            </h1>
            <p className="text-muted-foreground text-sm">Estude com repetição espaçada</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={startReview} disabled={dueCards.length === 0} className="gap-2">
              <RotateCw className="h-4 w-4" /> Revisar ({dueCards.length})
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Criar</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Flashcard</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Disciplina (opcional)</Label>
                    <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Geral" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Pergunta (frente)</Label><Textarea value={form.front} onChange={e => setForm(f => ({ ...f, front: e.target.value }))} /></div>
                  <div><Label>Resposta (verso)</Label><Textarea value={form.back} onChange={e => setForm(f => ({ ...f, back: e.target.value }))} /></div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={handleCreate} disabled={addCard.isPending}>{addCard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* AI Generation */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Gerar com IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Disciplina</Label>
                <Select value={genSubject} onValueChange={setGenSubject}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Tópico (opcional)</Label>
                <Input className="h-9" value={genTopic} onChange={e => setGenTopic(e.target.value)} placeholder="Ex: Matrizes" />
              </div>
              <div className="w-20">
                <Label className="text-xs">Qtde</Label>
                <Input className="h-9" type="number" value={genCount} onChange={e => setGenCount(e.target.value)} min="1" max="20" />
              </div>
              <Button onClick={handleGenerate} disabled={generating || !genSubject} className="gap-2 h-9">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filter */}
        <div className="flex gap-2 items-center">
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas as disciplinas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="outline">{allCards.length} cards</Badge>
          {dueCards.length > 0 && <Badge variant="destructive">{dueCards.length} para revisar</Badge>}
        </div>

        {/* Cards list */}
        {allCards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allCards.map(card => {
              const isDue = new Date(card.next_review) <= new Date();
              const sub = subjects.find(s => s.id === card.subject_id);
              return (
                <Card key={card.id} className={`group ${isDue ? "border-primary/30" : ""}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm mb-1">{card.front}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{card.back}</p>
                        <div className="flex gap-1.5 mt-2">
                          {sub && <Badge variant="outline" className="text-[10px]">{sub.name}</Badge>}
                          {isDue && <Badge variant="destructive" className="text-[10px]">Revisar</Badge>}
                          <Badge variant="secondary" className="text-[10px]">×{card.review_count}</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteCard.mutate(card.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhum flashcard ainda</p>
              <p className="text-xs text-muted-foreground">Crie manualmente ou gere com IA</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
