import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const { messages, financialContext } = await req.json();

    // Build auth header — Consultor uses anon key from frontend, so we pass it through
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
    };
    if (authHeader) headers["Authorization"] = authHeader;

    // Build extra context from financialContext if provided (for backwards compat)
    let extraSystemPrompt = "";
    if (financialContext) {
      const fc = financialContext;
      const cur = fc.currencyCode || "BRL";
      const CURRENCY_SYMBOLS: Record<string, string> = { BRL: "R$", USD: "$", EUR: "€", GBP: "£", MZN: "MT", JPY: "¥" };
      const sym = CURRENCY_SYMBOLS[cur] || cur;
      const fmtMoney = (v: number) => `${sym} ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: cur === "JPY" ? 0 : 2 })}`;

      extraSystemPrompt = `DADOS FINANCEIROS DO USUÁRIO (mês ${fc.month}/${fc.year}, moeda: ${cur}):
Renda total: ${fmtMoney(fc.totalIncome)}
Gastos total: ${fmtMoney(fc.totalExpenses)} (pagos: ${fmtMoney(fc.paidExpenses)}, pendentes: ${fmtMoney(fc.pendingExpenses)})
Carteiras: ${(fc.wallets || []).map((w: any) => `${w.name} (${w.currency || cur}): ${fmtMoney(w.balance)}`).join(", ")}
Patrimônio total: ${fmtMoney(fc.totalWallets)}
Disponível: ${fmtMoney(fc.availableBalance)}
Fluxo mensal: ${fmtMoney(fc.monthlyFlow)} (${fc.commitmentPercent}% comprometido)
Metas: ${(fc.savingsGoals || []).map((g: any) => `${g.name}: ${fmtMoney(g.current_amount)}/${fmtMoney(g.target_amount)}`).join(", ") || "Nenhuma"}
IMPORTANTE: Formate todos os valores monetários usando ${cur} (${sym}).`;
    }

    const orchestratorUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-orchestrator`;
    const resp = await fetch(orchestratorUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        agent: "finance",
        extraSystemPrompt: extraSystemPrompt || undefined,
      }),
    });

    return new Response(resp.body, {
      status: resp.status,
      headers: {
        ...corsHeaders,
        "Content-Type": resp.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (e) {
    console.error("chat proxy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
