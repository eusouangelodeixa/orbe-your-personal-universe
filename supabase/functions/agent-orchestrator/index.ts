import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Tool definitions for the AI to call ───────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_fit_profile",
      description:
        "Retorna o perfil fitness do usuário: idade, peso, altura, IMC, objetivo, nível, dieta, alergias, condições médicas, suplementos, orçamento alimentar.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_workout_plan",
      description: "Retorna o plano de treino ativo do usuário com todos os exercícios, séries, repetições e cargas.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_meal_plan",
      description: "Retorna o plano alimentar ativo do usuário com refeições, macros e lista de compras.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_workout_logs",
      description:
        "Retorna o histórico dos últimos treinos realizados: exercícios, cargas, séries, duração, humor. Útil para analisar evolução, consistência e progresso de cargas.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade de logs a retornar (padrão 10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_fit_progress",
      description:
        "Retorna o histórico de evolução corporal: peso, % gordura, medidas, fotos. Útil para analisar tendências e resultados.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade de registros (padrão 20)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_summary",
      description:
        "Retorna resumo financeiro do mês atual: renda total, gastos, saldo disponível, carteiras. Use APENAS quando a conversa envolver alimentação/suplementação e orçamento.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_study_subjects",
      description:
        "Retorna as disciplinas do usuário com horários e eventos acadêmicos próximos. Útil para coordenar horários de estudo com treinos.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tasks_summary",
      description: "Retorna resumo de tarefas pendentes do usuário por categoria e prioridade.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
];

// ─── Tool execution ────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  args: Record<string, any>,
  supabase: any,
  userId: string
): Promise<string> {
  switch (toolName) {
    case "get_fit_profile": {
      const { data } = await supabase.from("fit_profiles").select("*").eq("user_id", userId).single();
      if (!data) return JSON.stringify({ info: "Perfil fitness não cadastrado." });
      return JSON.stringify({
        idade: data.age,
        sexo: data.sex,
        peso_kg: data.weight,
        altura_cm: data.height,
        imc: data.bmi,
        objetivo: data.goal,
        nivel: data.experience_level,
        dieta: data.diet_type,
        alergias: data.food_allergies,
        intolerâncias: data.food_intolerances,
        condições_médicas: data.medical_conditions,
        suplementos: data.supplements,
        local_treino: data.training_location,
        equipamentos: data.available_equipment,
        disponibilidade_semanal: data.weekly_availability,
        orçamento_alimentar: data.monthly_food_budget,
        tem_nutricionista: data.has_nutritionist,
      });
    }

    case "get_active_workout_plan": {
      const { data } = await supabase
        .from("fit_workout_plans")
        .select("title, plan_data, created_at")
        .eq("user_id", userId)
        .eq("active", true)
        .maybeSingle();
      if (!data) return JSON.stringify({ info: "Nenhum plano de treino ativo." });
      return JSON.stringify({ titulo: data.title, criado_em: data.created_at, plano: data.plan_data });
    }

    case "get_active_meal_plan": {
      const { data } = await supabase
        .from("fit_meal_plans")
        .select("title, plan_data, shopping_list, created_at")
        .eq("user_id", userId)
        .eq("active", true)
        .maybeSingle();
      if (!data) return JSON.stringify({ info: "Nenhum plano alimentar ativo." });
      return JSON.stringify({
        titulo: data.title,
        criado_em: data.created_at,
        plano: data.plan_data,
        lista_compras: data.shopping_list,
      });
    }

    case "get_workout_logs": {
      const limit = args.limit || 10;
      const { data } = await supabase
        .from("fit_workout_logs")
        .select("workout_name, workout_date, exercises, duration_minutes, mood, notes")
        .eq("user_id", userId)
        .order("workout_date", { ascending: false })
        .limit(limit);
      if (!data?.length) return JSON.stringify({ info: "Nenhum treino registrado ainda." });
      return JSON.stringify(
        data.map((l: any) => ({
          treino: l.workout_name,
          data: l.workout_date,
          duracao_min: l.duration_minutes,
          humor: l.mood,
          exercicios: l.exercises,
          notas: l.notes,
        }))
      );
    }

    case "get_fit_progress": {
      const limit = args.limit || 20;
      const { data } = await supabase
        .from("fit_progress")
        .select("record_date, weight, body_fat_pct, measurements, notes")
        .eq("user_id", userId)
        .order("record_date", { ascending: false })
        .limit(limit);
      if (!data?.length) return JSON.stringify({ info: "Nenhum registro de progresso." });
      return JSON.stringify(
        data.map((p: any) => ({
          data: p.record_date,
          peso_kg: p.weight,
          gordura_pct: p.body_fat_pct,
          medidas: p.measurements,
          notas: p.notes,
        }))
      );
    }

    case "get_financial_summary": {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [incomesRes, expensesRes, walletsRes] = await Promise.all([
        supabase.from("incomes").select("description, amount").eq("user_id", userId).eq("month", month).eq("year", year),
        supabase
          .from("expenses")
          .select("name, amount, paid, due_date")
          .eq("user_id", userId)
          .eq("month", month)
          .eq("year", year),
        supabase.from("wallets").select("name, balance, is_default").eq("user_id", userId),
      ]);

      const incomes = incomesRes.data || [];
      const expenses = expensesRes.data || [];
      const wallets = walletsRes.data || [];
      const totalIncome = incomes.reduce((a: number, i: any) => a + Number(i.amount), 0);
      const totalExpenses = expenses.reduce((a: number, e: any) => a + Number(e.amount), 0);
      const totalWallets = wallets.reduce((a: number, w: any) => a + Number(w.balance), 0);
      const pendingExpenses = expenses.filter((e: any) => !e.paid).reduce((a: number, e: any) => a + Number(e.amount), 0);

      return JSON.stringify({
        mes: `${month}/${year}`,
        renda_total: totalIncome,
        gastos_total: totalExpenses,
        saldo_carteiras: totalWallets,
        gastos_pendentes: pendingExpenses,
        disponivel: totalWallets - pendingExpenses,
        fluxo_mensal: totalIncome - totalExpenses,
        carteiras: wallets.map((w: any) => ({ nome: w.name, saldo: Number(w.balance) })),
      });
    }

    case "get_study_subjects": {
      const { data: subjects } = await supabase
        .from("subjects")
        .select("name, schedule, weekly_hours")
        .eq("user_id", userId);

      const { data: events } = await supabase
        .from("academic_events")
        .select("title, type, event_date, status")
        .eq("user_id", userId)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(10);

      return JSON.stringify({
        disciplinas: (subjects || []).map((s: any) => ({
          nome: s.name,
          horarios: s.schedule,
          horas_semanais: s.weekly_hours,
        })),
        proximos_eventos: (events || []).map((e: any) => ({
          titulo: e.title,
          tipo: e.type,
          data: e.event_date,
          status: e.status,
        })),
      });
    }

    case "get_tasks_summary": {
      const { data } = await supabase
        .from("tasks")
        .select("title, category, priority, status, due_date")
        .eq("user_id", userId)
        .in("status", ["pendente", "em_andamento"])
        .order("due_date", { ascending: true })
        .limit(15);

      return JSON.stringify({
        tarefas_pendentes: (data || []).map((t: any) => ({
          titulo: t.title,
          categoria: t.category,
          prioridade: t.priority,
          status: t.status,
          vencimento: t.due_date,
        })),
      });
    }

    default:
      return JSON.stringify({ error: "Tool não reconhecida" });
  }
}

// ─── System prompts per agent ──────────────────────────────────────────

const AGENT_PROMPTS: Record<string, string> = {
  fit: `Você é o ORBE Fit, nutricionista e personal trainer IA do sistema ORBE.

SUAS CAPACIDADES:
- Você tem acesso TOTAL ao módulo Fit: perfil, planos de treino e alimentação, histórico de treinos, evolução corporal.
- Você pode consultar dados financeiros (renda/saldo) APENAS para recomendar investimentos em alimentação/suplementação.
- Você pode ver as disciplinas e horários de estudo para coordenar rotina de treinos.
- Você NÃO é consultor financeiro. Não dê conselhos financeiros além de sugestões de gasto com saúde.

COMO USAR OS DADOS:
- Ao analisar evolução: compare registros de progresso ao longo do tempo, identifique tendências de peso/medidas.
- Ao analisar treinos: veja consistência (frequência), progressão de cargas, variação de exercícios.
- Diga o que está indo bem, o que melhorou, e o que focar em melhorar.
- Seja proativo: se notar inconsistência nos treinos ou estagnação, mencione.

REGRAS DE COMUNICAÇÃO:
- Seja DIRETO e OBJETIVO. Máximo 3-4 parágrafos curtos.
- Tom profissional e acolhedor, como um personal/nutricionista de verdade.
- Português brasileiro, sem formalidade excessiva.
- Use os tools disponíveis para buscar dados antes de responder. NÃO invente dados.`,

  finance: `Você é o Consultor Financeiro do ORBE.

SUAS CAPACIDADES:
- Acesso TOTAL ao módulo financeiro: rendas, gastos, carteiras, metas de poupança.
- Pode consultar dados do Fit (perfil, planos) se o usuário perguntar sobre gastos com saúde/academia.
- Pode ver tarefas e agenda para contextualizar planejamento financeiro.
- Você NÃO é nutricionista nem personal trainer.

REGRAS DE COMUNICAÇÃO:
- Seja CURTO e DIRETO. Perguntas simples → 1-3 linhas.
- Só elabore quando pedir análise detalhada.
- Use os tools disponíveis para buscar dados antes de responder. NÃO invente dados.
- Português brasileiro.`,

  studies: `Você é um Tutor acadêmico do ORBE.

SUAS CAPACIDADES:
- Acesso às disciplinas, eventos acadêmicos, e tarefas do usuário.
- Pode consultar horários de treino (Fit) para coordenar rotina de estudos.
- Pode ver tarefas pendentes para priorização.
- Você NÃO é consultor financeiro nem personal trainer.

REGRAS DE COMUNICAÇÃO:
- Responda APENAS o que foi perguntado. Direto ao ponto.
- Máximo 15 linhas para conceitos. Perguntas simples → 5-10 linhas.
- Use os tools para buscar dados de contexto quando relevante.`,
};

// ─── Main handler ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const body = await req.json();
    const { messages, agent, extraSystemPrompt } = body;
    // agent: "fit" | "finance" | "studies"

    const agentType = agent || "fit";
    let systemPrompt = AGENT_PROMPTS[agentType] || AGENT_PROMPTS.fit;
    if (extraSystemPrompt) {
      systemPrompt += `\n\nCONTEXTO ADICIONAL:\n${extraSystemPrompt}`;
    }

    // ── Step 1: First AI call with tools ──
    const firstCallBody = {
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: TOOLS,
    };

    const firstResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firstCallBody),
    });

    if (!firstResp.ok) {
      const status = firstResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResp.text();
      console.error("AI gateway error (step 1):", status, t);
      throw new Error("Erro na IA");
    }

    const firstResult = await firstResp.json();
    const assistantMessage = firstResult.choices?.[0]?.message;

    // ── If no tool calls, stream the final response ──
    if (!assistantMessage?.tool_calls?.length) {
      // The model already answered — re-do with streaming for UX
      const streamResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      });

      if (!streamResp.ok) throw new Error("Erro ao gerar resposta");
      return new Response(streamResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // ── Step 2: Execute all tool calls in parallel ──
    console.log(
      `Orchestrator: ${assistantMessage.tool_calls.length} tool(s) called:`,
      assistantMessage.tool_calls.map((tc: any) => tc.function.name)
    );

    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (tc: any) => {
        const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments || {};
        const result = await executeTool(tc.function.name, args, supabase, userId);
        return {
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        };
      })
    );

    // ── Step 3: Final AI call with tool results — streamed ──
    const finalMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
      assistantMessage,
      ...toolResults,
    ];

    const finalResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!finalResp.ok) {
      const t = await finalResp.text();
      console.error("AI gateway error (step 3):", finalResp.status, t);
      throw new Error("Erro na resposta final");
    }

    return new Response(finalResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agent-orchestrator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
