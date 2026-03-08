import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Loader2, Dumbbell, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fit-chat`;

export default function FitChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadMessages();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("fit_chat_messages" as any)
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true });
    setMessages((data as any) || []);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);

    // Optimistic: add user message
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMsg,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    // Save user message to DB
    await supabase.from("fit_chat_messages" as any).insert({
      user_id: user!.id,
      role: "user",
      content: userMsg,
    } as any);

    // Stream AI response
    let assistantContent = "";
    const tempAssistantId = crypto.randomUUID();

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, tempUserMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          toast.error("Limite de requisições atingido. Tente novamente em breve.");
        } else if (resp.status === 402) {
          toast.error("Créditos insuficientes.");
        } else {
          toast.error("Erro ao gerar resposta");
        }
        setSending(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      // Add placeholder assistant message
      setMessages(prev => [...prev, { id: tempAssistantId, role: "assistant", content: "", created_at: new Date().toISOString() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map(m => m.id === tempAssistantId ? { ...m, content: assistantContent } : m)
              );
            }
          } catch { /* partial JSON */ }
        }
      }

      // Save assistant message to DB
      if (assistantContent) {
        await supabase.from("fit_chat_messages" as any).insert({
          user_id: user!.id,
          role: "assistant",
          content: assistantContent,
        } as any);
      }
    } catch (err) {
      console.error("Chat error:", err);
      toast.error("Erro na comunicação com o assistente");
    }

    setSending(false);
  };

  const clearChat = async () => {
    await supabase.from("fit_chat_messages" as any).delete().eq("user_id", user!.id);
    setMessages([]);
    toast.success("Histórico limpo");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)] max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Nutricionista IA</h1>
              <p className="text-xs text-muted-foreground">Especialista em nutrição e fitness</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground">
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        {/* Messages */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground">Olá! Sou seu nutricionista pessoal IA.</p>
                <p className="text-sm text-muted-foreground">
                  Pergunte sobre treinos, alimentação, suplementação, ou relate seu progresso!
                </p>
              </div>
            )}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  {msg.content || (sending && <Loader2 className="h-4 w-4 animate-spin" />)}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <form
              onSubmit={e => { e.preventDefault(); sendMessage(); }}
              className="flex gap-2"
            >
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
