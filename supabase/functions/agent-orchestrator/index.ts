import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchExchangeRates(baseCurrency: string, currencies: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(currencies.filter((currency) => currency && currency !== baseCurrency))];
  if (!unique.length) return {};

  try {
    const resp = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
    if (!resp.ok) return {};

    const data = await resp.json();
    if (data.result !== "success") return {};

    const rates: Record<string, number> = {};
    for (const currency of unique) {
      if (typeof data.rates?.[currency] === "number") {
        rates[currency] = data.rates[currency];
      }
    }
    return rates;
  } catch (error) {
    console.error("fetchExchangeRates error:", error);
    return {};
  }
}

function convertToBase(amount: number, fromCurrency: string, baseCurrency: string, rates: Record<string, number>) {
  if (!fromCurrency || fromCurrency === baseCurrency) return amount;
  const rate = rates[fromCurrency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

function convertWithHistoricalOrLiveRate(
  amount: number,
  fromCurrency: string,
  baseCurrency: string,
  liveRates: Record<string, number>,
  exchangeRateToBrl?: number | null,
) {
  if (!fromCurrency || fromCurrency === baseCurrency) return amount;

  if (exchangeRateToBrl && fromCurrency !== "BRL") {
    const amountInBrl = amount * Number(exchangeRateToBrl);
    if (baseCurrency === "BRL") return amountInBrl;

    const baseRateFromBrl = liveRates.BRL;
    return baseRateFromBrl ? amountInBrl / baseRateFromBrl : amountInBrl;
  }

  return convertToBase(amount, fromCurrency, baseCurrency, liveRates);
}

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
        "Retorna o histórico dos últimos treinos realizados: exercícios, cargas, séries, duração, humor.",
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
        "Retorna o histórico de evolução corporal: peso, % gordura, medidas, fotos.",
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
        "Retorna resumo financeiro do mês atual: renda total, gastos, saldo disponível, carteiras.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_study_subjects",
      description:
        "Retorna TODAS as disciplinas do usuário com horários, professor, semestre, tipo, carga horária e cor.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_all_academic_events",
      description:
        "Retorna TODOS os eventos acadêmicos (provas, trabalhos, atividades, revisões) com datas, notas, pesos, status e disciplina associada. Inclui pendentes, atrasados e concluídos.",
      parameters: {
        type: "object",
        properties: {
          status_filter: { type: "string", description: "Filtrar por status: 'pendente', 'em_andamento', 'entregue', 'realizado', 'all'. Padrão: 'all'" },
          subject_id: { type: "string", description: "Filtrar por disciplina específica (UUID). Opcional." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pomodoro_stats",
      description:
        "Retorna estatísticas de sessões Pomodoro: total de pomodoros, minutos de foco, por disciplina. Útil para analisar dedicação de estudo.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Últimos N dias para analisar (padrão 30)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_subject_grades",
      description:
        "Retorna todas as notas/pesos de eventos de uma disciplina específica para calcular média ponderada e desempenho.",
      parameters: {
        type: "object",
        properties: {
          subject_id: { type: "string", description: "UUID da disciplina" },
        },
        required: ["subject_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_study_schedule_weekly",
      description:
        "Retorna o horário semanal completo de aulas do usuário, organizado por dia da semana, com disciplina e horários.",
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
        idade: data.age, sexo: data.sex, peso_kg: data.weight, altura_cm: data.height,
        imc: data.bmi, objetivo: data.goal, nivel: data.experience_level, dieta: data.diet_type,
        alergias: data.food_allergies, intolerâncias: data.food_intolerances,
        condições_médicas: data.medical_conditions, suplementos: data.supplements,
        local_treino: data.training_location, equipamentos: data.available_equipment,
        disponibilidade_semanal: data.weekly_availability,
        orçamento_alimentar: data.monthly_food_budget, tem_nutricionista: data.has_nutritionist,
      });
    }

    case "get_active_workout_plan": {
      const { data } = await supabase.from("fit_workout_plans").select("title, plan_data, created_at")
        .eq("user_id", userId).eq("active", true).maybeSingle();
      if (!data) return JSON.stringify({ info: "Nenhum plano de treino ativo." });
      return JSON.stringify({ titulo: data.title, criado_em: data.created_at, plano: data.plan_data });
    }

    case "get_active_meal_plan": {
      const { data } = await supabase.from("fit_meal_plans").select("title, plan_data, shopping_list, created_at")
        .eq("user_id", userId).eq("active", true).maybeSingle();
      if (!data) return JSON.stringify({ info: "Nenhum plano alimentar ativo." });
      return JSON.stringify({ titulo: data.title, criado_em: data.created_at, plano: data.plan_data, lista_compras: data.shopping_list });
    }

    case "get_workout_logs": {
      const limit = args.limit || 10;
      const { data } = await supabase.from("fit_workout_logs")
        .select("workout_name, workout_date, exercises, duration_minutes, mood, notes")
        .eq("user_id", userId).order("workout_date", { ascending: false }).limit(limit);
      if (!data?.length) return JSON.stringify({ info: "Nenhum treino registrado ainda." });
      return JSON.stringify(data.map((l: any) => ({
        treino: l.workout_name, data: l.workout_date, duracao_min: l.duration_minutes,
        humor: l.mood, exercicios: l.exercises, notas: l.notes,
      })));
    }

    case "get_fit_progress": {
      const limit = args.limit || 20;
      const { data } = await supabase.from("fit_progress")
        .select("record_date, weight, body_fat_pct, measurements, notes")
        .eq("user_id", userId).order("record_date", { ascending: false }).limit(limit);
      if (!data?.length) return JSON.stringify({ info: "Nenhum registro de progresso." });
      return JSON.stringify(data.map((p: any) => ({
        data: p.record_date, peso_kg: p.weight, gordura_pct: p.body_fat_pct,
        medidas: p.measurements, notas: p.notes,
      })));
    }

    case "get_financial_summary": {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const [incomesRes, expensesRes, walletsRes, goalsRes, profileRes] = await Promise.all([
        supabase.from("incomes").select("id, description, amount, wallet_id, month, year").eq("user_id", userId).eq("month", month).eq("year", year),
        supabase.from("expenses").select("id, name, amount, paid, due_date, wallet_id, month, year").eq("user_id", userId).eq("month", month).eq("year", year),
        supabase.from("wallets").select("id, name, balance, is_default, currency").eq("user_id", userId),
        supabase.from("savings_goals").select("name, target_amount, current_amount, deadline").eq("user_id", userId),
        supabase.from("profiles").select("currency").eq("user_id", userId).single(),
      ]);

      const userCurrency = profileRes.data?.currency || "BRL";
      const incomes = incomesRes.data || [];
      const expenses = expensesRes.data || [];
      const wallets = walletsRes.data || [];
      const goals = goalsRes.data || [];

      const walletCurrencyById: Record<string, string> = {};
      for (const wallet of wallets) {
        walletCurrencyById[wallet.id] = wallet.currency || "BRL";
      }

      const allRecordIds = [
        ...incomes.map((income: any) => income.id),
        ...expenses.map((expense: any) => expense.id),
      ].filter(Boolean);

      const txByRefId: Record<string, { exchange_rate_to_brl: number | null }> = {};
      if (allRecordIds.length) {
        const { data: txRows } = await supabase
          .from("wallet_transactions")
          .select("reference_id, exchange_rate_to_brl")
          .eq("user_id", userId)
          .in("reference_id", allRecordIds);

        for (const tx of txRows || []) {
          if (tx.reference_id) {
            txByRefId[tx.reference_id] = { exchange_rate_to_brl: tx.exchange_rate_to_brl };
          }
        }
      }

      const walletCurrencies = [...new Set(wallets.map((wallet: any) => wallet.currency || "BRL"))];
      const liveRates = await fetchExchangeRates(userCurrency, [...walletCurrencies, "BRL"]);

      const getRecordCurrency = (record: any) => record.wallet_id ? (walletCurrencyById[record.wallet_id] || "BRL") : "BRL";
      const toUserCurrency = (record: any) => {
        const amount = Number(record.amount || 0);
        const recordCurrency = getRecordCurrency(record);
        const historicalRateToBrl = txByRefId[record.id]?.exchange_rate_to_brl != null
          ? Number(txByRefId[record.id].exchange_rate_to_brl)
          : null;

        return convertWithHistoricalOrLiveRate(amount, recordCurrency, userCurrency, liveRates, historicalRateToBrl);
      };

      const totalIncome = incomes.reduce((a: number, income: any) => a + toUserCurrency(income), 0);
      const totalExpenses = expenses.reduce((a: number, expense: any) => a + toUserCurrency(expense), 0);
      const totalWallets = wallets.reduce((a: number, wallet: any) => {
        return a + convertToBase(Number(wallet.balance), wallet.currency || "BRL", userCurrency, liveRates);
      }, 0);
      const pendingExpenses = expenses.filter((expense: any) => !expense.paid).reduce((a: number, expense: any) => a + toUserCurrency(expense), 0);
      const paidExpenses = expenses.filter((expense: any) => expense.paid).reduce((a: number, expense: any) => a + toUserCurrency(expense), 0);

      const topExpenses = [...expenses]
        .map((expense: any) => ({
          ...expense,
          convertedAmount: toUserCurrency(expense),
          recordCurrency: getRecordCurrency(expense),
        }))
        .sort((a: any, b: any) => Number(b.convertedAmount) - Number(a.convertedAmount))
        .slice(0, 5)
        .map((expense: any) => ({
          nome: expense.name,
          valor: Number(expense.convertedAmount),
          valor_original: Number(expense.amount),
          moeda: expense.recordCurrency,
          pago: !!expense.paid,
          vencimento: expense.due_date,
        }));

      const largestExpense = topExpenses.length ? topExpenses[0] : null;

      const totalGoalTarget = goals.reduce((sum: number, g: any) => sum + Number(g.target_amount || 0), 0);
      const totalGoalCurrent = goals.reduce((sum: number, g: any) => sum + Number(g.current_amount || 0), 0);

      return JSON.stringify({
        totais_convertidos: true,
        observacao_totais: `Todos os totais monetários já estão convertidos para ${userCurrency}. Não some valores originais de moedas diferentes.`,
        moeda_usuario: userCurrency,
        mes: `${month}/${year}`,
        tem_dados_no_mes: incomes.length > 0 || expenses.length > 0,
        renda_total: totalIncome,
        gastos_total: totalExpenses,
        gastos_pagos: paidExpenses,
        gastos_pendentes: pendingExpenses,
        saldo_carteiras: totalWallets,
        disponivel: totalWallets - pendingExpenses,
        fluxo_mensal: totalIncome - totalExpenses,
        maior_gasto: largestExpense,
        top_gastos: topExpenses,
        contas_pendentes: expenses.filter((expense: any) => !expense.paid).map((expense: any) => ({
          nome: expense.name,
          valor: toUserCurrency(expense),
          valor_original: Number(expense.amount),
          moeda: getRecordCurrency(expense),
          vencimento: expense.due_date,
        })),
        contas_pagas: expenses.filter((expense: any) => expense.paid).map((expense: any) => ({
          nome: expense.name,
          valor: toUserCurrency(expense),
          valor_original: Number(expense.amount),
          moeda: getRecordCurrency(expense),
        })),
        rendas_registradas: incomes.map((income: any) => ({
          descricao: income.description,
          valor: toUserCurrency(income),
          valor_original: Number(income.amount),
          moeda: getRecordCurrency(income),
        })),
        carteiras: wallets.map((wallet: any) => ({
          nome: wallet.name,
          saldo: convertToBase(Number(wallet.balance), wallet.currency || "BRL", userCurrency, liveRates),
          saldo_original: Number(wallet.balance),
          moeda: wallet.currency || "BRL",
          principal: !!wallet.is_default,
        })),
        metas: goals.map((g: any) => ({
          nome: g.name,
          valor_alvo: Number(g.target_amount),
          valor_atual: Number(g.current_amount),
          prazo: g.deadline,
        })),
        total_metas_alvo: totalGoalTarget,
        total_metas_atual: totalGoalCurrent,
      });
    }

    case "get_study_subjects": {
      const { data: subjects } = await supabase.from("subjects")
        .select("id, name, teacher, course, semester, type, weekly_hours, schedule, color")
        .eq("user_id", userId);
      if (!subjects?.length) return JSON.stringify({ info: "Nenhuma disciplina cadastrada." });
      return JSON.stringify(subjects.map((s: any) => ({
        id: s.id, nome: s.name, professor: s.teacher, curso: s.course,
        semestre: s.semester, tipo: s.type, horas_semanais: s.weekly_hours,
        horarios: s.schedule, cor: s.color,
      })));
    }

    case "get_all_academic_events": {
      let query = supabase.from("academic_events")
        .select("id, title, type, event_date, due_date, status, grade, weight, content_topics, description, is_group, subject_id")
        .eq("user_id", userId)
        .order("event_date", { ascending: true });

      if (args.status_filter && args.status_filter !== "all") {
        query = query.eq("status", args.status_filter);
      }
      if (args.subject_id) {
        query = query.eq("subject_id", args.subject_id);
      }

      const { data } = await query.limit(50);
      if (!data?.length) return JSON.stringify({ info: "Nenhum evento acadêmico encontrado." });

      // Fetch subject names for context
      const subjectIds = [...new Set(data.map((e: any) => e.subject_id))];
      const { data: subjects } = await supabase.from("subjects").select("id, name").in("id", subjectIds);
      const subjectMap = Object.fromEntries((subjects || []).map((s: any) => [s.id, s.name]));

      return JSON.stringify(data.map((e: any) => ({
        titulo: e.title, tipo: e.type, data_evento: e.event_date, data_entrega: e.due_date,
        status: e.status, nota: e.grade, peso: e.weight, conteudo: e.content_topics,
        descricao: e.description, em_grupo: e.is_group,
        disciplina: subjectMap[e.subject_id] || "Desconhecida",
      })));
    }

    case "get_pomodoro_stats": {
      const days = args.days || 30;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      const since = sinceDate.toISOString().split("T")[0];

      const { data } = await supabase.from("pomodoro_sessions")
        .select("subject_id, session_date, completed_pomodoros, total_focus_seconds")
        .eq("user_id", userId)
        .gte("session_date", since)
        .order("session_date", { ascending: false });

      if (!data?.length) return JSON.stringify({ info: `Nenhuma sessão Pomodoro nos últimos ${days} dias.` });

      // Aggregate by subject
      const subjectIds = [...new Set(data.map((p: any) => p.subject_id))];
      const { data: subjects } = await supabase.from("subjects").select("id, name").in("id", subjectIds);
      const subjectMap = Object.fromEntries((subjects || []).map((s: any) => [s.id, s.name]));

      const bySubject: Record<string, { pomodoros: number; minutos: number; sessoes: number }> = {};
      let totalPomodoros = 0;
      let totalMinutes = 0;

      for (const p of data) {
        const name = subjectMap[p.subject_id] || "Desconhecida";
        if (!bySubject[name]) bySubject[name] = { pomodoros: 0, minutos: 0, sessoes: 0 };
        bySubject[name].pomodoros += p.completed_pomodoros;
        bySubject[name].minutos += Math.floor(p.total_focus_seconds / 60);
        bySubject[name].sessoes += 1;
        totalPomodoros += p.completed_pomodoros;
        totalMinutes += Math.floor(p.total_focus_seconds / 60);
      }

      return JSON.stringify({
        periodo: `últimos ${days} dias`,
        total_pomodoros: totalPomodoros,
        total_minutos_foco: totalMinutes,
        total_horas_foco: Math.round(totalMinutes / 60 * 10) / 10,
        por_disciplina: bySubject,
        dias_com_estudo: [...new Set(data.map((p: any) => p.session_date))].length,
      });
    }

    case "get_subject_grades": {
      const { data } = await supabase.from("academic_events")
        .select("title, type, grade, weight, status, event_date")
        .eq("user_id", userId)
        .eq("subject_id", args.subject_id)
        .not("grade", "is", null)
        .order("event_date", { ascending: true });

      if (!data?.length) return JSON.stringify({ info: "Nenhuma nota registrada nesta disciplina." });

      let totalWeight = 0;
      let weightedSum = 0;
      for (const e of data) {
        const w = e.weight || 1;
        totalWeight += w;
        weightedSum += (e.grade || 0) * w;
      }
      const average = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null;

      return JSON.stringify({
        notas: data.map((e: any) => ({
          titulo: e.title, tipo: e.type, nota: e.grade, peso: e.weight,
          data: e.event_date, status: e.status,
        })),
        media_ponderada: average,
        total_avaliacoes: data.length,
      });
    }

    case "get_study_schedule_weekly": {
      const { data: subjects } = await supabase.from("subjects")
        .select("name, schedule, color")
        .eq("user_id", userId);

      if (!subjects?.length) return JSON.stringify({ info: "Nenhuma disciplina com horário cadastrado." });

      const weekDays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
      const schedule: Record<string, { disciplina: string; inicio: string; fim: string }[]> = {};
      for (const day of weekDays) schedule[day] = [];

      for (const sub of subjects) {
        const slots = sub.schedule || [];
        for (const slot of slots) {
          if (slot.day && schedule[slot.day]) {
            schedule[slot.day].push({
              disciplina: sub.name,
              inicio: slot.start,
              fim: slot.end,
            });
          }
        }
      }

      // Sort each day by start time
      for (const day of weekDays) {
        schedule[day].sort((a, b) => a.inicio.localeCompare(b.inicio));
      }

      return JSON.stringify(schedule);
    }

    case "get_tasks_summary": {
      const { data } = await supabase.from("tasks")
        .select("title, category, priority, status, due_date")
        .eq("user_id", userId)
        .in("status", ["pendente", "em_andamento"])
        .order("due_date", { ascending: true }).limit(15);
      return JSON.stringify({
        tarefas_pendentes: (data || []).map((t: any) => ({
          titulo: t.title, categoria: t.category, prioridade: t.priority,
          status: t.status, vencimento: t.due_date,
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
- O sistema é MULTI-MOEDA: carteiras podem ter moedas diferentes (BRL, USD, EUR, MZN, etc). Sempre respeite a moeda preferida do usuário ao formatar valores.
- Quando os dados retornarem "moeda_usuario", use essa moeda para formatar valores. Use o símbolo correto (R$ para BRL, $ para USD, € para EUR, MT para MZN, £ para GBP, ¥ para JPY).
- Pode consultar dados do Fit (perfil, planos) se o usuário perguntar sobre gastos com saúde/academia.
- Pode ver tarefas e agenda para contextualizar planejamento financeiro.
- Você NÃO é nutricionista nem personal trainer.

  REGRAS DE COMUNICAÇÃO:
  - Seja CURTO e DIRETO. Perguntas simples → 1-3 linhas.
  - Só elabore quando pedir análise detalhada.
  - Use os tools disponíveis para buscar dados antes de responder. NÃO invente dados.
  - Os campos renda_total, gastos_total, gastos_pagos, gastos_pendentes, saldo_carteiras, disponivel e fluxo_mensal já vêm convertidos para a moeda do usuário. Trate esses totais como fonte da verdade e NÃO recalcule somando moedas diferentes.
  - Português brasileiro.`,

  studies: `Você é um Tutor acadêmico especializado do ORBE para uma disciplina específica.

SUAS CAPACIDADES:
- Acesso às disciplinas, eventos acadêmicos, e tarefas do usuário.
- Pode consultar horários de treino (Fit) para coordenar rotina de estudos.
- Pode ver tarefas pendentes para priorização.

REGRAS DE COMUNICAÇÃO:
- Responda APENAS o que foi perguntado. Direto ao ponto.
- Máximo 15 linhas para conceitos. Perguntas simples → 5-10 linhas.
- Use os tools para buscar dados de contexto quando relevante.`,

  studies_central: `Você é o Tutor Central de Estudos do ORBE — o coordenador acadêmico IA do usuário.

SUAS CAPACIDADES:
- Acesso TOTAL ao módulo de estudos: TODAS as disciplinas, horários, eventos acadêmicos, notas, provas, trabalhos, atividades.
- Acesso às sessões Pomodoro para analisar tempo de estudo e dedicação por disciplina.
- Pode consultar o módulo Fit para coordenar rotina de treinos com estudos (horários livres, descanso).
- Pode consultar tarefas pendentes para priorização.
- Pode ver dados financeiros se relevante (ex: orçamento para materiais de estudo).

COMO USAR OS DADOS:
- Analise o desempenho global: notas por disciplina, médias ponderadas, tendências.
- Compare dedicação (Pomodoro) vs resultados (notas): disciplinas com pouco estudo e notas baixas precisam de atenção.
- Identifique provas/entregas próximas e sugira plano de estudo.
- Coordene com horários de treino: sugira blocos de estudo nos horários livres.
- Alerte sobre eventos atrasados ou pendentes.
- Diga o que está indo bem, onde o aluno está se destacando, e onde precisa melhorar.

VOCÊ É O AGENTE CENTRAL — você tem visão panorâmica de todas as disciplinas. Os tutores individuais de cada disciplina sabem o conteúdo específico, mas VOCÊ sabe a visão geral: prioridades, distribuição de tempo, desempenho comparativo.

REGRAS DE COMUNICAÇÃO:
- Seja DIRETO e OBJETIVO. Máximo 3-4 parágrafos.
- Tom de orientador acadêmico: firme mas encorajador.
- Português brasileiro, sem formalidade excessiva.
- Use SEMPRE os tools para buscar dados reais antes de responder. NÃO invente dados.
- Quando o assunto for conteúdo específico de uma disciplina, sugira ao usuário usar o tutor individual da disciplina.`,
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!LOVABLE_API_KEY && !OPENAI_API_KEY) throw new Error("Nenhum provedor de IA configurado");

    type AIProvider = "lovable" | "openai";
    let aiProvider: AIProvider = LOVABLE_API_KEY ? "lovable" : "openai";

    const body = await req.json();
    const { messages, agent, extraSystemPrompt, stream: shouldStream = true, user_id: bodyUserId } = body;

    async function fetchChatCompletion(requestBody: Record<string, unknown>) {
      const execute = async (provider: AIProvider) => {
        const isLovable = provider === "lovable";
        const apiKey = isLovable ? LOVABLE_API_KEY : OPENAI_API_KEY;
        const endpoint = isLovable
          ? "https://ai.gateway.lovable.dev/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";
        const model = isLovable ? "google/gemini-3-flash-preview" : "gpt-4.1";

        if (!apiKey) {
          throw new Error(`${isLovable ? "LOVABLE_API_KEY" : "OPENAI_API_KEY"} não configurada`);
        }

        return fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...requestBody,
            model,
          }),
        });
      };

      let response = await execute(aiProvider);

      if (aiProvider === "lovable" && !response.ok && [402, 403].includes(response.status) && OPENAI_API_KEY) {
        const fallbackReason = await response.clone().text();
        console.warn("Lovable AI indisponível no agent-orchestrator, usando fallback OpenAI", {
          status: response.status,
          reason: fallbackReason.slice(0, 200),
        });
        aiProvider = "openai";
        response = await execute("openai");
      }

      return response;
    }

    // Allow internal service calls with explicit user_id (WhatsApp integration)
    const internalKeyHeader = req.headers.get("x-internal-service-key");
    const apiKeyHeader = req.headers.get("apikey");
    const isInternalServiceCall =
      typeof bodyUserId === "string" &&
      bodyUserId.length > 0 &&
      (token === serviceRoleKey ||
        internalKeyHeader === serviceRoleKey ||
        apiKeyHeader === serviceRoleKey);

    let userId: string;
    if (isInternalServiceCall) {
      userId = bodyUserId;
    } else {
      const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    }

    const agentType = agent || "fit";
    let systemPrompt = AGENT_PROMPTS[agentType] || AGENT_PROMPTS.fit;
    if (extraSystemPrompt) {
      systemPrompt += `\n\nCONTEXTO ADICIONAL:\n${extraSystemPrompt}`;
    }

    // ── Helper: normalize AI message content to plain text ──
    function extractTextContent(message: any): string {
      const content = message?.content;

      if (typeof content === "string") return content;

      if (Array.isArray(content)) {
        return content
          .map((part: any) => {
            if (typeof part === "string") return part;
            if (part && typeof part === "object") {
              if (typeof part.text === "string") return part.text;
              if (typeof part.content === "string") return part.content;
              if (typeof part.value === "string") return part.value;
            }
            return "";
          })
          .join("")
          .trim();
      }

      if (content && typeof content === "object") {
        if (typeof content.text === "string") return content.text;
        if (typeof content.content === "string") return content.content;
        if (typeof content.value === "string") return content.value;
      }

      return "";
    }

    // ── Helper: make AI call (streaming or JSON) ──
    async function makeFinalCall(msgs: any[], depth = 0): Promise<Response> {
      const finalRequestBody: Record<string, unknown> = {
        messages: msgs,
        stream: shouldStream,
      };

      // Non-streaming mode can require multiple tool rounds (WhatsApp agent sessions)
      if (!shouldStream) {
        finalRequestBody.tools = TOOLS;
      }

      const finalResp = await fetchChatCompletion(finalRequestBody);

      if (!finalResp.ok) {
        const t = await finalResp.text();
        console.error(`AI error (final:${aiProvider}):`, finalResp.status, t);

        if (finalResp.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if ([402, 403].includes(finalResp.status)) {
          return new Response(JSON.stringify({ error: "Serviço de IA temporariamente indisponível." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        throw new Error("Erro na resposta final");
      }

      if (shouldStream) {
        return new Response(finalResp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      const result = await finalResp.json();
      const message = result?.choices?.[0]?.message;
      const content = extractTextContent(message);
      const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];

      if (!content) {
        console.warn("Orchestrator final call returned empty content", {
          agentType,
          depth,
          toolCallCount: toolCalls.length,
          resultKeys: Object.keys(result || {}),
          messageKeys: message ? Object.keys(message) : [],
          provider: aiProvider,
        });
      }

      if (!content && toolCalls.length && depth < 2) {
        const followupAssistant = {
          ...message,
          content: message?.content || "",
        };

        const followupToolResults = await Promise.all(
          toolCalls.map(async (tc: any) => {
            let args: Record<string, unknown> = {};
            try {
              args = typeof tc?.function?.arguments === "string"
                ? JSON.parse(tc.function.arguments || "{}")
                : (tc?.function?.arguments || {});
            } catch (argErr) {
              console.warn("Invalid tool call args in final round", { tool: tc?.function?.name, argErr });
            }

            const toolName = tc?.function?.name;
            const toolResult = toolName
              ? await executeTool(toolName, args, supabase, userId)
              : JSON.stringify({ error: "tool_name_missing" });

            return {
              role: "tool",
              tool_call_id: tc?.id,
              content: toolResult,
            };
          })
        );

        return await makeFinalCall([
          ...msgs,
          followupAssistant,
          ...followupToolResults,
        ], depth + 1);
      }

      if (!content && depth < 1) {
        return await makeFinalCall([
          ...msgs,
          {
            role: "user",
            content:
              "Agora responda APENAS com texto em português do Brasil, de forma direta, sem chamar ferramentas e sem JSON.",
          },
        ], depth + 1);
      }

      return new Response(JSON.stringify({ content: content || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 1: First AI call with tools ──
    const firstResp = await fetchChatCompletion({
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: TOOLS,
    });

    if (!firstResp.ok) {
      const status = firstResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ([402, 403].includes(status)) {
        return new Response(JSON.stringify({ error: "Serviço de IA temporariamente indisponível." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await firstResp.text();
      console.error(`AI error (step 1:${aiProvider}):`, status, t);
      throw new Error("Erro na IA");
    }

    const firstResult = await firstResp.json();
    const assistantMessage = firstResult.choices?.[0]?.message;

    // ── If no tool calls, make final call ──
    if (!assistantMessage?.tool_calls?.length) {
      return await makeFinalCall([{ role: "system", content: systemPrompt }, ...messages]);
    }

    // ── Step 2: Execute all tool calls in parallel ──
    console.log(
      `Orchestrator [${agentType}]: ${assistantMessage.tool_calls.length} tool(s):`,
      assistantMessage.tool_calls.map((tc: any) => tc.function.name)
    );

    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (tc: any) => {
        const args = typeof tc.function.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments || {};
        const result = await executeTool(tc.function.name, args, supabase, userId);
        return { role: "tool", tool_call_id: tc.id, content: result };
      })
    );

    // ── Step 3: Final AI call with tool results ──
    // Ensure assistantMessage.content is a string (some models return null)
    const sanitizedAssistant = {
      ...assistantMessage,
      content: assistantMessage.content || "",
    };
    console.log(`Orchestrator [${agentType}]: making final call with ${toolResults.length} tool result(s), stream=${shouldStream}`);
    return await makeFinalCall([
      { role: "system", content: systemPrompt },
      ...messages,
      sanitizedAssistant,
      ...toolResults,
    ]);
  } catch (e) {
    console.error("agent-orchestrator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
