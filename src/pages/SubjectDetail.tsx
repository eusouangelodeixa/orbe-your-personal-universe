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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Loader2, FileText, ClipboardList, BookOpen, RotateCw,
  Send, ArrowLeft, CalendarPlus, Upload, Pencil, User, GraduationCap, Clock, MessageSquare, FileUp, Timer,
} from "lucide-react";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSubjects, useUpdateSubject, useDeleteSubject,
  useAcademicEvents, useAddAcademicEvent, useUpdateAcademicEvent, useDeleteAcademicEvent,
  useSubjectChatMessages, useAddSubjectChatMessage, useClearSubjectChat,
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

// ─── Chat streaming ───
interface Message { role: "user" | "assistant"; content: string; }

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
    content_topics: "", weight: "", is_group: false, status: "pendente",
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
    setEventForm({ type: "prova", title: "", description: "", event_date: "", content_topics: "", weight: "", is_group: false, status: "pendente" });
    setEventOpen(true);
  };
  const openEditEvent = (ev: AcademicEvent) => {
    setEditingEventId(ev.id);
    setEventForm({
      type: ev.type, title: ev.title, description: ev.description || "",
      event_date: ev.event_date.slice(0, 16), content_topics: ev.content_topics || "",
      weight: ev.weight?.toString() || "", is_group: ev.is_group, status: ev.status,
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
      due_date: tomorrow.toISOString(), content_topics: null, weight: null, is_group: false, status: "pendente", reminder_config: [],
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
        <Tabs defaultValue="agenda" className="space-y-4">
          <TabsList>
            <TabsTrigger value="agenda">📅 Agenda</TabsTrigger>
            <TabsTrigger value="pomodoro">⏱️ Pomodoro</TabsTrigger>
            <TabsTrigger value="chatbot">🤖 Chatbot</TabsTrigger>
            <TabsTrigger value="ementa">📄 Ementa</TabsTrigger>
          </TabsList>

          {/* ─── AGENDA TAB ─── */}
          <TabsContent value="agenda" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Eventos ({events.length})</h2>
              <Button size="sm" onClick={openCreateEvent}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
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
                    <Card key={ev.id} className="group opacity-60">
                      <CardContent className="flex items-center gap-3 py-2 px-4">
                        <Icon className={`h-4 w-4 shrink-0 ${meta?.color}`} />
                        <span className="flex-1 text-sm line-through">{ev.title}</span>
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
                    {eventForm.type === "prova" && <div><Label>Peso</Label><Input type="number" value={eventForm.weight} onChange={e => setEventForm(f => ({ ...f, weight: e.target.value }))} /></div>}
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
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
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
