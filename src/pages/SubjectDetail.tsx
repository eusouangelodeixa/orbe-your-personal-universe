import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Loader2, FileText, ClipboardList, BookOpen, RotateCw,
  Send, ArrowLeft, CalendarPlus, Upload, Pencil, User, GraduationCap, Clock, MessageSquare, FileUp, Timer, Sparkles, Download, History, GitCompare, Save, Eye, X,
} from "lucide-react";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import mermaid from "mermaid";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeLatex } from "@/lib/sanitizeLatex";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSubjects, useUpdateSubject, useDeleteSubject,
  useAcademicEvents, useAddAcademicEvent, useUpdateAcademicEvent, useDeleteAcademicEvent,
  useSubjectChatMessages, useAddSubjectChatMessage, useClearSubjectChat,
  useAIResolutions, useSaveResolution, useDeleteResolution,
  AcademicEvent,
} from "@/hooks/useStudies";
import { useAddNotification } from "@/hooks/useNotifications";

// ─── Constants ───
const EVENT_TYPES: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  prova: { label: "Prova", icon: FileText, color: "text-red-500" },
  trabalho: { label: "Trabalho", icon: ClipboardList, color: "text-amber-500" },
  atividade: { label: "Atividade", icon: BookOpen, color: "text-blue-500" },
  revisao: { label: "Revisão", icon: RotateCw, color: "text-emerald-500" },
};
const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "destructive" },
  em_andamento: { label: "Em andamento", variant: "default" },
  entregue: { label: "Entregue", variant: "secondary" },
  realizado: { label: "Realizado", variant: "secondary" },
};
const TYPES_LABEL: Record<string, string> = { teorica: "Teórica", pratica: "Prática", laboratorio: "Laboratório" };
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subject-chat`;
const SOLVE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/solve-academic`;

// ─── Chat streaming ───
interface Message { role: "user" | "assistant"; content: string; }

let mermaidInitialized = false;

function ensureMermaidInitialized() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "neutral",
  });
  mermaidInitialized = true;
}

function MermaidBlock({ chart }: { chart: string }) {
  const [svg, setSvg] = useState("");
  const [hasError, setHasError] = useState(false);
  const renderId = useMemo(() => `mermaid-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    let active = true;

    const draw = async () => {
      try {
        ensureMermaidInitialized();
        const { svg: generatedSvg } = await mermaid.render(renderId, chart);
        if (!active) return;
        setSvg(generatedSvg);
        setHasError(false);
      } catch (error) {
        console.error("Mermaid render error:", error);
        if (!active) return;
        setHasError(true);
        setSvg("");
      }
    };

    void draw();

    return () => {
      active = false;
    };
  }, [chart, renderId]);

  if (hasError) {
    return (
      <pre className="my-2 overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
        {chart}
      </pre>
    );
  }

  return (
    <div className="my-2 overflow-x-auto rounded-md border border-border bg-card p-2">
      <div className="max-w-[400px] [&_svg]:max-h-[280px] [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

async function streamChat({ messages, subjectName, subjectType, ementaText, onDelta, onDone }: {

  messages: Message[]; subjectName: string; subjectType: string; ementaText?: string | null;
  onDelta: (t: string) => void; onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ messages, subjectName, subjectType, ementaText }),
  });
  if (resp.status === 429) { toast.error("Limite atingido."); throw new Error("Rate limited"); }
  if (resp.status === 402) { toast.error("Créditos insuficientes."); throw new Error("Payment required"); }
  if (!resp.ok || !resp.body) throw new Error("Falha ao conectar");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", done = false;
  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try { const c = JSON.parse(json).choices?.[0]?.delta?.content; if (c) onDelta(c); }
      catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

// ─── Main Component ───
export default function SubjectDetail() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: subjects = [] } = useSubjects();
  const subject = subjects.find(s => s.id === subjectId);
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  // Events
  const { data: events = [], isLoading: eventsLoading } = useAcademicEvents(subjectId);
  const addEvent = useAddAcademicEvent();
  const updateEvent = useUpdateAcademicEvent();
  const deleteEvent = useDeleteAcademicEvent();

  // Chat
  const { data: history = [] } = useSubjectChatMessages(subjectId || "");
  const addMsg = useAddSubjectChatMessage();
  const clearChat = useClearSubjectChat();
  const addNotification = useAddNotification();

  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Event form
  const [eventOpen, setEventOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({
    type: "prova", title: "", description: "", event_date: "",
    content_topics: "", weight: "", is_group: false, status: "pendente", grade: "",
  });

  // Ementa upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (history.length && chatMessages.length === 0) {
      setChatMessages(history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  }, [history]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // ─── Ementa Upload ───
  const handleEmentaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !subject || !user) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 20MB)"); return; }

    setUploading(true);
    try {
      const path = `${user.id}/${subject.id}/${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("ementas").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      // For text files, extract directly; for PDFs, use edge function
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const isText = file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".csv");

      if (isText) {
        const ementaText = await file.text();
        updateSubject.mutate({
          id: subject.id,
          ementa_url: path,
          ementa_text: ementaText.slice(0, 50000),
        } as any);
        toast.success("Ementa enviada! O chatbot agora usará como referência.");
      } else if (isPdf) {
        // Update URL immediately, then trigger PDF parsing via edge function
        updateSubject.mutate({ id: subject.id, ementa_url: path } as any);
        toast.info("Enviado! Extraindo texto do PDF...");

        const parseFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-pdf`;
        const resp = await fetch(parseFnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ subjectId: subject.id, filePath: path }),
        });
        if (resp.ok) {
          toast.success("Texto extraído do PDF! O chatbot agora usará como referência.");
        } else {
          toast.warning("PDF enviado, mas não foi possível extrair o texto automaticamente.");
        }
      } else {
        updateSubject.mutate({
          id: subject.id,
          ementa_url: path,
          ementa_text: `[Arquivo: ${file.name}] - Ementa enviada pelo aluno.`,
        } as any);
        toast.success("Ementa enviada!");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar ementa");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Events ───
  const openCreateEvent = () => {
    setEditingEventId(null);
    setEventForm({ type: "prova", title: "", description: "", event_date: "", content_topics: "", weight: "", is_group: false, status: "pendente", grade: "" });
    setEventOpen(true);
  };
  const openEditEvent = (ev: AcademicEvent) => {
    setEditingEventId(ev.id);
    setEventForm({
      type: ev.type, title: ev.title, description: ev.description || "",
      event_date: ev.event_date.slice(0, 16), content_topics: ev.content_topics || "",
      weight: ev.weight?.toString() || "", is_group: ev.is_group, status: ev.status,
      grade: ev.grade?.toString() || "",
    });
    setEventOpen(true);
  };
  const handleSaveEvent = () => {
    if (!subject || !eventForm.title || !eventForm.event_date) return;
    const payload = {
      subject_id: subject.id, type: eventForm.type, title: eventForm.title,
      description: eventForm.description || null, event_date: eventForm.event_date,
      due_date: eventForm.event_date, content_topics: eventForm.content_topics || null,
      weight: eventForm.weight ? Number(eventForm.weight) : null, is_group: eventForm.is_group,
      status: eventForm.status, reminder_config: [],
      grade: eventForm.grade ? Number(eventForm.grade) : null,
    };
    if (editingEventId) {
      updateEvent.mutate({ id: editingEventId, ...payload }, { onSuccess: () => setEventOpen(false) });
    } else {
      addEvent.mutate(payload, { onSuccess: () => setEventOpen(false) });
    }
  };
  const cycleStatus = (ev: AcademicEvent) => {
    const order = ["pendente", "em_andamento", "entregue", "realizado"];
    updateEvent.mutate({ id: ev.id, status: order[(order.indexOf(ev.status) + 1) % order.length] });
  };

  // ─── Chat ───
  const createRevision = () => {
    if (!subject) return;
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(14, 0, 0, 0);
    addEvent.mutate({
      subject_id: subject.id, type: "revisao", title: `Revisão - ${subject.name}`,
      description: "Sessão de revisão sugerida pela IA", event_date: tomorrow.toISOString(),
      due_date: tomorrow.toISOString(), content_topics: null, weight: null, is_group: false, status: "pendente", reminder_config: [], grade: null,
    }, {
      onSuccess: () => {
        addNotification.mutate({ title: "📚 Revisão agendada", message: `Revisão de ${subject.name} para amanhã às 14h`, type: "revisao" });
        toast.success("Revisão agendada para amanhã às 14h!");
      },
    });
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || !subject) return;
    const userMsg: Message = { role: "user", content: chatInput.trim() };
    const newMsgs = [...chatMessages, userMsg];
    setChatMessages(newMsgs);
    setChatInput("");
    setChatLoading(true);
    addMsg.mutate({ subject_id: subject.id, role: "user", content: userMsg.content });

    let assistant = "";
    const upsert = (chunk: string) => {
      assistant += chunk;
      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistant } : m);
        return [...prev, { role: "assistant", content: assistant }];
      });
    };
    try {
      await streamChat({
        messages: newMsgs, subjectName: subject.name, subjectType: subject.type,
        ementaText: subject.ementa_text,
        onDelta: upsert,
        onDone: () => { setChatLoading(false); addMsg.mutate({ subject_id: subject.id, role: "assistant", content: assistant }); },
      });
    } catch { setChatLoading(false); }
  };

  if (!subject) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">Disciplina não encontrada</p>
        <Button onClick={() => navigate("/disciplinas")}>Voltar</Button>
      </div>
    </AppLayout>
  );

  const pendingEvents = events.filter(e => e.status === "pendente" || e.status === "em_andamento");
  const completedEvents = events.filter(e => e.status === "entregue" || e.status === "realizado");

  // Calculate weighted average
  const gradedEvents = events.filter(e => e.grade != null);
  const weightedEvents = gradedEvents.filter(e => e.weight != null && e.weight > 0);
  const unweightedEvents = gradedEvents.filter(e => !e.weight || e.weight <= 0);
  let averageGrade: number | null = null;
  if (gradedEvents.length > 0) {
    if (weightedEvents.length > 0) {
      const totalWeight = weightedEvents.reduce((a, e) => a + (e.weight || 0), 0) + (unweightedEvents.length > 0 ? 1 : 0);
      const weightedSum = weightedEvents.reduce((a, e) => a + (e.grade! * (e.weight || 1)), 0);
      const unweightedAvg = unweightedEvents.length > 0 ? unweightedEvents.reduce((a, e) => a + e.grade!, 0) / unweightedEvents.length : 0;
      averageGrade = (weightedSum + (unweightedEvents.length > 0 ? unweightedAvg : 0)) / totalWeight;
    } else {
      averageGrade = gradedEvents.reduce((a, e) => a + e.grade!, 0) / gradedEvents.length;
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/disciplinas")}><ArrowLeft className="h-4 w-4" /></Button>
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: subject.color }} />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{subject.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {subject.teacher && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {subject.teacher}</span>}
              {subject.course && <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {subject.course}</span>}
              <Badge variant="outline" className="text-xs">{TYPES_LABEL[subject.type] || subject.type}</Badge>
              {subject.weekly_hours > 0 && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {subject.weekly_hours}h/sem</span>}
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => { deleteSubject.mutate(subject.id); navigate("/disciplinas"); }}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
        </div>

        {/* Schedule badges */}
        {subject.schedule?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {subject.schedule.map((s, i) => (
              <Badge key={i} variant="secondary">{s.day} {s.start}-{s.end}</Badge>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="notas" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="notas">📊 Notas</TabsTrigger>
            <TabsTrigger value="agenda">📅 Agenda</TabsTrigger>
            <TabsTrigger value="resolver">✨ Resolver com IA</TabsTrigger>
            <TabsTrigger value="pomodoro">⏱️ Pomodoro</TabsTrigger>
            <TabsTrigger value="chatbot">🤖 Chatbot</TabsTrigger>
            <TabsTrigger value="ementa">📄 Ementa</TabsTrigger>
          </TabsList>

          {/* ─── NOTAS TAB ─── */}
          <TabsContent value="notas" className="space-y-4">
            {(() => {
              const evaluativeEvents = events.filter(
                e => e.type === "prova" || e.type === "trabalho" || e.type === "atividade"
              );
              const eventsWithGrade = evaluativeEvents.filter(e => e.grade != null);
              const eventsWithoutGrade = evaluativeEvents.filter(e => e.grade == null);

              // Approval logic
              const approvalThreshold = 6;
              const isApproved = averageGrade !== null && averageGrade >= approvalThreshold;
              const allEvaluated = evaluativeEvents.length > 0 && eventsWithoutGrade.length === 0;

              return (
                <>
                  {/* Status Card */}
                  <Card className={`border-l-4 ${
                    averageGrade === null
                      ? "border-l-muted-foreground"
                      : isApproved
                        ? "border-l-emerald-500"
                        : "border-l-red-500"
                  }`}>
                    <CardContent className="py-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground font-medium">Média Ponderada</p>
                          <p className={`text-4xl font-bold font-display ${
                            averageGrade === null
                              ? "text-muted-foreground"
                              : averageGrade >= 6
                                ? "text-emerald-500"
                                : "text-red-500"
                          }`}>
                            {averageGrade !== null ? averageGrade.toFixed(1) : "—"}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          {averageGrade !== null && (
                            <Badge
                              variant={isApproved ? "default" : "destructive"}
                              className={`text-sm px-3 py-1 ${isApproved ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                            >
                              {allEvaluated
                                ? (isApproved ? "✅ Aprovado" : "❌ Reprovado")
                                : (isApproved ? "📈 Aprovando" : "⚠️ Reprovando")
                              }
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {eventsWithGrade.length}/{evaluativeEvents.length} avaliações com nota
                          </p>
                          {averageGrade !== null && !isApproved && eventsWithoutGrade.length > 0 && (
                            <p className="text-xs text-amber-500 font-medium">
                              Precisa de ≥ {(() => {
                                // Calculate minimum grade needed on remaining
                                const currentWeightedSum = eventsWithGrade.reduce(
                                  (a, e) => a + (e.grade! * (e.weight || 1)), 0
                                );
                                const currentTotalWeight = eventsWithGrade.reduce(
                                  (a, e) => a + (e.weight || 1), 0
                                );
                                const remainingWeight = eventsWithoutGrade.reduce(
                                  (a, e) => a + (e.weight || 1), 0
                                );
                                const needed = ((approvalThreshold * (currentTotalWeight + remainingWeight)) - currentWeightedSum) / remainingWeight;
                                return Math.max(0, Math.min(10, needed)).toFixed(1);
                              })()} nas próximas
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {averageGrade !== null && (
                        <div className="mt-4">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${averageGrade >= 6 ? "bg-emerald-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, (averageGrade / 10) * 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-muted-foreground">0</span>
                            <span className="text-xs text-muted-foreground font-medium">Mín: 6.0</span>
                            <span className="text-xs text-muted-foreground">10</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Evaluative events list with inline grade input */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Avaliações</CardTitle>
                        <Button size="sm" variant="outline" onClick={openCreateEvent}>
                          <Plus className="h-4 w-4 mr-1" /> Nova avaliação
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {evaluativeEvents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma avaliação cadastrada</p>
                          <p className="text-xs mt-1">Adicione provas, trabalhos ou atividades na aba Agenda</p>
                        </div>
                      ) : (
                        evaluativeEvents
                          .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
                          .map(ev => {
                            const meta = EVENT_TYPES[ev.type];
                            const Icon = meta?.icon || FileText;
                            const isPast = new Date(ev.event_date) < new Date();
                            const hasGrade = ev.grade != null;

                            return (
                              <div
                                key={ev.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border ${
                                  hasGrade ? "border-border" : isPast ? "border-amber-500/30 bg-amber-500/5" : "border-border"
                                }`}
                              >
                                <Icon className={`h-4 w-4 shrink-0 ${meta?.color}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{ev.title}</span>
                                    <Badge variant="outline" className={`text-xs ${meta?.color}`}>
                                      {meta?.label}
                                    </Badge>
                                    {ev.weight && (
                                      <span className="text-xs text-muted-foreground">Peso: {ev.weight}</span>
                                    )}
                                    {ev.is_group && (
                                      <Badge variant="secondary" className="text-xs">Grupo</Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {format(parseISO(ev.event_date), "dd/MM/yyyy", { locale: ptBR })}
                                    {ev.content_topics && ` • ${ev.content_topics}`}
                                  </div>
                                </div>

                                {/* Grade input / display */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {hasGrade ? (
                                    <div className="flex items-center gap-2">
                                      <span className={`text-lg font-bold ${ev.grade! >= 6 ? "text-emerald-500" : "text-red-500"}`}>
                                        {ev.grade!.toFixed(1)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => openEditEvent(ev)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="10"
                                        placeholder="Nota"
                                        className="w-20 h-8 text-sm text-center"
                                        onKeyDown={e => {
                                          if (e.key === "Enter") {
                                            const val = parseFloat((e.target as HTMLInputElement).value);
                                            if (!isNaN(val) && val >= 0 && val <= 10) {
                                              updateEvent.mutate({
                                                id: ev.id,
                                                grade: val,
                                                status: ev.status === "pendente" ? "realizado" : ev.status,
                                              });
                                              (e.target as HTMLInputElement).value = "";
                                            }
                                          }
                                        }}
                                        onBlur={e => {
                                          const val = parseFloat(e.target.value);
                                          if (!isNaN(val) && val >= 0 && val <= 10) {
                                            updateEvent.mutate({
                                              id: ev.id,
                                              grade: val,
                                              status: ev.status === "pendente" ? "realizado" : ev.status,
                                            });
                                            e.target.value = "";
                                          }
                                        }}
                                      />
                                      {isPast && !hasGrade && (
                                        <span className="text-xs text-amber-500">⏳</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          {/* ─── AGENDA TAB ─── */}
          <TabsContent value="agenda" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Eventos ({events.length})</h2>
              <div className="flex items-center gap-3">
                {averageGrade !== null && (
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${averageGrade >= 6 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                    📊 Média: {averageGrade.toFixed(1)}
                  </div>
                )}
                <Button size="sm" onClick={openCreateEvent}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
              </div>
            </div>

            {pendingEvents.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Pendentes</h3>
                {pendingEvents.map(ev => {
                  const meta = EVENT_TYPES[ev.type];
                  const Icon = meta?.icon || FileText;
                  return (
                    <Card key={ev.id} className="group">
                      <CardContent className="flex items-center gap-3 py-3 px-4">
                        <Icon className={`h-4 w-4 shrink-0 ${meta?.color}`} />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">{ev.title}</span>
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(ev.event_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            {ev.content_topics && ` • ${ev.content_topics}`}
                            {ev.weight && ` • Peso: ${ev.weight}`}
                            {ev.grade != null && ` • Nota: ${ev.grade}`}
                          </div>
                        </div>
                        <Badge variant={STATUS_MAP[ev.status]?.variant} className="cursor-pointer text-xs" onClick={() => cycleStatus(ev)}>
                          {STATUS_MAP[ev.status]?.label}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEditEvent(ev)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteEvent.mutate(ev.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {completedEvents.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Concluídos</h3>
                {completedEvents.map(ev => {
                  const meta = EVENT_TYPES[ev.type];
                  const Icon = meta?.icon || FileText;
                  return (
                    <Card key={ev.id} className="group opacity-70">
                      <CardContent className="flex items-center gap-3 py-2 px-4">
                        <Icon className={`h-4 w-4 shrink-0 ${meta?.color}`} />
                        <span className="flex-1 text-sm">{ev.title}</span>
                        {ev.grade != null && (
                          <span className={`text-sm font-bold ${ev.grade >= 6 ? "text-emerald-500" : "text-red-500"}`}>
                            {ev.grade.toFixed(1)}
                          </span>
                        )}
                        <Badge variant="secondary" className="text-xs">{STATUS_MAP[ev.status]?.label}</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {events.length === 0 && !eventsLoading && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum evento. Clique em "Novo" para adicionar.</CardContent></Card>
            )}

            {/* Event Dialog */}
            <Dialog open={eventOpen} onOpenChange={setEventOpen}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingEventId ? "Editar Evento" : "Novo Evento"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tipo</Label>
                      <Select value={eventForm.type} onValueChange={v => setEventForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(EVENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={eventForm.status} onValueChange={v => setEventForm(f => ({ ...f, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Título *</Label><Input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} /></div>
                  <div><Label>Data/Hora *</Label><Input type="datetime-local" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))} /></div>
                  <div><Label>Conteúdo/Tópicos</Label><Input value={eventForm.content_topics} onChange={e => setEventForm(f => ({ ...f, content_topics: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    {(eventForm.type === "prova" || eventForm.type === "trabalho" || eventForm.type === "atividade") && (
                      <div><Label>Peso</Label><Input type="number" step="0.1" value={eventForm.weight} onChange={e => setEventForm(f => ({ ...f, weight: e.target.value }))} placeholder="Ex: 2.0" /></div>
                    )}
                    {(eventForm.type === "prova" || eventForm.type === "trabalho" || eventForm.type === "atividade") && (
                      <div><Label>Nota</Label><Input type="number" step="0.1" min="0" max="10" value={eventForm.grade} onChange={e => setEventForm(f => ({ ...f, grade: e.target.value }))} placeholder="0-10" /></div>
                    )}
                    {eventForm.type === "trabalho" && (
                      <div className="flex items-center gap-2 pt-6">
                        <Checkbox checked={eventForm.is_group} onCheckedChange={v => setEventForm(f => ({ ...f, is_group: !!v }))} />
                        <Label>Em grupo</Label>
                      </div>
                    )}
                  </div>
                  <div><Label>Descrição</Label><Input value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} /></div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button onClick={handleSaveEvent} disabled={addEvent.isPending || updateEvent.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ─── RESOLVER COM IA TAB ─── */}
          <TabsContent value="resolver" className="space-y-4">
            <ResolverIA subjectName={subject.name} />
          </TabsContent>

          {/* ─── POMODORO TAB ─── */}
          <TabsContent value="pomodoro">
            <PomodoroTimer subjectName={subject.name} subjectId={subject.id} />
          </TabsContent>

          {/* ─── CHATBOT TAB ─── */}
          <TabsContent value="chatbot" className="space-y-0">
            <div className="flex flex-col h-[calc(100vh-18rem)]">
              {/* Chat header actions */}
              <div className="flex items-center justify-between pb-3 border-b mb-3">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={createRevision}><CalendarPlus className="h-3.5 w-3.5 mr-1" /> Agendar Revisão</Button>
                  {subject.ementa_text && <Badge variant="secondary" className="text-xs">📄 Ementa carregada</Badge>}
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => { clearChat.mutate(subject.id); setChatMessages([]); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {chatMessages.length === 0 && (
                  <div className="text-center text-muted-foreground py-12 space-y-3">
                    <p className="text-lg">🎓 Especialista em {subject.name}</p>
                    <p className="text-sm">Pergunte sobre conteúdo, peça exercícios, resumos ou simulados!</p>
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      {["Resuma a matéria", "Gere exercícios", "Crie um simulado", "Mapa mental"].map(s => (
                        <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => setChatInput(s)}>{s}</Button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <Card className={`max-w-[85%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                      <CardContent className="p-3 text-sm">
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:my-2 [&_table]:rounded-md [&_table]:overflow-hidden [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:border-border">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                code({ className, children, ...props }) {
                                  const language = /language-(\w+)/.exec(className || "")?.[1];
                                  const codeText = String(children).replace(/\n$/, "");
                                  if (language === "mermaid") {
                                    return <MermaidBlock chart={codeText} />;
                                  }
                                  return <code className={className} {...props}>{children}</code>;
                                },
                              }}
                            >
                              {sanitizeLatex(msg.content)}
                            </ReactMarkdown>
                          </div>
                        ) : msg.content}
                        {msg.role === "assistant" && chatLoading && i === chatMessages.length - 1 && <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />}
                      </CardContent>
                    </Card>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2 pt-3 border-t">
                <Input placeholder={`Pergunte sobre ${subject.name}...`} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()} disabled={chatLoading} />
                <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} size="icon">
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ─── EMENTA TAB ─── */}
          <TabsContent value="ementa" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ementa da Disciplina</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Envie a ementa (PDF, TXT ou MD) para que o chatbot use como referência ao responder suas dúvidas.
                </p>

                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" className="hidden" onChange={handleEmentaUpload} />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="h-4 w-4 mr-2" />}
                  {subject.ementa_url ? "Substituir Ementa" : "Enviar Ementa"}
                </Button>

                {subject.ementa_url && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Arquivo: {subject.ementa_url.split("/").pop()}</span>
                      <Badge variant="secondary" className="text-xs">Carregado</Badge>
                    </div>

                    {subject.ementa_text && (
                      <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-2">Conteúdo extraído (usado pelo chatbot):</p>
                        <pre className="text-xs whitespace-pre-wrap font-mono">{subject.ementa_text.slice(0, 5000)}{subject.ementa_text.length > 5000 && "..."}</pre>
                      </div>
                    )}
                  </div>
                )}

                {!subject.ementa_url && (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma ementa enviada ainda</p>
                    <p className="text-xs mt-1">Formatos aceitos: PDF, TXT, MD, CSV, DOC</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ─── Resolver com IA Component ───
function ResolverIA({ subjectName }: { subjectName: string }) {
  const [content, setContent] = useState("");
  const [type, setType] = useState("prova");
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 20MB)"); return; }
    setUploading(true);
    setPdfBase64(null);
    setImageBase64(null);
    setFileName(file.name);
    const toBase64 = (buf: ArrayBuffer): string => {
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    };
    try {
      if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".csv")) {
        const text = await file.text();
        setContent(text);
        toast.success(`Arquivo "${file.name}" carregado!`);
      } else if (file.type === "application/pdf") {
        const buffer = await file.arrayBuffer();
        const base64 = toBase64(buffer);
        setPdfBase64(base64);
        setContent(`[PDF carregado: ${file.name}]`);
        toast.success(`PDF "${file.name}" carregado! A IA vai analisar o conteúdo visualmente.`);
      } else if (file.type.startsWith("image/")) {
        const buffer = await file.arrayBuffer();
        const base64 = toBase64(buffer);
        setImageBase64(base64);
        setContent(`[Imagem carregada: ${file.name}]`);
        toast.success(`Imagem "${file.name}" carregada! A IA vai extrair e resolver o conteúdo.`);
      } else {
        const text = await file.text();
        setContent(text);
        toast.success(`Arquivo "${file.name}" carregado!`);
      }
    } catch {
      toast.error("Erro ao ler arquivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSolve = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    setResult("");

    try {
      const resp = await fetch(SOLVE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          content: content.trim(), subjectName, type, instructions: instructions.trim(),
          pdfBase64: pdfBase64 || undefined,
          imageBase64: imageBase64 || undefined,
          fileName: fileName || undefined,
        }),
      });

      if (resp.status === 429) { toast.error("Limite atingido. Tente novamente em instantes."); setLoading(false); return; }
      if (resp.status === 402) { toast.error("Créditos insuficientes."); setLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error("Falha");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) { accumulated += c; setResult(accumulated); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (err) {
      toast.error("Erro ao resolver material");
    } finally {
      setLoading(false);
    }
  };

  // ─── ABNT-compliant PDF export ───
  const exportPDF = async () => {
    if (!result) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    // ABNT margins: top 30mm, left 30mm, bottom 20mm, right 20mm
    const marginLeft = 30;
    const marginRight = 20;
    const marginTop = 30;
    const marginBottom = 20;
    const pageWidth = 210 - marginLeft - marginRight; // 160mm usable
    const pageHeight = 297;
    let y = marginTop;
    let pageNum = 1;

    const addPage = () => {
      doc.addPage();
      pageNum++;
      y = marginTop;
      // Page number top-right (ABNT)
      doc.setFontSize(10);
      doc.setFont("times", "normal");
      doc.text(String(pageNum), 210 - marginRight, 15, { align: "right" });
    };

    const checkPage = (needed: number) => {
      if (y + needed > pageHeight - marginBottom) addPage();
    };

    // First page number
    doc.setFontSize(10);
    doc.setFont("times", "normal");

    const lines = result.split("\n");

    for (const rawLine of lines) {
      const line = rawLine.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "");

      // Heading 1: # or 1 SECTION
      if (line.match(/^#{1}\s/) || line.match(/^\d+\s+[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇ]{2,}/)) {
        checkPage(12);
        y += 6;
        doc.setFontSize(14);
        doc.setFont("times", "bold");
        const heading = line.replace(/^#+\s*/, "").toUpperCase();
        doc.text(heading, marginLeft, y);
        y += 8;
        doc.setFontSize(12);
        doc.setFont("times", "normal");
      }
      // Heading 2: ##
      else if (line.match(/^#{2}\s/)) {
        checkPage(10);
        y += 4;
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text(line.replace(/^#+\s*/, ""), marginLeft, y);
        y += 7;
        doc.setFont("times", "normal");
      }
      // Heading 3: ###
      else if (line.match(/^#{3,}\s/)) {
        checkPage(8);
        y += 3;
        doc.setFontSize(12);
        doc.setFont("times", "italic");
        doc.text(line.replace(/^#+\s*/, ""), marginLeft, y);
        y += 6;
        doc.setFont("times", "normal");
      }
      // Empty line → paragraph spacing
      else if (line.trim() === "") {
        y += 4;
      }
      // Long citation (starts with >)
      else if (line.startsWith(">")) {
        const citText = line.replace(/^>\s*/, "");
        doc.setFontSize(10);
        const citLines = doc.splitTextToSize(citText, pageWidth - 40); // extra 40mm indent = recuo 4cm
        for (const cl of citLines) {
          checkPage(5);
          doc.text(cl, marginLeft + 40, y);
          y += 4; // single spacing for citations
        }
        doc.setFontSize(12);
        y += 2;
      }
      // Regular paragraph
      else {
        doc.setFontSize(12);
        doc.setFont("times", "normal");
        const wrapped = doc.splitTextToSize(line, pageWidth);
        let first = true;
        for (const wl of wrapped) {
          checkPage(6);
          // ABNT paragraph indent 1.25cm = ~12.5mm on first line
          const indent = first ? 12.5 : 0;
          doc.text(wl, marginLeft + indent, y);
          y += 6; // ~1.5 line spacing at 12pt
          first = false;
        }
        y += 1;
      }
    }

    doc.save(`resolucao-${subjectName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast.success("PDF exportado com formatação ABNT!");
  };

  // ─── ABNT-compliant DOCX export ───
  const exportDOCX = async () => {
    if (!result) return;
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, convertMillimetersToTwip, PageBreak } = await import("docx");

    const FONT = "Times New Roman";
    const SIZE_12 = 24; // half-points
    const SIZE_10 = 20;
    const LINE_SPACING_1_5 = 360; // 1.5 lines in twips
    const LINE_SPACING_SINGLE = 240;
    const INDENT_FIRST_LINE = convertMillimetersToTwip(12.5); // 1.25cm

    const paragraphs: any[] = [];
    const lines = result.split("\n");

    // Helper to parse inline bold/italic from markdown
    const parseInlineFormatting = (text: string, fontSize: number): any[] => {
      const runs: any[] = [];
      // Match **bold**, *italic*, ***bold-italic***, and plain text
      const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[2]) {
          runs.push(new TextRun({ text: match[2], bold: true, italics: true, font: FONT, size: fontSize }));
        } else if (match[3]) {
          runs.push(new TextRun({ text: match[3], bold: true, font: FONT, size: fontSize }));
        } else if (match[4]) {
          runs.push(new TextRun({ text: match[4], italics: true, font: FONT, size: fontSize }));
        } else if (match[5]) {
          runs.push(new TextRun({ text: match[5].replace(/`/g, ""), font: FONT, size: fontSize }));
        }
      }
      return runs.length ? runs : [new TextRun({ text: text.replace(/[*`]/g, ""), font: FONT, size: fontSize })];
    };

    for (const rawLine of lines) {
      const line = rawLine;

      // Heading 1
      if (line.match(/^#{1}\s/) || line.match(/^\d+\s+[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇ]{2,}/)) {
        const text = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: text.toUpperCase(), bold: true, font: FONT, size: SIZE_12 })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120, line: LINE_SPACING_1_5 },
        }));
      }
      // Heading 2
      else if (line.match(/^#{2}\s/)) {
        const text = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text, bold: true, font: FONT, size: SIZE_12 })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100, line: LINE_SPACING_1_5 },
        }));
      }
      // Heading 3+
      else if (line.match(/^#{3,}\s/)) {
        const text = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text, bold: true, italics: true, font: FONT, size: SIZE_12 })],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80, line: LINE_SPACING_1_5 },
        }));
      }
      // Empty line
      else if (line.trim() === "") {
        paragraphs.push(new Paragraph({ text: "", spacing: { line: LINE_SPACING_1_5 } }));
      }
      // Blockquote / long citation (ABNT: recuo 4cm, font 10, single spacing)
      else if (line.startsWith(">")) {
        const text = line.replace(/^>\s*/, "");
        paragraphs.push(new Paragraph({
          children: parseInlineFormatting(text, SIZE_10),
          indent: { left: convertMillimetersToTwip(40) },
          spacing: { line: LINE_SPACING_SINGLE },
        }));
      }
      // Bullet list
      else if (line.match(/^[-•]\s/)) {
        const text = line.replace(/^[-•]\s*/, "");
        paragraphs.push(new Paragraph({
          children: parseInlineFormatting(text, SIZE_12),
          indent: { left: convertMillimetersToTwip(12.5) },
          spacing: { line: LINE_SPACING_1_5 },
          bullet: { level: 0 },
        }));
      }
      // Regular paragraph with ABNT first-line indent
      else {
        paragraphs.push(new Paragraph({
          children: parseInlineFormatting(line, SIZE_12),
          indent: { firstLine: INDENT_FIRST_LINE },
          spacing: { line: LINE_SPACING_1_5 },
          alignment: AlignmentType.JUSTIFIED,
        }));
      }
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(30),
              right: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(30),
            },
          },
        },
        children: paragraphs,
      }],
    });

    const blob = await Packer.toBlob(doc);
    const { saveAs } = await import("file-saver");
    saveAs(blob, `resolucao-${subjectName.replace(/\s+/g, "-").toLowerCase()}.docx`);
    toast.success("DOCX exportado com formatação ABNT!");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Resolver Material com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de material</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prova">Prova / Exame</SelectItem>
                  <SelectItem value="trabalho">Trabalho Acadêmico</SelectItem>
                  <SelectItem value="relatorio">Relatório</SelectItem>
                  <SelectItem value="exercicio">Lista de Exercícios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload (opcional)</Label>
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.doc,.docx,.pdf,.jpg,.jpeg,.png,.webp,.heic" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {fileName ? fileName : "Enviar arquivo"}
              </Button>
              {(pdfBase64 || imageBase64) && (
                <p className="text-xs text-emerald-600 mt-1">✓ Arquivo carregado — a IA vai analisar visualmente</p>
              )}
            </div>
          </div>

          <div>
            <Label>Conteúdo do material (cole as questões, enunciado, etc.)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cole aqui o conteúdo da prova, trabalho ou exercício..."
              className="min-h-[150px] font-mono text-sm"
            />
          </div>

          <div>
            <Label>Instruções adicionais (opcional)</Label>
            <Input
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ex: Inclua referências, resolva apenas as questões 1-5..."
            />
          </div>

          <Button onClick={handleSolve} disabled={loading || !content.trim()} className="w-full sm:w-auto gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Resolvendo..." : "Resolver com IA"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Resolução</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1">
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportDOCX} className="gap-1">
                  <Download className="h-3.5 w-3.5" /> DOCX
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              ref={resultRef}
              className="academic-result prose prose-sm dark:prose-invert max-w-none
                [&_h1]:text-lg [&_h1]:font-bold [&_h1]:uppercase [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2
                [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2
                [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
                [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3 [&_p]:text-justify
                [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:pl-5 [&_ol]:mb-3
                [&_li]:text-sm [&_li]:mb-1 [&_li]:leading-relaxed
                [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:my-4 [&_table]:rounded-md [&_table]:overflow-hidden
                [&_thead]:bg-muted
                [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-xs
                [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-xs
                [&_tr:nth-child(even)]:bg-muted/30
                [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-4 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:my-3
                [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
                [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:px-0 [&_pre_code]:py-0
                [&_blockquote]:border-l-4 [&_blockquote]:border-primary/60 [&_blockquote]:pl-4 [&_blockquote]:pr-2 [&_blockquote]:py-2 [&_blockquote]:my-4 [&_blockquote]:bg-muted/20 [&_blockquote]:rounded-r-md [&_blockquote]:italic [&_blockquote]:text-sm
                [&_hr]:border-border [&_hr]:my-6
                [&_.katex]:text-sm
                [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto
                [&_strong]:font-bold [&_em]:italic"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code({ className, children, ...props }) {
                    const language = /language-(\w+)/.exec(className || "")?.[1];
                    const codeText = String(children).replace(/\n$/, "");
                    if (language === "mermaid") {
                      return <MermaidBlock chart={codeText} />;
                    }
                    return <code className={className} {...props}>{children}</code>;
                  },
                }}
              >
                {sanitizeLatex(result)}
              </ReactMarkdown>
              {loading && <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}