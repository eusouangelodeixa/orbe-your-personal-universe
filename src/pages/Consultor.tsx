import { useState, useRef, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Loader2, Trash2 } from "lucide-react";
import { OrbeIcon } from "@/components/OrbeIcon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sanitizeLatex } from "@/lib/sanitizeLatex";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIncomes, useExpenses, useWallets, useSavingsGoals } from "@/hooks/useFinance";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useExchangeRates, convertToBRL } from "@/hooks/useExchangeRates";
import { format } from "date-fns";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  source?: string;
}

const ORCHESTRATOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-orchestrator`;

function buildFinancialPrompt(fc: any, formatMoney: (v: number) => string, currencyCode: string): string {
  const fmt = formatMoney;

  const pendingList = (fc.expensesList || []).filter((e: any) => !e.paid);
  const paidList = (fc.expensesList || []).filter((e: any) => e.paid);

  let prompt = `DADOS FINANCEIROS DO USUÁRIO (mês ${fc.month}/${fc.year}, moeda: ${currencyCode}):
Renda total: ${fmt(fc.totalIncome)}
Gastos total: ${fmt(fc.totalExpenses)} (pagos: ${fmt(fc.paidExpenses)}, pendentes: ${fmt(fc.pendingExpenses)})
Carteiras: ${(fc.wallets || []).map((w: any) => `${w.name} (${w.currency}): ${fmt(w.balance)}${w.currency !== currencyCode ? ` → ${fmt(w.balanceConverted)} em ${currencyCode}` : ""}`).join(", ")}
Patrimônio total: ${fmt(fc.totalWallets)}
Disponível: ${fmt(fc.availableBalance)}
Fluxo mensal: ${fmt(fc.monthlyFlow)} (${fc.commitmentPercent}% comprometido)
Metas: ${(fc.savingsGoals || []).map((g: any) => `${g.name}: ${fmt(g.current_amount)}/${fmt(g.target_amount)}`).join(", ") || "Nenhuma"}`;

  if (pendingList.length > 0) {
    prompt += `\n\nCONTAS PENDENTES (por pagar):`;
    pendingList.forEach((e: any) => {
      prompt += `\n- ${e.name}: ${fmt(e.amount)} (vence ${e.due_date})`;
    });
  } else {
    prompt += `\n\nCONTAS PENDENTES: Nenhuma`;
  }

  if (paidList.length > 0) {
    prompt += `\n\nCONTAS PAGAS:`;
    paidList.forEach((e: any) => {
      prompt += `\n- ${e.name}: ${fmt(e.amount)}`;
    });
  } else {
    prompt += `\n\nCONTAS PAGAS: Nenhuma`;
  }

  prompt += `\n\nIMPORTANTE: A moeda do usuário é ${currencyCode}. Formate TODOS os valores monetários usando ${currencyCode}. Quando o usuário perguntar sobre "contas por pagar" ou "pendentes", liste APENAS as contas pendentes. Quando perguntar sobre "contas pagas", liste APENAS as pagas. Só mostre o resumo completo quando pedir "resumo" ou uma visão geral.`;

  return prompt;
}

export default function Consultor() {
  const { user } = useAuth();
  const { currency, formatMoney } = useCurrency();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: incomes = [] } = useIncomes(month, year);
  const { data: expenses = [] } = useExpenses(month, year);
  const { data: wallets = [] } = useWallets();
  const { data: savingsGoals = [] } = useSavingsGoals();

  // Collect all unique wallet currencies to fetch exchange rates
  const walletCurrencies = useMemo(() => {
    const codes = new Set(wallets.map(w => (w as any).currency || "BRL"));
    codes.add(currency.code);
    return Array.from(codes);
  }, [wallets, currency.code]);
  const { data: exchangeRatesData } = useExchangeRates(walletCurrencies);
  const rates = exchangeRatesData?.rates;

  // Helper: convert any amount from a given currency to the user's display currency
  const toUserCurrency = (amount: number, fromCurrency: string): number => {
    if (fromCurrency === currency.code) return amount;
    // Convert foreign → BRL first, then BRL → user currency
    const inBRL = convertToBRL(amount, fromCurrency, rates);
    if (currency.code === "BRL") return inBRL;
    // BRL → user currency: multiply by rate
    const userRate = rates?.[currency.code];
    return userRate ? inBRL * userRate : inBRL;
  };

  const financialContext = useMemo(() => {
    const totalIncome = incomes.reduce((a, i) => a + Number(i.amount), 0);
    const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
    const paidExpenses = expenses.filter(e => e.paid).reduce((a, e) => a + Number(e.amount), 0);
    const pendingExpenses = totalExpenses - paidExpenses;
    // Convert each wallet balance to user's currency before summing
    const totalWallets = wallets.reduce((a, w) => {
      const wCurrency = (w as any).currency || "BRL";
      return a + toUserCurrency(Number(w.balance), wCurrency);
    }, 0);
    return {
      month, year, totalIncome, totalExpenses, paidExpenses, pendingExpenses,
      totalWallets, availableBalance: totalWallets - pendingExpenses,
      monthlyFlow: totalIncome - totalExpenses,
      commitmentPercent: totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0,
      wallets: wallets.map(w => {
        const wCurrency = (w as any).currency || "BRL";
        return {
          name: w.name,
          balance: Number(w.balance),
          balanceConverted: toUserCurrency(Number(w.balance), wCurrency),
          currency: wCurrency,
        };
      }),
      savingsGoals: savingsGoals.map((g: any) => ({ name: g.name, target_amount: Number(g.target_amount), current_amount: Number(g.current_amount) })),
      expensesList: expenses.map(e => ({ name: e.name, amount: Number(e.amount), paid: e.paid, due_date: e.due_date })),
    };
  }, [incomes, expenses, wallets, savingsGoals, month, year, currency.code, rates]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user) loadMessages(); }, [user]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("agent_chat_messages" as any)
      .select("*")
      .eq("user_id", user!.id)
      .eq("agent", "finance")
      .order("created_at", { ascending: true });
    setMessages((data as any) || []);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: input.trim(), created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    await supabase.from("agent_chat_messages" as any).insert({ user_id: user!.id, agent: "finance", role: "user", content: userMsg.content, source: "web" } as any);

    let assistantContent = "";
    const tempAssistantId = crypto.randomUUID();

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const allMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const extraSystemPrompt = buildFinancialPrompt(financialContext, formatMoney, currency.code);

      const resp = await fetch(ORCHESTRATOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: allMsgs, agent: "finance", extraSystemPrompt }),
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
        await supabase.from("agent_chat_messages" as any).insert({ user_id: user!.id, agent: "finance", role: "assistant", content: assistantContent, source: "web" } as any);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro na comunicação com o consultor");
    }
    setSending(false);
  };

  const clearChat = async () => {
    await supabase.from("agent_chat_messages" as any).delete().eq("user_id", user!.id).eq("agent", "finance");
    setMessages([]);
    toast.success("Histórico limpo");
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold font-display">Consultor Financeiro IA</h1>
            <p className="text-muted-foreground">Converse com seu assistente financeiro pessoal</p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground">
              <Trash2 className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <OrbeIcon size={48} />
                <p className="text-muted-foreground mt-4">Olá! Sou o Consultor Financeiro do ORBE 🟢</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Tenho acesso completo aos seus dados financeiros. Pergunte qualquer coisa!</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 mt-1"><OrbeIcon size={28} /></div>
                )}
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {msg.source === "whatsapp" && (
                    <span className="text-[10px] opacity-60 block mb-1">📱 via WhatsApp</span>
                  )}
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{sanitizeLatex(msg.content)}</ReactMarkdown>
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
            {sending && messages[messages.length - 1]?.role !== "assistant" && (
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
                disabled={sending}
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
