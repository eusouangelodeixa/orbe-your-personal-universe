import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");
    if (!UAZAPI_URL || !UAZAPI_TOKEN) throw new Error("UAZAPI não configurada");

    const now = new Date();
    const currentDay = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][now.getDay()];
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    // Get enabled reminders that match current time (with 1 min tolerance)
    const { data: reminders } = await supabase
      .from("fit_reminders")
      .select("*")
      .eq("enabled", true);

    if (!reminders?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const reminder of reminders) {
      // Check day
      const days = reminder.days || [];
      if (days.length > 0 && !days.includes(currentDay)) continue;

      // Check time (exact match within 1 minute)
      if (reminder.time !== currentTime) continue;

      // Get user's phone
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, phone_verified, whatsapp_notifications")
        .eq("user_id", reminder.user_id)
        .single();

      if (!profile?.phone || !profile.phone_verified || !profile.whatsapp_notifications) continue;

      // Build message based on reminder type
      const emojiMap: Record<string, string> = {
        treino: "🏋️",
        refeicao: "🍽️",
        hidratacao: "💧",
        suplemento: "💊",
      };
      const emoji = emojiMap[reminder.type] || "⏰";
      const message = `${emoji} *ORBE Fit* — ${reminder.title}`;

      // Send via WhatsApp
      try {
        await fetch(`${UAZAPI_URL}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
          body: JSON.stringify({ number: profile.phone, text: message }),
        });
        sentCount++;
      } catch (e) {
        console.error(`Failed to send reminder ${reminder.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fit-send-reminders error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
