import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Loader2, Dumbbell, Trash2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sanitizeLatex } from "@/lib/sanitizeLatex";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  source?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fit-chat`;

const SUGGESTIONS = [
  "O que comer no pré-treino?",
  "Quanto de proteína devo consumir por dia?",
  "Ajuste meu plano, mudei meu objetivo",
  "Substituições baratas para frango?",
];

export default function FitChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user) loadMessages(); }, [user]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("agent_chat_messages" as any)
      .select("*")
      .eq("user_id", user!.id)
      .eq("agent", "fit")
      .order("created_at", { ascending: true });
    setMessages((data as any) || []);
    setLoading(false);
  };

  const sendMessage = async (text?: string) => {
    const userMsg = (text || input).trim();
    if (!userMsg || sending) return;
    setInput("");
    setSending(true);

    const tempUserMsg: Message = { id: crypto.randomUUID(), role: "user", content: userMsg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);

    await supabase.from("agent_chat_messages" as any).insert({ user_id: user!.id, agent: "fit", role: "user", content: userMsg, source: "web" } as any);

    let assistantContent = "";
    const tempAssistantId = crypto.randomUUID();

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      let extraContext = "";
      const [workoutRes, mealRes] = await Promise.all([
        supabase.from("fit_workout_plans" as any).select("title, plan_data").eq("user_id", user!.id).eq("active", true).maybeSingle(),
        supabase.from("fit_meal_plans" as any).select("title, plan_data").eq("user_id", user!.id).eq("active", true).maybeSingle(),
      ]);
      if (workoutRes.data) extraContext += `\n[Plano de treino ativo: ${(workoutRes.data as any).title}]`;
      if (mealRes.data) extraContext += `\n[Plano alimentar ativo: ${(mealRes.data as any).title}]`;

      const allMsgs = [...messages, tempUserMsg].map(m => ({ role: m.role, content: m.content }));
      if (extraContext) {
        allMsgs[allMsgs.length - 1] = { ...allMsgs[allMsgs.length - 1], content: allMsgs[allMsgs.length - 1].content + extraContext };
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: allMsgs }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Limite de requisições atingido.");
        else if (resp.status === 402) toast.error("Créditos insuficientes.");
        else toast.error("Erro ao gerar resposta");
        setSending(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      setMessages(prev => [...prev, { id: tempAssistantId, role: "assistant", content: "", created_at: new Date().toISOString() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map(m => m.id === tempAssistantId ? { ...m, content: assistantContent } : m));
            }
          } catch {}
        }
      }

      if (assistantContent) {
        await supabase.from("agent_chat_messages" as any).insert({ user_id: user!.id, agent: "fit", role: "assistant", content: assistantContent, source: "web" } as any);
      }
    } catch (err) {
      console.error("Chat error:", err);
      toast.error("Erro na comunicação com o assistente");
    }
    setSending(false);
  };

  const clearChat = async () => {
    await supabase.from("agent_chat_messages" as any).delete().eq("user_id", user!.id).eq("agent", "fit");
    setMessages([]);
    toast.success("Histórico limpo");
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)] max-w-3xl mx-auto">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10"><Dumbbell className="h-5 w-5 text-primary" /></div>
            <div>
              <h1 className="text-lg font-bold">Nutricionista IA</h1>
              <p className="text-xs text-muted-foreground">Especialista em nutrição e fitness</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground">
              <Trash2 className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground">Olá! Sou seu nutricionista pessoal IA.</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                  {SUGGESTIONS.map((s, i) => (
                    <Button key={i} variant="outline" size="sm" className="text-xs h-auto py-1.5" onClick={() => sendMessage(s)}>
                      <Sparkles className="h-3 w-3 mr-1" /> {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}>
                  {msg.source === "whatsapp" && (
                    <span className="text-[10px] opacity-60 block mb-1">📱 via WhatsApp</span>
                  )}
                  {msg.content ? (
                    msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{sanitizeLatex(msg.content)}</ReactMarkdown>
                      </div>
                    ) : msg.content
                  ) : (
                    sending && <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </ScrollArea>

          <div className="p-4 border-t">
            <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Pergunte sobre treino, alimentação, suplementos..."
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" disabled={sending || !input.trim()} size="icon">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
