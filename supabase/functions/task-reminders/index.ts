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
    const brNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

    // Get all pending tasks with due dates
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*, profiles!inner(phone, phone_verified, whatsapp_notifications, display_name)")
      .eq("status", "pendente")
      .eq("reminder_sent", false)
      .not("due_date", "is", null);

    // Workaround: since we can't join profiles via inner join on tasks directly,
    // get tasks and profiles separately
    const { data: pendingTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "pendente")
      .eq("reminder_sent", false)
      .not("due_date", "is", null);

    if (!pendingTasks?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    // Group tasks by user
    const userTasks: Record<string, any[]> = {};
    for (const task of pendingTasks) {
      if (!userTasks[task.user_id]) userTasks[task.user_id] = [];
      userTasks[task.user_id].push(task);
    }

    for (const [userId, taskList] of Object.entries(userTasks)) {
      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, phone_verified, whatsapp_notifications, display_name")
        .eq("user_id", userId)
        .eq("phone_verified", true)
        .eq("whatsapp_notifications", true)
        .single();

      if (!profile) continue;

      const nome = profile.display_name?.split(" ")[0] || "Ei";
      const tasksToRemind: any[] = [];

      for (const task of taskList) {
        const dueDate = new Date(task.due_date);
        const hoursUntilDue = (dueDate.getTime() - brNow.getTime()) / (1000 * 60 * 60);

        // Remind 1h before due
        if (hoursUntilDue > 0 && hoursUntilDue <= 1) {
          tasksToRemind.push({ task, type: "1h" });
        }
        // Remind on the morning of due date (7-8h)
        else if (
          brNow.getHours() === 7 &&
          dueDate.toDateString() === brNow.toDateString() &&
          dueDate.getHours() > 9 // Only morning reminder if task is later in the day
        ) {
          tasksToRemind.push({ task, type: "morning" });
        }
        // Overdue alert (check at 9h)
        else if (hoursUntilDue < 0 && hoursUntilDue > -24 && brNow.getHours() === 9) {
          tasksToRemind.push({ task, type: "overdue" });
        }
      }

      if (tasksToRemind.length === 0) continue;

      // Build message
      const catEmoji: Record<string, string> = { geral: "📋", financeiro: "💰", academico: "📚", fit: "🏋️" };

      for (const { task, type } of tasksToRemind.slice(0, 3)) {
        const emoji = catEmoji[task.category] || "📋";
        let msg = "";

        if (type === "1h") {
          msg = `⏰ ${nome}, em 1 hora vence a tarefa:\n\n${emoji} *${task.title}*`;
          if (task.description) msg += `\n${task.description}`;
          msg += `\n\n⏳ Prazo: ${new Date(task.due_date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
        } else if (type === "morning") {
          msg = `☀️ Bom dia, ${nome}! Você tem tarefa pra hoje:\n\n${emoji} *${task.title}*`;
          msg += `\n⏳ Até ${new Date(task.due_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`;
        } else if (type === "overdue") {
          msg = `⚠️ ${nome}, tarefa atrasada!\n\n${emoji} *${task.title}*`;
          msg += `\n❌ Prazo era: ${new Date(task.due_date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
        }

        try {
          await fetch(`${UAZAPI_URL}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
            body: JSON.stringify({ number: profile.phone, text: `*ORBE Tarefas*\n\n${msg}` }),
          });
          sentCount++;

          // Mark as reminded (only for 1h reminders to avoid re-sending)
          if (type === "1h") {
            await supabase.from("tasks").update({ reminder_sent: true } as any).eq("id", task.id);
          }
        } catch (e) {
          console.error(`Failed to send reminder for task ${task.id}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("task-reminders error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
