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
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

    if (!UAZAPI_URL || !UAZAPI_TOKEN) {
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Find users whose 3-day trial has expired (created_at + 3 days <= now)
    // and who have a verified phone number
    // and who don't have an active subscription
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

    // Get users created between 3-4 days ago (to avoid re-sending)
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    const expiredTrialUsers = users.filter((u: any) => {
      const createdAt = new Date(u.created_at);
      const now = new Date();
      const diffMs = now.getTime() - createdAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      // Users whose trial expired (3-4 days ago, to send once)
      return diffDays >= 3 && diffDays < 4;
    });

    if (!expiredTrialUsers.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No expired trials found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const user of expiredTrialUsers) {
      // Check if user already has an active subscription
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);

      if (subs?.length) continue; // Already subscribed

      // Check if user has verified phone
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, phone_verified, display_name")
        .eq("user_id", user.id)
        .single();

      if (!profile?.phone_verified || !profile?.phone) continue;

      const phoneNumber = profile.phone.replace(/[^0-9]/g, "");
      const name = profile.display_name?.split(" ")[0] || "Usuário";

      const message = `*ORBE*\n\n` +
        `Olá, ${name}! 👋\n\n` +
        `Seu período de teste grátis de 3 dias chegou ao fim. ⏰\n\n` +
        `Durante esse tempo, você teve acesso a:\n` +
        `💰 Planilha financeira inteligente\n` +
        `📚 Assistente acadêmico com IA\n` +
        `💪 Plano de treino e dieta personalizados\n` +
        `✅ Gerenciamento de tarefas\n\n` +
        `Para continuar usando o ORBE sem interrupções, escolha seu plano:\n` +
        `👉 https://apporbe.lovable.app/auth\n\n` +
        `Temos planos a partir de R$19/mês (ou 229 MT).\n\n` +
        `Qualquer dúvida, é só mandar mensagem aqui! 🚀`;

      try {
        const res = await fetch(`${UAZAPI_URL}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
          body: JSON.stringify({ number: phoneNumber, text: message }),
        });

        if (res.ok) {
          sent++;
          console.log(`Trial expiry message sent to ${phoneNumber}`);
        } else {
          console.error(`Failed to send to ${phoneNumber}: ${res.status}`);
        }
      } catch (err) {
        console.error(`Error sending to ${phoneNumber}:`, err);
      }
    }

    return new Response(JSON.stringify({ sent, total_expired: expiredTrialUsers.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trial-expiry-whatsapp error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
