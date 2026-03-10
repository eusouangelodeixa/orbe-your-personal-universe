import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
  const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");
  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    console.log("[LOJOU-REMINDERS] WhatsApp not configured");
    return false;
  }
  try {
    const res = await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": UAZAPI_TOKEN },
      body: JSON.stringify({ number: phone, text: message }),
    });
    const data = await res.json();
    console.log("[LOJOU-REMINDERS] WhatsApp sent:", res.status, JSON.stringify(data));
    return res.ok;
  } catch (e) {
    console.error("[LOJOU-REMINDERS] WhatsApp error:", e);
    return false;
  }
}

function buildReminderMessage(daysBefore: number, customerName: string, planName: string): string {
  const firstName = customerName.split(" ")[0] || "Olá";

  if (daysBefore === 3) {
    return `Olá ${firstName}! 👋\n\nSeu plano *${planName}* do *Orbe* vence em *3 dias*.\n\n📚 Com o Orbe, você tem acesso a ferramentas que organizam seus estudos, finanças e treinos de forma inteligente com IA.\n\nRenove agora e continue aproveitando: https://pay.lojou.app/p/iGdxz\n\n💜 Equipe Orbe`;
  }
  if (daysBefore === 2) {
    return `Olá ${firstName}! ⏰\n\nSeu plano *${planName}* do *Orbe* vence em *2 dias*.\n\n🤖 Não perca o acesso ao assistente de IA que resolve provas, gera planos de treino e analisa suas finanças automaticamente.\n\nRenove agora: https://pay.lojou.app/p/iGdxz\n\n💜 Equipe Orbe`;
  }
  if (daysBefore === 1) {
    return `Olá ${firstName}! ⚠️\n\nSeu plano *${planName}* do *Orbe* vence *amanhã*!\n\n📊 Suas disciplinas, tarefas agendadas e histórico de treinos continuam salvos — mas o acesso às funcionalidades premium será desativado.\n\nRenove para não perder nada: https://pay.lojou.app/p/iGdxz\n\n💜 Equipe Orbe`;
  }
  // daysBefore === 0
  return `Olá ${firstName}! 🔔\n\nSeu plano *${planName}* do *Orbe* *vence hoje*!\n\nEste é o último dia para renovar e manter seu acesso a:\n✅ Resolução de provas com IA\n✅ Planejamento de treinos personalizado\n✅ Controle financeiro inteligente\n✅ Assistente no WhatsApp\n\nRenove agora: https://pay.lojou.app/p/iGdxz\n\n💜 Equipe Orbe`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const today = new Date().toISOString().split("T")[0];

    // Get all unsent reminders for today
    const { data: reminders, error } = await supabase
      .from("subscription_reminders")
      .select("*")
      .eq("send_date", today)
      .eq("sent", false);

    if (error) throw error;

    if (!reminders || reminders.length === 0) {
      console.log("[LOJOU-REMINDERS] No reminders to send for today:", today);
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const reminder of reminders) {
      const message = buildReminderMessage(
        reminder.days_before,
        reminder.customer_name,
        reminder.plan_name
      );

      const sent = await sendWhatsApp(reminder.phone, message);

      if (sent) {
        await supabase
          .from("subscription_reminders")
          .update({ sent: true, sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
        sentCount++;
      }
    }

    console.log(`[LOJOU-REMINDERS] Sent ${sentCount}/${reminders.length} reminders for ${today}`);

    return new Response(JSON.stringify({ ok: true, sent: sentCount, total: reminders.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[LOJOU-REMINDERS] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});