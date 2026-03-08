import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Reminder rules: how many hours before event to send alert
const REMINDER_RULES: Record<string, number[]> = {
  prova: [168, 72, 24, 2],       // 7d, 3d, 1d, 2h
  trabalho: [168, 72, 24],       // 7d, 3d, 1d
  atividade: [48, 0],            // 2d, same day
  revisao: [0],                  // at scheduled time
};

function getLabel(type: string): string {
  const map: Record<string, string> = { prova: "📝 PROVA", trabalho: "📋 TRABALHO", atividade: "📚 ATIVIDADE", revisao: "🔄 REVISÃO" };
  return map[type] || "📌 EVENTO";
}

function formatHours(h: number): string {
  if (h >= 24) return `${Math.round(h / 24)} dia(s)`;
  if (h > 0) return `${h} hora(s)`;
  return "agora";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

    if (!UAZAPI_URL || !UAZAPI_TOKEN) throw new Error("UAZAPI not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get upcoming events in the next 7 days that are still pending/in progress
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: events, error } = await supabase
      .from("academic_events")
      .select("*, subjects!inner(name)")
      .in("status", ["pendente", "em_andamento"])
      .gte("event_date", now.toISOString())
      .lte("event_date", weekFromNow.toISOString());

    if (error) throw error;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ message: "No upcoming events", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profiles with phone (we'd need a phone field - for now use a placeholder approach)
    // Since we don't have phone stored, we'll send to users who have configured it
    // For now, this function prepares the messages - actual sending needs user phone config
    
    let sent = 0;
    const messages: string[] = [];

    for (const ev of events) {
      const hoursUntil = (new Date(ev.event_date).getTime() - now.getTime()) / (1000 * 60 * 60);
      const rules = REMINDER_RULES[ev.type] || [24];
      const subjectName = (ev as any).subjects?.name || "Disciplina";

      // Check if we should send a reminder now (within 30min window of each rule)
      for (const rule of rules) {
        const diff = Math.abs(hoursUntil - rule);
        if (diff <= 0.5) { // within 30 min window
          const msg = `${getLabel(ev.type)} em ${formatHours(rule)}!\n\n📖 ${subjectName}: ${ev.title}${ev.content_topics ? `\n📋 Conteúdo: ${ev.content_topics}` : ""}${ev.weight ? `\n⚖️ Peso: ${ev.weight}` : ""}\n\n⏰ ${new Date(ev.event_date).toLocaleString("pt-BR")}`;
          messages.push(msg);
          // In a real setup, you'd fetch the user's phone and send via whatsapp-alert
          // For now we log it
          console.log(`Reminder for user ${ev.user_id}: ${msg}`);
          sent++;
        }
      }
    }

    return new Response(JSON.stringify({ message: `Processed ${events.length} events`, sent, messages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("academic-reminders error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
