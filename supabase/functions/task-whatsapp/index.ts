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

    const body = await req.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = message.trim();

    // Check if message starts with "tarefa:" or "task:"
    const taskMatch = text.match(/^(?:tarefa|task)\s*:\s*(.+)/i);
    if (!taskMatch) {
      return new Response(JSON.stringify({ handled: false, reason: "not a task message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taskText = taskMatch[1].trim();

    // Find user by phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("phone_verified", true)
      .eq("phone", phone)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "user not found for phone" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse natural language date hints
    let dueDate: string | null = null;
    let title = taskText;
    const now = new Date();

    const datePatterns: [RegExp, (m: RegExpMatchArray) => Date][] = [
      [/\b(?:hoje)\b/i, () => { const d = new Date(now); d.setHours(23, 59, 0, 0); return d; }],
      [/\b(?:amanhã|amanha)\b/i, () => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(23, 59, 0, 0); return d; }],
      [/\b(?:depois de amanhã|depois de amanha)\b/i, () => { const d = new Date(now); d.setDate(d.getDate() + 2); d.setHours(23, 59, 0, 0); return d; }],
      [/\bàs?\s*(\d{1,2})[h:](\d{2})?\b/i, (m) => { const d = new Date(now); d.setHours(parseInt(m[1]), parseInt(m[2] || "0"), 0, 0); if (d < now) d.setDate(d.getDate() + 1); return d; }],
      [/\b(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)\b/i, (m) => {
        const dayMap: Record<string, number> = {
          domingo: 0, segunda: 1, "terça": 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, "sábado": 6, sabado: 6
        };
        const target = dayMap[m[0].toLowerCase()];
        const d = new Date(now);
        const diff = (target - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        d.setHours(23, 59, 0, 0);
        return d;
      }],
    ];

    for (const [pattern, resolver] of datePatterns) {
      const match = taskText.match(pattern);
      if (match) {
        dueDate = resolver(match).toISOString();
        // Remove date part from title
        title = taskText.replace(match[0], "").replace(/\s+/g, " ").trim();
        break;
      }
    }

    // Detect category from keywords
    let category = "geral";
    if (/\b(?:pagar|conta|boleto|fatura|transferir|pix|dinheiro|banco)\b/i.test(title)) {
      category = "financeiro";
    } else if (/\b(?:prova|estud|trabalho acadêmico|tcc|aula|matéria|disciplina|seminário)\b/i.test(title)) {
      category = "academico";
    } else if (/\b(?:treino|treinar|academia|dieta|suplemento|exercício)\b/i.test(title)) {
      category = "fit";
    }

    // Detect priority
    let priority = "media";
    if (/\b(?:urgente|importante|prioridade alta|prioridade máxima)\b/i.test(title)) {
      priority = "alta";
      title = title.replace(/\b(?:urgente|importante|prioridade alta|prioridade máxima)\b/i, "").trim();
    }

    // Create task
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        user_id: profile.user_id,
        title: title || taskText,
        due_date: dueDate,
        category,
        priority,
      })
      .select()
      .single();

    if (error) throw error;

    // Send confirmation via WhatsApp
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

    if (UAZAPI_URL && UAZAPI_TOKEN) {
      const catEmoji: Record<string, string> = { geral: "📋", financeiro: "💰", academico: "📚", fit: "🏋️" };
      const priEmoji: Record<string, string> = { baixa: "🟢", media: "🟡", alta: "🔴" };
      let confirmMsg = `✅ *Tarefa criada!*\n\n`;
      confirmMsg += `${catEmoji[category] || "📋"} *${title || taskText}*\n`;
      confirmMsg += `${priEmoji[priority]} Prioridade: ${priority}\n`;
      if (dueDate) confirmMsg += `📅 Prazo: ${new Date(dueDate).toLocaleDateString("pt-BR")}\n`;
      confirmMsg += `\nCategoria: ${category}`;

      await fetch(`${UAZAPI_URL}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
        body: JSON.stringify({ number: phone, text: `*ORBE Tarefas*\n\n${confirmMsg}` }),
      });
    }

    return new Response(JSON.stringify({ success: true, task }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("task-whatsapp error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
