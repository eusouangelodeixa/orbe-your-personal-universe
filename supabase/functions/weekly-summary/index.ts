import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL")!;
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all users with verified WhatsApp
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, phone, display_name, currency, whatsapp_notifications")
      .eq("phone_verified", true)
      .eq("whatsapp_notifications", true)
      .not("phone", "is", null);

    if (profileError) throw profileError;
    console.log(`Weekly summary: ${profiles?.length || 0} users to notify`);

    const results = { sent: 0, failed: 0 };
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const profile of profiles || []) {
      try {
        const userId = profile.user_id;
        const nome = profile.display_name?.split(" ")[0] || "Usuário";
        const currency = profile.currency || "BRL";

        // Fetch financial data
        const [incomesRes, expensesRes, walletsRes] = await Promise.all([
          supabase.from("incomes").select("amount").eq("user_id", userId).eq("month", month).eq("year", year),
          supabase.from("expenses").select("amount, paid").eq("user_id", userId).eq("month", month).eq("year", year),
          supabase.from("wallets").select("name, balance, currency").eq("user_id", userId),
        ]);

        const totalIncome = (incomesRes.data || []).reduce((a: number, i: any) => a + Number(i.amount), 0);
        const totalExpenses = (expensesRes.data || []).reduce((a: number, e: any) => a + Number(e.amount), 0);
        const pendingExpenses = (expensesRes.data || []).filter((e: any) => !e.paid).reduce((a: number, e: any) => a + Number(e.amount), 0);
        const totalBalance = (walletsRes.data || []).reduce((a: number, w: any) => a + Number(w.balance), 0);

        // Fetch study data
        const [eventsRes, pomodoroRes] = await Promise.all([
          supabase.from("academic_events").select("title, event_date, status, type")
            .eq("user_id", userId).gte("event_date", weekAgo).order("event_date"),
          supabase.from("pomodoro_sessions").select("completed_pomodoros, total_focus_seconds")
            .eq("user_id", userId).gte("session_date", weekAgo.split("T")[0]),
        ]);

        const pendingEvents = (eventsRes.data || []).filter((e: any) => e.status === "pendente" || e.status === "em_andamento");
        const totalPomodoros = (pomodoroRes.data || []).reduce((a: number, p: any) => a + p.completed_pomodoros, 0);
        const totalFocusMin = (pomodoroRes.data || []).reduce((a: number, p: any) => a + Math.floor(p.total_focus_seconds / 60), 0);

        // Fetch fit data
        const [workoutsRes, progressRes] = await Promise.all([
          supabase.from("fit_workout_logs").select("workout_name, duration_minutes")
            .eq("user_id", userId).gte("workout_date", weekAgo.split("T")[0]),
          supabase.from("fit_progress").select("weight, record_date")
            .eq("user_id", userId).order("record_date", { ascending: false }).limit(1),
        ]);

        const totalWorkouts = (workoutsRes.data || []).length;
        const totalWorkoutMin = (workoutsRes.data || []).reduce((a: number, w: any) => a + (w.duration_minutes || 0), 0);
        const lastWeight = progressRes.data?.[0]?.weight;

        // Build message
        const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);

        let msg = `📊 *Resumo Semanal ORBE*\n`;
        msg += `Olá, ${nome}! Aqui vai seu resumo:\n\n`;

        msg += `💰 *Finanças*\n`;
        msg += `Renda: ${fmt(totalIncome)}\n`;
        msg += `Gastos: ${fmt(totalExpenses)}\n`;
        msg += `Pendente: ${fmt(pendingExpenses)}\n`;
        msg += `Saldo: ${fmt(totalBalance)}\n\n`;

        if (totalPomodoros > 0 || pendingEvents.length > 0) {
          msg += `📚 *Estudos*\n`;
          msg += `🍅 ${totalPomodoros} pomodoros (${totalFocusMin} min)\n`;
          if (pendingEvents.length > 0) {
            msg += `📌 ${pendingEvents.length} evento(s) pendente(s)\n`;
            pendingEvents.slice(0, 3).forEach((e: any) => {
              const dt = new Date(e.event_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
              msg += `  • ${e.title} (${dt})\n`;
            });
          }
          msg += `\n`;
        }

        if (totalWorkouts > 0 || lastWeight) {
          msg += `🏋️ *Fit*\n`;
          if (totalWorkouts > 0) msg += `${totalWorkouts} treino(s) (${totalWorkoutMin} min)\n`;
          if (lastWeight) msg += `Peso atual: ${Number(lastWeight).toFixed(1)} kg\n`;
          msg += `\n`;
        }

        msg += `💪 Continue assim! Acesse o app para mais detalhes.`;

        // Send via UAZAPI
        const response = await fetch(`${UAZAPI_URL}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
          body: JSON.stringify({ number: profile.phone, text: `*ORBE*\n\n${msg}` }),
        });

        if (response.ok) {
          results.sent++;
          console.log(`✅ Weekly summary sent to ${nome}`);
        } else {
          results.failed++;
          console.error(`❌ Failed for ${profile.phone}`);
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        results.failed++;
        console.error(`Error for ${profile.phone}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
