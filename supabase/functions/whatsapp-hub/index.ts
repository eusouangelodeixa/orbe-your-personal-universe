import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== HELPERS ==========

function fmtBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function brNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

async function sendWhatsApp(url: string, token: string, phone: string, text: string) {
  await fetch(`${url}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ number: phone, text: `*ORBE*\n\n${text}` }),
  });
}

// ========== AI FUNCTIONS ==========

async function callAI(apiKey: string, systemPrompt: string, userMessage: string, tools?: any[], toolChoice?: any) {
  const body: any = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  };
  if (tools) { body.tools = tools; body.tool_choice = toolChoice; }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("AI error:", res.status, t);
    throw new Error(`AI error [${res.status}]`);
  }

  const data = await res.json();
  return data;
}

async function transcribeAudio(apiKey: string, audioUrl: string): Promise<string> {
  // Use Gemini multimodal to transcribe audio
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Transcreva o áudio a seguir em texto em português brasileiro. Retorne APENAS a transcrição, sem nenhum comentário adicional." },
        { role: "user", content: [
          { type: "input_audio", input_audio: { data: audioUrl, format: "mp3" } },
        ]},
      ],
    }),
  });

  if (!res.ok) {
    // Fallback: try with URL as text
    const t = await res.text();
    console.error("Audio transcription error:", res.status, t);
    throw new Error("Não consegui transcrever o áudio");
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ========== INTENT PARSER ==========

const INTENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_action",
      description: "Execute an action in the ORBE system based on user intent",
      parameters: {
        type: "object",
        properties: {
          module: { type: "string", enum: ["financeiro", "estudos", "fit", "tarefas", "geral"] },
          action: {
            type: "string",
            enum: [
              // Financeiro
              "add_expense", "add_income", "mark_paid", "list_expenses", "list_incomes",
              "wallet_balance", "monthly_summary", "financial_projection",
              // Estudos
              "list_events", "add_event", "list_subjects", "subject_question",
              // Fit
              "log_workout", "active_plan", "check_progress", "nutrition_question",
              // Tarefas
              "add_task", "list_tasks", "complete_task", "delete_task",
              // Geral
              "daily_summary", "help", "chat"
            ]
          },
          params: {
            type: "object",
            description: "Parameters for the action",
            properties: {
              name: { type: "string" },
              amount: { type: "number" },
              category: { type: "string" },
              due_date: { type: "string", description: "ISO date string" },
              due_time: { type: "string", description: "HH:mm" },
              priority: { type: "string", enum: ["baixa", "media", "alta"] },
              description: { type: "string" },
              subject_name: { type: "string" },
              question: { type: "string" },
              workout_name: { type: "string" },
              duration: { type: "number" },
              task_title: { type: "string" },
              type: { type: "string" },
              month: { type: "number" },
              year: { type: "number" },
              wallet_name: { type: "string" },
              paid: { type: "boolean" },
            },
          },
          reply_text: { type: "string", description: "Friendly reply message to send back to user via WhatsApp. Portuguese Brazilian." },
        },
        required: ["module", "action", "reply_text"],
      },
    },
  },
];

async function parseIntent(apiKey: string, text: string, context: string) {
  const now = brNow();
  const systemPrompt = `Você é o assistente ORBE via WhatsApp. Analise a mensagem e determine a ação a executar.

Data/hora atual: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}
Dia da semana: ${["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][now.getDay()]}

${context}

REGRAS:
- Interprete linguagem natural em português
- Para datas relativas: "hoje" = ${now.toISOString().split("T")[0]}, "amanhã" = dia seguinte, etc.
- Se não entender a intenção, use action "chat" e responda normalmente
- Para "ajuda" ou mensagens vagas, use action "help"
- reply_text deve ser amigável, curto e usar emojis
- Valores financeiros em BRL
- Se o usuário pedir resumo do dia, use "daily_summary"
- Para qualquer pergunta conversacional, use action "chat" com reply_text respondendo diretamente`;

  const result = await callAI(apiKey, systemPrompt, text, INTENT_TOOLS, { type: "function", function: { name: "execute_action" } });

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    return JSON.parse(toolCall.function.arguments);
  }

  // Fallback: plain text reply
  return {
    module: "geral",
    action: "chat",
    reply_text: result.choices?.[0]?.message?.content || "Não entendi. Diga 'ajuda' para ver o que posso fazer.",
  };
}

// ========== ACTION EXECUTORS ==========

async function executeAction(supabase: any, userId: string, intent: any): Promise<string> {
  const { module, action, params = {}, reply_text } = intent;
  const now = brNow();
  const currentMonth = params.month || now.getMonth() + 1;
  const currentYear = params.year || now.getFullYear();

  try {
    switch (action) {
      // ===== FINANCEIRO =====
      case "add_expense": {
        const dueDate = params.due_date || now.toISOString().split("T")[0];
        const { error } = await supabase.from("expenses").insert({
          user_id: userId,
          name: params.name || "Gasto WhatsApp",
          amount: params.amount || 0,
          due_date: dueDate,
          month: new Date(dueDate).getMonth() + 1,
          year: new Date(dueDate).getFullYear(),
          type: params.type || "variavel",
          paid: params.paid || false,
          category_id: null,
        });
        if (error) throw error;
        return reply_text;
      }

      case "add_income": {
        const { error } = await supabase.from("incomes").insert({
          user_id: userId,
          description: params.name || params.description || "Renda WhatsApp",
          amount: params.amount || 0,
          month: currentMonth,
          year: currentYear,
          recurring: false,
        });
        if (error) throw error;
        return reply_text;
      }

      case "mark_paid": {
        const { data: expenses } = await supabase.from("expenses")
          .select("id, name").eq("user_id", userId).eq("paid", false)
          .ilike("name", `%${params.name || ""}%`).limit(1);
        if (expenses?.length) {
          await supabase.from("expenses").update({ paid: true }).eq("id", expenses[0].id);
          return reply_text || `✅ "${expenses[0].name}" marcado como pago!`;
        }
        return `❌ Não encontrei gasto pendente com "${params.name}"`;
      }

      case "list_expenses": {
        const { data } = await supabase.from("expenses")
          .select("name, amount, paid, due_date")
          .eq("user_id", userId).eq("month", currentMonth).eq("year", currentYear)
          .order("due_date");
        if (!data?.length) return "📊 Nenhum gasto registrado este mês.";
        const total = data.reduce((s: number, e: any) => s + Number(e.amount), 0);
        const paid = data.filter((e: any) => e.paid).reduce((s: number, e: any) => s + Number(e.amount), 0);
        let msg = `📊 *Gastos ${currentMonth}/${currentYear}*\n\n`;
        data.slice(0, 15).forEach((e: any) => {
          msg += `${e.paid ? "✅" : "⏳"} ${e.name}: ${fmtBRL(e.amount)}\n`;
        });
        if (data.length > 15) msg += `... e mais ${data.length - 15}\n`;
        msg += `\n💰 Total: ${fmtBRL(total)}\n✅ Pago: ${fmtBRL(paid)}\n⏳ Pendente: ${fmtBRL(total - paid)}`;
        return msg;
      }

      case "list_incomes": {
        const { data } = await supabase.from("incomes")
          .select("description, amount")
          .eq("user_id", userId).eq("month", currentMonth).eq("year", currentYear);
        if (!data?.length) return "💵 Nenhuma renda registrada este mês.";
        const total = data.reduce((s: number, i: any) => s + Number(i.amount), 0);
        let msg = `💵 *Rendas ${currentMonth}/${currentYear}*\n\n`;
        data.forEach((i: any) => { msg += `• ${i.description}: ${fmtBRL(i.amount)}\n`; });
        msg += `\n💰 Total: ${fmtBRL(total)}`;
        return msg;
      }

      case "wallet_balance": {
        const { data } = await supabase.from("wallets")
          .select("name, balance, is_default").eq("user_id", userId);
        if (!data?.length) return "🏦 Nenhuma carteira cadastrada.";
        const total = data.reduce((s: number, w: any) => s + Number(w.balance), 0);
        let msg = `🏦 *Carteiras*\n\n`;
        data.forEach((w: any) => {
          msg += `${w.is_default ? "⭐" : "💳"} ${w.name}: ${fmtBRL(w.balance)}\n`;
        });
        msg += `\n💰 Patrimônio total: ${fmtBRL(total)}`;
        return msg;
      }

      case "monthly_summary":
      case "financial_projection": {
        const [expRes, incRes, walRes] = await Promise.all([
          supabase.from("expenses").select("amount, paid").eq("user_id", userId).eq("month", currentMonth).eq("year", currentYear),
          supabase.from("incomes").select("amount").eq("user_id", userId).eq("month", currentMonth).eq("year", currentYear),
          supabase.from("wallets").select("balance").eq("user_id", userId),
        ]);
        const totalExp = (expRes.data || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
        const paidExp = (expRes.data || []).filter((e: any) => e.paid).reduce((s: number, e: any) => s + Number(e.amount), 0);
        const totalInc = (incRes.data || []).reduce((s: number, i: any) => s + Number(i.amount), 0);
        const totalWal = (walRes.data || []).reduce((s: number, w: any) => s + Number(w.balance), 0);
        const flow = totalInc - totalExp;
        const commitment = totalInc > 0 ? ((totalExp / totalInc) * 100).toFixed(0) : "—";

        return `📊 *Resumo Financeiro ${currentMonth}/${currentYear}*\n\n` +
          `💵 Renda: ${fmtBRL(totalInc)}\n` +
          `💸 Gastos: ${fmtBRL(totalExp)}\n` +
          `✅ Pago: ${fmtBRL(paidExp)} | ⏳ Pendente: ${fmtBRL(totalExp - paidExp)}\n` +
          `📈 Fluxo: ${fmtBRL(flow)}\n` +
          `📊 Comprometimento: ${commitment}%\n` +
          `🏦 Patrimônio: ${fmtBRL(totalWal)}\n` +
          `💰 Disponível: ${fmtBRL(totalWal - (totalExp - paidExp))}`;
      }

      // ===== ESTUDOS =====
      case "list_events": {
        const startDate = now.toISOString().split("T")[0];
        const { data } = await supabase.from("academic_events")
          .select("title, event_date, type, subjects(name)")
          .eq("user_id", userId).gte("event_date", startDate)
          .order("event_date").limit(10);
        if (!data?.length) return "📅 Nenhum evento acadêmico próximo.";
        let msg = `📅 *Próximos eventos*\n\n`;
        data.forEach((e: any) => {
          const emoji = e.type === "prova" ? "📝" : e.type === "trabalho" ? "📄" : "📌";
          msg += `${emoji} *${e.title}*\n`;
          msg += `   ${new Date(e.event_date).toLocaleDateString("pt-BR")}`;
          if (e.subjects?.name) msg += ` | ${e.subjects.name}`;
          msg += "\n\n";
        });
        return msg;
      }

      case "add_event": {
        // Find subject by name
        let subjectId = null;
        if (params.subject_name) {
          const { data: subj } = await supabase.from("subjects")
            .select("id").eq("user_id", userId)
            .ilike("name", `%${params.subject_name}%`).limit(1);
          if (subj?.length) subjectId = subj[0].id;
        }
        if (!subjectId) {
          // Get first subject as fallback
          const { data: subj } = await supabase.from("subjects")
            .select("id").eq("user_id", userId).limit(1);
          subjectId = subj?.[0]?.id;
        }
        if (!subjectId) return "❌ Nenhuma disciplina cadastrada. Cadastre primeiro no app.";

        const { error } = await supabase.from("academic_events").insert({
          user_id: userId,
          title: params.name || "Evento WhatsApp",
          event_date: params.due_date || now.toISOString(),
          type: params.type || "prova",
          subject_id: subjectId,
        });
        if (error) throw error;
        return reply_text;
      }

      case "list_subjects": {
        const { data } = await supabase.from("subjects")
          .select("name, teacher, type").eq("user_id", userId);
        if (!data?.length) return "📚 Nenhuma disciplina cadastrada.";
        let msg = `📚 *Suas disciplinas*\n\n`;
        data.forEach((s: any) => {
          msg += `• *${s.name}*${s.teacher ? ` (${s.teacher})` : ""}\n`;
        });
        return msg;
      }

      case "subject_question": {
        // Use AI to answer the question with context
        const { data: subjects } = await supabase.from("subjects")
          .select("name, ementa_text").eq("user_id", userId);
        const subjectContext = (subjects || [])
          .map((s: any) => `${s.name}: ${s.ementa_text || "sem ementa"}`)
          .join("\n");
        // The AI already generated the reply_text with the question context
        return reply_text;
      }

      // ===== FIT =====
      case "log_workout": {
        const { error } = await supabase.from("fit_workout_logs").insert({
          user_id: userId,
          workout_name: params.workout_name || params.name || "Treino WhatsApp",
          duration_minutes: params.duration || null,
          exercises: [],
          workout_date: params.due_date || now.toISOString().split("T")[0],
        });
        if (error) throw error;
        return reply_text;
      }

      case "active_plan": {
        const { data: plan } = await supabase.from("fit_workout_plans")
          .select("title, plan_data").eq("user_id", userId).eq("active", true).maybeSingle();
        if (!plan) return "🏋️ Nenhum plano de treino ativo. Crie um no app.";
        let msg = `🏋️ *${plan.title}*\n\n`;
        const workouts = (plan.plan_data as any)?.workouts || (plan.plan_data as any)?.days || [];
        workouts.slice(0, 7).forEach((w: any) => {
          msg += `📌 *${w.name || w.day}*\n`;
          (w.exercises || []).slice(0, 5).forEach((ex: any) => {
            msg += `  • ${ex.name}${ex.sets ? ` ${ex.sets}x${ex.reps || ""}` : ""}\n`;
          });
          msg += "\n";
        });
        return msg;
      }

      case "check_progress": {
        const { data: prog } = await supabase.from("fit_progress")
          .select("weight, body_fat_pct, record_date")
          .eq("user_id", userId).order("record_date", { ascending: false }).limit(5);
        const { data: profile } = await supabase.from("fit_profiles")
          .select("weight, height, bmi, goal").eq("user_id", userId).maybeSingle();
        if (!prog?.length && !profile) return "📊 Nenhum dado de progresso encontrado.";

        let msg = `📊 *Progresso Fit*\n\n`;
        if (profile) {
          msg += `⚖️ Peso: ${profile.weight || "—"}kg | IMC: ${profile.bmi || "—"}\n`;
          msg += `🎯 Objetivo: ${profile.goal || "—"}\n\n`;
        }
        if (prog?.length) {
          msg += `*Últimos registros:*\n`;
          prog.forEach((p: any) => {
            msg += `${new Date(p.record_date).toLocaleDateString("pt-BR")}: ${p.weight || "—"}kg`;
            if (p.body_fat_pct) msg += ` | ${p.body_fat_pct}% gordura`;
            msg += "\n";
          });
        }
        return msg;
      }

      case "nutrition_question": {
        return reply_text; // AI already answered
      }

      // ===== TAREFAS =====
      case "add_task": {
        const dueDate = params.due_date
          ? new Date(`${params.due_date}T${params.due_time || "23:59"}:00`).toISOString()
          : null;
        const { error } = await supabase.from("tasks").insert({
          user_id: userId,
          title: params.task_title || params.name || "Tarefa WhatsApp",
          description: params.description || null,
          due_date: dueDate,
          priority: params.priority || "media",
          category: params.category || "geral",
        });
        if (error) throw error;
        return reply_text;
      }

      case "list_tasks": {
        const { data } = await supabase.from("tasks")
          .select("title, due_date, priority, status, category")
          .eq("user_id", userId).eq("status", "pendente")
          .order("due_date", { ascending: true, nullsFirst: false }).limit(15);
        if (!data?.length) return "✅ Nenhuma tarefa pendente! Tudo limpo.";
        const priEmoji: Record<string, string> = { alta: "🔴", media: "🟡", baixa: "🟢" };
        const catEmoji: Record<string, string> = { geral: "📋", financeiro: "💰", academico: "📚", fit: "🏋️" };
        let msg = `📋 *Tarefas pendentes (${data.length})*\n\n`;
        data.forEach((t: any, i: number) => {
          msg += `${i + 1}. ${priEmoji[t.priority] || "🟡"} ${catEmoji[t.category] || "📋"} *${t.title}*`;
          if (t.due_date) msg += `\n   ⏳ ${new Date(t.due_date).toLocaleDateString("pt-BR")}`;
          msg += "\n\n";
        });
        return msg;
      }

      case "complete_task": {
        const searchTerm = params.task_title || params.name || "";
        const { data: tasks } = await supabase.from("tasks")
          .select("id, title").eq("user_id", userId).eq("status", "pendente")
          .ilike("title", `%${searchTerm}%`).limit(1);
        if (tasks?.length) {
          await supabase.from("tasks")
            .update({ status: "concluida", completed_at: new Date().toISOString() })
            .eq("id", tasks[0].id);
          return `✅ Tarefa "${tasks[0].title}" concluída! 🎉`;
        }
        return `❌ Não encontrei tarefa pendente com "${searchTerm}"`;
      }

      case "delete_task": {
        const term = params.task_title || params.name || "";
        const { data: tasks } = await supabase.from("tasks")
          .select("id, title").eq("user_id", userId)
          .ilike("title", `%${term}%`).limit(1);
        if (tasks?.length) {
          await supabase.from("tasks").delete().eq("id", tasks[0].id);
          return `🗑️ Tarefa "${tasks[0].title}" removida.`;
        }
        return `❌ Não encontrei tarefa com "${term}"`;
      }

      // ===== GERAL =====
      case "daily_summary": {
        const today = now.toISOString().split("T")[0];

        const [tasksRes, eventsRes, expRes, logsRes] = await Promise.all([
          supabase.from("tasks").select("title, priority").eq("user_id", userId).eq("status", "pendente").lte("due_date", today + "T23:59:59").limit(5),
          supabase.from("academic_events").select("title, type").eq("user_id", userId).gte("event_date", today + "T00:00:00").lte("event_date", today + "T23:59:59").limit(5),
          supabase.from("expenses").select("name, amount").eq("user_id", userId).eq("due_date", today).eq("paid", false).limit(5),
          supabase.from("fit_workout_logs").select("id").eq("user_id", userId).eq("workout_date", today),
        ]);

        let msg = `☀️ *Resumo do dia - ${now.toLocaleDateString("pt-BR")}*\n\n`;

        const tasks = tasksRes.data || [];
        if (tasks.length) {
          msg += `📋 *Tarefas (${tasks.length}):*\n`;
          tasks.forEach((t: any) => { msg += `  • ${t.title}\n`; });
          msg += "\n";
        }

        const events = eventsRes.data || [];
        if (events.length) {
          msg += `📅 *Eventos acadêmicos:*\n`;
          events.forEach((e: any) => { msg += `  • ${e.title} (${e.type})\n`; });
          msg += "\n";
        }

        const bills = expRes.data || [];
        if (bills.length) {
          msg += `💸 *Contas a pagar hoje:*\n`;
          bills.forEach((b: any) => { msg += `  • ${b.name}: ${fmtBRL(b.amount)}\n`; });
          msg += "\n";
        }

        const trained = (logsRes.data || []).length > 0;
        msg += `🏋️ Treino: ${trained ? "✅ Feito" : "⏳ Pendente"}\n`;

        if (!tasks.length && !events.length && !bills.length) {
          msg += "\n✨ Dia tranquilo! Nada urgente.";
        }

        return msg;
      }

      case "help": {
        return `🤖 *ORBE WhatsApp - Comandos*\n\n` +
          `💰 *Financeiro:*\n` +
          `• "quanto gastei esse mês"\n` +
          `• "adicionar gasto luz 150 reais"\n` +
          `• "adicionar renda freelance 500"\n` +
          `• "pagar conta de luz"\n` +
          `• "saldo das carteiras"\n` +
          `• "resumo financeiro"\n\n` +
          `📚 *Estudos:*\n` +
          `• "agenda da semana"\n` +
          `• "adicionar prova de cálculo dia 20/03"\n` +
          `• "minhas disciplinas"\n\n` +
          `🏋️ *Fit:*\n` +
          `• "registrar treino peito 50 min"\n` +
          `• "meu plano de treino"\n` +
          `• "meu progresso"\n\n` +
          `📋 *Tarefas:*\n` +
          `• "tarefa: comprar leite amanhã"\n` +
          `• "minhas tarefas"\n` +
          `• "completar tarefa comprar leite"\n\n` +
          `📊 *Geral:*\n` +
          `• "resumo do dia"\n` +
          `• "ajuda"\n\n` +
          `🎤 Também aceito áudio!`;
      }

      case "chat":
      default:
        return reply_text || "Não entendi. Diga *ajuda* para ver o que posso fazer! 🤖";
    }
  } catch (e) {
    console.error(`Action error [${action}]:`, e);
    return reply_text || `❌ Erro ao executar: ${e instanceof Error ? e.message : "erro desconhecido"}`;
  }
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!UAZAPI_URL || !UAZAPI_TOKEN) throw new Error("UAZAPI not configured");

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();

    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    // ===== PARSE UAZAPI WEBHOOK FORMAT =====
    // UAZAPI (whatsmeow-based) sends messages in baileys format:
    // { event: "messages.upsert", data: { key: { remoteJid, fromMe, id }, message: { conversation, extendedTextMessage, audioMessage, ... }, pushName } }
    // OR flat format: { phone, message, type, ... }

    let phone = "";
    let textMessage = "";
    let audioUrl: string | null = null;
    let isAudio = false;

    if (body.event === "messages.upsert" || body.data?.key) {
      // Baileys/whatsmeow format (UAZAPI v2)
      const data = body.data || body;
      const key = data.key || {};
      const msg = data.message || {};

      // Ignore own messages
      if (key.fromMe) {
        return new Response(JSON.stringify({ handled: false, reason: "own message" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract phone from remoteJid: "5511999999999@s.whatsapp.net" -> "5511999999999"
      const jid = key.remoteJid || "";
      phone = jid.replace(/@.*$/, "");

      // Extract text from different message types
      textMessage = msg.conversation
        || msg.extendedTextMessage?.text
        || msg.buttonsResponseMessage?.selectedDisplayText
        || msg.listResponseMessage?.title
        || msg.templateButtonReplyMessage?.selectedDisplayText
        || "";

      // Audio message
      if (msg.audioMessage) {
        isAudio = true;
        audioUrl = msg.audioMessage.url || msg.audioMessage.directPath || null;
        // UAZAPI may provide base64 or a download URL
        if (data.base64 || data.mediaBase64) {
          audioUrl = data.base64 || data.mediaBase64;
        }
        if (data.mediaUrl) {
          audioUrl = data.mediaUrl;
        }
      }

      // Image/document with caption
      if (!textMessage && (msg.imageMessage?.caption || msg.documentMessage?.caption || msg.videoMessage?.caption)) {
        textMessage = msg.imageMessage?.caption || msg.documentMessage?.caption || msg.videoMessage?.caption || "";
      }
    } else {
      // Flat/legacy format fallback
      phone = body.phone || body.from || body.number || body.remoteJid?.replace(/@.*$/, "") || "";
      textMessage = body.message || body.text || body.body || body.conversation || "";
      audioUrl = body.audioUrl || body.audio_url || body.mediaUrl || null;
      isAudio = body.isAudio || body.type === "audio" || body.messageType === "audioMessage" || !!audioUrl;
    }

    // Ignore group messages (JID contains @g.us)
    if (phone.includes("@g.us") || body.data?.key?.remoteJid?.includes("@g.us")) {
      return new Response(JSON.stringify({ handled: false, reason: "group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!phone) {
      return new Response(JSON.stringify({ error: "no phone found in payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Parsed: phone=${phone}, text=${textMessage?.slice(0, 100)}, isAudio=${isAudio}`);

    // Find user by phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone_verified")
      .eq("phone", phone)
      .eq("phone_verified", true)
      .single();

    if (!profile) {
      // Unknown number - ignore silently
      return new Response(JSON.stringify({ handled: false, reason: "unknown phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = profile.user_id;
    let userText = textMessage;

    // Transcribe audio if needed
    if (isAudio && audioUrl) {
      try {
        userText = await transcribeAudio(LOVABLE_API_KEY, audioUrl);
        if (!userText) {
          await sendWhatsApp(UAZAPI_URL, UAZAPI_TOKEN, phone, "❌ Não consegui entender o áudio. Tente novamente ou envie por texto.");
          return new Response(JSON.stringify({ handled: true, action: "audio_fail" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("Audio transcription failed:", e);
        // Fallback: try to use whatever text was sent
        if (!userText) {
          await sendWhatsApp(UAZAPI_URL, UAZAPI_TOKEN, phone, "❌ Não consegui processar o áudio. Envie por texto, por favor.");
          return new Response(JSON.stringify({ handled: true, action: "audio_fail" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (!userText?.trim()) {
      return new Response(JSON.stringify({ handled: false, reason: "empty message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for AI
    const nome = profile.display_name?.split(" ")[0] || "Usuário";
    const context = `Usuário: ${nome}\nHoje: ${brNow().toLocaleDateString("pt-BR")}`;

    // Parse intent
    const intent = await parseIntent(LOVABLE_API_KEY, userText, context);

    // Execute action
    const response = await executeAction(supabase, userId, intent);

    // Send reply
    await sendWhatsApp(UAZAPI_URL, UAZAPI_TOKEN, phone, response);

    return new Response(JSON.stringify({
      handled: true,
      module: intent.module,
      action: intent.action,
      transcribed: isAudio ? userText : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-hub error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
