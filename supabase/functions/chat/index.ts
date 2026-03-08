import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, financialContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build financial snapshot for the system prompt
    let financialSnapshot = "";
    if (financialContext) {
      const fc = financialContext;
      const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

      financialSnapshot = `\n\n--- DADOS FINANCEIROS DO USUÁRIO (mês ${fc.month}/${fc.year}) ---
Renda total: ${fmtBRL(fc.totalIncome)}
Rendas: ${(fc.incomes || []).map((i: any) => `${i.description}: ${fmtBRL(i.amount)}${i.wallet ? ` (${i.wallet})` : ""}`).join("; ") || "Nenhuma"}

Gastos total: ${fmtBRL(fc.totalExpenses)}
Gastos pagos: ${fmtBRL(fc.paidExpenses)} | Gastos pendentes: ${fmtBRL(fc.pendingExpenses)}
Lista de gastos: ${(fc.expenses || []).map((e: any) => `${e.name}: ${fmtBRL(e.amount)} (${e.paid ? "✅ pago" : "⏳ pendente"}, vence ${e.due_date}${e.category ? `, cat: ${e.category}` : ""}${e.wallet ? `, carteira: ${e.wallet}` : ""})`).join("; ") || "Nenhum"}

Carteiras/Bancos:
${(fc.wallets || []).map((w: any) => `- ${w.name}: ${fmtBRL(w.balance)}${w.is_default ? " (principal)" : ""}`).join("\n") || "Nenhuma"}
Patrimônio total: ${fmtBRL(fc.totalWallets)}
Disponível real (patrimônio - pendentes): ${fmtBRL(fc.availableBalance)}

Fluxo mensal (renda - gastos): ${fmtBRL(fc.monthlyFlow)}
Comprometimento: ${fc.commitmentPercent}%

Metas de poupança: ${(fc.savingsGoals || []).map((g: any) => `${g.name}: ${fmtBRL(g.current_amount)}/${fmtBRL(g.target_amount)}${g.deadline ? ` (prazo: ${g.deadline})` : ""}`).join("; ") || "Nenhuma"}
--- FIM DOS DADOS ---`;
    }

    const systemPrompt = `Você é o Consultor Financeiro do ORBE, um assistente especialista em finanças pessoais e domésticas.

Suas responsabilidades:
- Analisar os dados financeiros reais do usuário (fornecidos abaixo) para dar respostas personalizadas
- Dar dicas práticas de economia e planejamento financeiro baseadas nos dados reais
- Ajudar com orçamento, investimentos básicos e controle de dívidas
- Alertar sobre gastos pendentes, comprometimento alto, ou metas em risco
- Responder de forma clara, objetiva e empática em português brasileiro
- Usar formatação markdown quando útil (listas, negrito, etc.)
- Ser proativo em sugerir melhorias financeiras com base nos números reais

IMPORTANTE: Você TEM acesso aos dados financeiros reais do usuário. Use-os para personalizar todas as suas respostas. Não peça ao usuário para informar dados que você já tem.

Mantenha respostas concisas mas completas. Use emojis com moderação.${financialSnapshot}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
