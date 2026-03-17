import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; decimals: number }> = {
  BRL: { symbol: "R$", locale: "pt-BR", decimals: 2 },
  USD: { symbol: "$", locale: "en-US", decimals: 2 },
  EUR: { symbol: "€", locale: "de-DE", decimals: 2 },
  GBP: { symbol: "£", locale: "en-GB", decimals: 2 },
  MZN: { symbol: "MT", locale: "pt-MZ", decimals: 2 },
  JPY: { symbol: "¥", locale: "ja-JP", decimals: 0 },
};

function fmtMoney(v: number, currencyCode = "BRL") {
  const cfg = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.BRL;
  const formatted = Number(v).toLocaleString(cfg.locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  });
  if (currencyCode === "MZN") return formatted.replace(/MTn|MTN/g, "MT");
  return formatted;
}

async function fetchExchangeRates(baseCurrency: string, currencies: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(currencies.filter(c => c && c !== baseCurrency))];
  if (!unique.length) return {};
  try {
    const resp = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
    if (!resp.ok) {
      console.warn(`Exchange rate API error: ${resp.status} for base ${baseCurrency}`);
      return {};
    }
    const data = await resp.json();
    if (data.result !== "success") {
      console.warn(`Exchange rate API result not success:`, data.result);
      return {};
    }
    const rates: Record<string, number> = {};
    for (const c of unique) { if (data.rates[c] !== undefined) rates[c] = data.rates[c]; }
    console.log(`Exchange rates for report: base=${baseCurrency}, rates=${JSON.stringify(rates)}`);
    return rates;
  } catch (err) {
    console.error("fetchExchangeRates error:", err);
    return {};
  }
}

function convertToBase(amount: number, fromCurrency: string, baseCurrency: string, rates: Record<string, number>): number {
  if (!fromCurrency || fromCurrency === baseCurrency) return amount;
  const rate = rates[fromCurrency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const uazapiUrl = Deno.env.get("UAZAPI_URL")!;
    const uazapiToken = Deno.env.get("UAZAPI_TOKEN")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const reportType = body.type || "weekly"; // "weekly" or "monthly"

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all profiles with WhatsApp notifications enabled and verified phone
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, phone, display_name, currency")
      .eq("whatsapp_notifications", true)
      .eq("phone_verified", true)
      .not("phone", "is", null);

    if (pErr) throw pErr;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No users with WhatsApp enabled", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const profile of profiles) {
      try {
        const cur = profile.currency || "BRL";
        const fmt = (v: number) => fmtMoney(v, cur);
        // Get incomes
        const { data: incomes } = await supabase
          .from("incomes")
          .select("amount")
          .eq("user_id", profile.user_id)
          .eq("month", currentMonth)
          .eq("year", currentYear);

        // Get expenses
        const { data: expenses } = await supabase
          .from("expenses")
          .select("amount, paid, name, due_date, categories(name)")
          .eq("user_id", profile.user_id)
          .eq("month", currentMonth)
          .eq("year", currentYear);

        // Get wallets (include currency for multi-currency conversion)
        const { data: wallets } = await supabase
          .from("wallets")
          .select("name, balance, currency")
          .eq("user_id", profile.user_id);

        // Fetch exchange rates for multi-currency wallet conversion
        const walletCurrencies = (wallets || []).map((w: any) => w.currency || "BRL");
        const exchangeRates = await fetchExchangeRates(cur, walletCurrencies);

        const totalIncome = (incomes || []).reduce((a, i) => a + Number(i.amount), 0);
        const totalExpense = (expenses || []).reduce((a, e) => a + Number(e.amount), 0);
        const totalPaid = (expenses || []).filter(e => e.paid).reduce((a, e) => a + Number(e.amount), 0);
        const totalPending = totalExpense - totalPaid;
        const balance = totalIncome - totalExpense;
        const totalWallets = (wallets || []).reduce((a: number, w: any) => {
          return a + convertToBase(Number(w.balance), w.currency || "BRL", cur, exchangeRates);
        }, 0);
        const pct = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;

        // Upcoming unpaid expenses (next 7 days)
        const upcoming = (expenses || [])
          .filter(e => !e.paid)
          .filter(e => {
            const d = new Date(e.due_date + "T12:00:00");
            const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 7;
          })
          .sort((a, b) => a.due_date.localeCompare(b.due_date));

        // Overdue
        const overdue = (expenses || [])
          .filter(e => !e.paid && new Date(e.due_date + "T12:00:00") < now);

        const monthName = now.toLocaleDateString("pt-BR", { month: "long" });
        const greeting = profile.display_name ? `Olá, ${profile.display_name.split(" ")[0]}!` : "Olá!";

        let msg = "";
        if (reportType === "weekly") {
          msg = `📊 *Resumo Semanal*\n\n${greeting}\n\n`;
          msg += `💰 Renda: ${fmt(totalIncome)}\n`;
          msg += `💸 Gastos: ${fmt(totalExpense)} (${pct}%)\n`;
          msg += `📌 Pendentes: ${fmt(totalPending)}\n`;
          msg += `💳 Patrimônio: ${fmt(totalWallets)}\n`;

          if (overdue.length > 0) {
            msg += `\n⚠️ *${overdue.length} conta(s) vencida(s):*\n`;
            overdue.slice(0, 5).forEach(e => {
              msg += `  • ${e.name} — ${fmt(Number(e.amount))}\n`;
            });
          }

          if (upcoming.length > 0) {
            msg += `\n🔔 *Vencendo em breve:*\n`;
            upcoming.slice(0, 5).forEach(e => {
              const d = new Date(e.due_date + "T12:00:00").toLocaleDateString("pt-BR");
              msg += `  • ${e.name} — ${fmt(Number(e.amount))} (${d})\n`;
            });
          }
        } else {
          // Monthly
          msg = `📈 *Relatório Mensal — ${monthName}*\n\n${greeting}\n\n`;
          msg += `💰 Renda total: ${fmt(totalIncome)}\n`;
          msg += `💸 Total gastos: ${fmt(totalExpense)}\n`;
          msg += `✅ Pagos: ${fmt(totalPaid)}\n`;
          msg += `⏳ Pendentes: ${fmt(totalPending)}\n`;
          msg += `📊 Comprometimento: ${pct}%\n`;
          msg += `${balance >= 0 ? "✅" : "🔴"} Saldo: ${fmt(balance)}\n`;
          msg += `💳 Patrimônio: ${fmt(totalWallets)}\n`;

          // By category
          const byCat: Record<string, number> = {};
          (expenses || []).forEach((e: any) => {
            const cat = e.categories?.name || "Outros";
            byCat[cat] = (byCat[cat] || 0) + Number(e.amount);
          });
          const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0) {
            msg += `\n📂 *Por categoria:*\n`;
            sorted.slice(0, 8).forEach(([cat, val]) => {
              msg += `  • ${cat}: ${fmt(val)}\n`;
            });
          }
        }

        msg += `\n_Enviado automaticamente pelo ORBE_ 🟣`;

        // Send via UAZAPI
        const phone = profile.phone!.replace(/\D/g, "");
        await fetch(`${uazapiUrl}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: uazapiToken },
          body: JSON.stringify({ number: phone, text: `*ORBE*\n\n${msg}` }),
        });

        sent++;
      } catch (userErr) {
        console.error(`Error sending report to ${profile.user_id}:`, userErr);
      }
    }

    return new Response(JSON.stringify({ message: `${reportType} reports sent`, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
