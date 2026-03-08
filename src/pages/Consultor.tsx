import { useState, useRef, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User } from "lucide-react";
import { OrbeIcon } from "@/components/OrbeIcon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sanitizeLatex } from "@/lib/sanitizeLatex";
import { toast } from "sonner";
import { useIncomes, useExpenses, useWallets, useSavingsGoals } from "@/hooks/useFinance";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

async function streamChat({
  messages,
  financialContext,
  onDelta,
  onDone,
}: {
  messages: Message[];
  financialContext: object;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, financialContext }),
  });

  if (resp.status === 429) {
    toast.error("Limite de requisições atingido. Tente novamente em instantes.");
    throw new Error("Rate limited");
  }
  if (resp.status === 402) {
    toast.error("Créditos insuficientes para IA.");
    throw new Error("Payment required");
  }
  if (!resp.ok || !resp.body) throw new Error("Falha ao conectar com IA");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export default function Consultor() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Fetch financial data
  const { data: incomes = [] } = useIncomes(month, year);
  const { data: expenses = [] } = useExpenses(month, year);
  const { data: wallets = [] } = useWallets();
  const { data: savingsGoals = [] } = useSavingsGoals();

  // Build financial context for AI
  const financialContext = useMemo(() => {
    const totalIncome = incomes.reduce((a, i) => a + Number(i.amount), 0);
    const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
    const paidExpenses = expenses.filter(e => e.paid).reduce((a, e) => a + Number(e.amount), 0);
    const pendingExpenses = totalExpenses - paidExpenses;
    const totalWallets = wallets.reduce((a, w) => a + Number(w.balance), 0);
    const availableBalance = totalWallets - pendingExpenses;
    const monthlyFlow = totalIncome - totalExpenses;
    const commitmentPercent = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;

    return {
      month,
      year,
      totalIncome,
      totalExpenses,
      paidExpenses,
      pendingExpenses,
      totalWallets,
      availableBalance,
      monthlyFlow,
      commitmentPercent,
      incomes: incomes.map((i: any) => ({
        description: i.description,
        amount: Number(i.amount),
        wallet: i.wallets?.name || null,
      })),
      expenses: expenses.map((e: any) => ({
        name: e.name,
        amount: Number(e.amount),
        paid: e.paid,
        due_date: e.due_date,
        category: e.categories?.name || null,
        wallet: e.wallets?.name || null,
      })),
      wallets: wallets.map(w => ({
        name: w.name,
        balance: Number(w.balance),
        is_default: w.is_default,
      })),
      savingsGoals: savingsGoals.map((g: any) => ({
        name: g.name,
        target_amount: Number(g.target_amount),
        current_amount: Number(g.current_amount),
        deadline: g.deadline,
      })),
    };
  }, [incomes, expenses, wallets, savingsGoals, month, year]);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou o **Consultor Financeiro do ORBE** 🟢\n\nTenho acesso completo aos seus dados financeiros: saldos, gastos, rendas e metas. Pergunte qualquer coisa sobre suas finanças!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length > 1 && last.content === assistantSoFar.slice(0, -chunk.length)) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        if (last?.role === "assistant" && assistantSoFar.length > chunk.length) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant" as const, content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        financialContext,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        <div className="mb-4">
          <h1 className="text-3xl font-bold font-display">Consultor Financeiro IA</h1>
          <p className="text-muted-foreground">Converse com seu assistente financeiro pessoal</p>
        </div>

        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 mt-1"><OrbeIcon size={28} /></div>
                )}
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="shrink-0 mt-1 w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3">
                <OrbeIcon size={28} />
                <div className="bg-muted rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <div className="border-t border-border p-4">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre suas finanças..."
                maxLength={500}
                disabled={loading}
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
