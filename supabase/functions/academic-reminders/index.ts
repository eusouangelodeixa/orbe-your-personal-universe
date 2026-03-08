import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Reminder rules: hours before event
const EVENT_RULES: Record<string, number[]> = {
  prova: [168, 72, 24, 2],
  trabalho: [168, 72, 24],
  atividade: [48, 0],
  revisao: [0],
};

// Class reminder rules: hours before class
const CLASS_RULES = [24, 1]; // day before + 1h before

const DAY_MAP: Record<string, number> = {
  "Segunda": 1, "Terça": 2, "Quarta": 3, "Quinta": 4, "Sexta": 5, "Sábado": 6, "Domingo": 0,
};

function getLabel(type: string): string {
  const map: Record<string, string> = {
    prova: "📝 PROVA", trabalho: "📋 TRABALHO", atividade: "📚 ATIVIDADE",
    revisao: "🔄 REVISÃO", aula: "🎓 AULA",
  };
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const notifications: { user_id: string; title: string; message: string; type: string }[] = [];

    // ─── 1. Academic Event Reminders ───
    const { data: events } = await supabase
      .from("academic_events")
      .select("*, subjects!inner(name)")
      .in("status", ["pendente", "em_andamento"])
      .gte("event_date", now.toISOString())
      .lte("event_date", weekFromNow.toISOString());

    for (const ev of events || []) {
      const hoursUntil = (new Date(ev.event_date).getTime() - now.getTime()) / (1000 * 60 * 60);
      const rules = EVENT_RULES[ev.type] || [24];
      const subjectName = (ev as any).subjects?.name || "Disciplina";

      for (const rule of rules) {
        if (Math.abs(hoursUntil - rule) <= 0.5) {
          notifications.push({
            user_id: ev.user_id,
            title: `${getLabel(ev.type)} em ${formatHours(rule)}!`,
            message: `${subjectName}: ${ev.title}${ev.content_topics ? ` • ${ev.content_topics}` : ""}`,
            type: ev.type,
          });
        }
      }
    }

    // ─── 2. Class Reminders (based on subject schedule) ───
    const { data: subjects } = await supabase.from("subjects").select("*");

    for (const sub of subjects || []) {
      const schedule = sub.schedule as { day: string; start: string; end: string }[] || [];
      for (const slot of schedule) {
        const targetDay = DAY_MAP[slot.day];
        if (targetDay === undefined) continue;

        // Find next occurrence of this class
        const [startH, startM] = slot.start.split(":").map(Number);
        const classDate = new Date(now);
        const currentDay = now.getDay();
        let daysAhead = targetDay - currentDay;
        if (daysAhead < 0) daysAhead += 7;
        if (daysAhead === 0) {
          // Today - check if class hasn't passed yet
          const classToday = new Date(now);
          classToday.setHours(startH, startM, 0, 0);
          if (classToday.getTime() < now.getTime()) daysAhead = 7;
        }
        classDate.setDate(now.getDate() + daysAhead);
        classDate.setHours(startH, startM, 0, 0);

        const hoursUntil = (classDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        for (const rule of CLASS_RULES) {
          if (Math.abs(hoursUntil - rule) <= 0.5) {
            notifications.push({
              user_id: sub.user_id,
              title: `${getLabel("aula")} em ${formatHours(rule)}!`,
              message: `${sub.name} • ${slot.day} ${slot.start}-${slot.end}${sub.teacher ? ` • Prof. ${sub.teacher}` : ""}`,
              type: "aula",
            });
          }
        }
      }
    }

    // ─── 3. Insert in-app notifications ───
    if (notifications.length > 0) {
      const { error: insertError } = await supabase.from("notifications").insert(
        notifications.map(n => ({ ...n, read: false }))
      );
      if (insertError) console.error("Insert notifications error:", insertError);
    }

    return new Response(JSON.stringify({ processed: (events?.length || 0) + (subjects?.length || 0), notified: notifications.length }), {
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
