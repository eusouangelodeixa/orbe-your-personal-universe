import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, Trash2, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useSubjects, useSubjectChatMessages, useAddSubjectChatMessage, useClearSubjectChat } from "@/hooks/useStudies";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subject-chat`;

async function streamChat({ messages, subjectName, subjectType, onDelta, onDone }: {
  messages: Message[]; subjectName: string; subjectType: string;
  onDelta: (t: string) => void; onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ messages, subjectName, subjectType }),
  });
  if (resp.status === 429) { toast.error("Limite atingido. Tente novamente em instantes."); throw new Error("Rate limited"); }
  if (resp.status === 402) { toast.error("Créditos insuficientes."); throw new Error("Payment required"); }
  if (!resp.ok || !resp.body) throw new Error("Falha ao conectar");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
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
      try {
        const c = JSON.parse(json).choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

export default function SubjectChat() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { data: subjects = [] } = useSubjects();
  const subject = subjects.find(s => s.id === subjectId);
  const { data: history = [] } = useSubjectChatMessages(subjectId || "");
  const addMsg = useAddSubjectChatMessage();
  const clearChat = useClearSubjectChat();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (history.length && messages.length === 0) {
      setMessages(history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  }, [history]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || isLoading || !subject) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setIsLoading(true);

    addMsg.mutate({ subject_id: subject.id, role: "user", content: userMsg.content });

    let assistant = "";
    const upsert = (chunk: string) => {
      assistant += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistant } : m);
        return [...prev, { role: "assistant", content: assistant }];
      });
    };

    try {
      await streamChat({
        messages: newMsgs, subjectName: subject.name, subjectType: subject.type,
        onDelta: upsert,
        onDone: () => {
          setIsLoading(false);
          addMsg.mutate({ subject_id: subject.id, role: "assistant", content: assistant });
        },
      });
    } catch { setIsLoading(false); }
  };

  if (!subject) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">Disciplina não encontrada</p>
        <Button onClick={() => navigate("/disciplinas")}>Voltar</Button>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/disciplinas")}><ArrowLeft className="h-4 w-4" /></Button>
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
          <div className="flex-1">
            <h1 className="text-lg font-bold">{subject.name}</h1>
            <p className="text-xs text-muted-foreground">Especialista IA • {subject.teacher || "Professor não informado"}</p>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => { clearChat.mutate(subject.id); setMessages([]); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12 space-y-2">
              <p className="text-lg">🎓 Especialista em {subject.name}</p>
              <p className="text-sm">Pergunte sobre conteúdo, peça exercícios, resumos ou simulados!</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <Card className={`max-w-[85%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                <CardContent className="p-3 text-sm">
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  ) : msg.content}
                  {msg.role === "assistant" && isLoading && i === messages.length - 1 && <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />}
                </CardContent>
              </Card>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 pt-3 border-t">
          <Input placeholder={`Pergunte sobre ${subject.name}...`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} disabled={isLoading} />
          <Button onClick={send} disabled={isLoading || !input.trim()} size="icon">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
