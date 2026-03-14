import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== HELPERS ==========

const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; decimals: number }> = {
  BRL: { symbol: "R$", locale: "pt-BR", decimals: 2 },
  USD: { symbol: "$", locale: "en-US", decimals: 2 },
  EUR: { symbol: "€", locale: "de-DE", decimals: 2 },
  GBP: { symbol: "£", locale: "en-GB", decimals: 2 },
  MZN: { symbol: "MT", locale: "pt-MZ", decimals: 2 },
  JPY: { symbol: "¥", locale: "ja-JP", decimals: 0 },
};

let _userCurrency = "BRL";

function setUserCurrency(code: string) {
  _userCurrency = CURRENCY_CONFIG[code] ? code : "BRL";
}

function fmtMoney(v: number, currencyCode?: string) {
  const code = currencyCode || _userCurrency;
  const cfg = CURRENCY_CONFIG[code] || CURRENCY_CONFIG.BRL;
  const formatted = Number(v).toLocaleString(cfg.locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  });
  // Intl uses "MTn"/"MTN" for MZN; replace with custom symbol
  if (code === "MZN") return formatted.replace(/MTn|MTN/g, "MT");
  return formatted;
}

// Keep backward compat alias
function fmtBRL(v: number) {
  return fmtMoney(v);
}

function brNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function normalizeText(value: unknown): string {
  return safeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const WEEKDAY_KEYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
const WEEKDAY_LABELS: Record<string, string> = {
  domingo: "domingo",
  segunda: "segunda-feira",
  terca: "terça-feira",
  quarta: "quarta-feira",
  quinta: "quinta-feira",
  sexta: "sexta-feira",
  sabado: "sábado",
};
const WEEKDAY_ALIASES: Record<string, string[]> = {
  domingo: ["domingo", "dom"],
  segunda: ["segunda", "segunda feira", "seg", "monday"],
  terca: ["terca", "terca feira", "ter", "tuesday"],
  quarta: ["quarta", "quarta feira", "qua", "wednesday"],
  quinta: ["quinta", "quinta feira", "qui", "thursday"],
  sexta: ["sexta", "sexta feira", "sex", "friday"],
  sabado: ["sabado", "sab", "saturday"],
};

function getRequestedWeekdayFromText(text: string, now = brNow()): string | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  if (normalized.includes("hoje")) {
    return WEEKDAY_KEYS[now.getDay()];
  }
  if (normalized.includes("amanha")) {
    return WEEKDAY_KEYS[(now.getDay() + 1) % 7];
  }

  for (const [dayKey, aliases] of Object.entries(WEEKDAY_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) return dayKey;
  }

  return null;
}

function workoutMatchesWeekday(workout: any, weekday: string): boolean {
  const haystack = normalizeText(`${safeString(workout?.day)} ${safeString(workout?.name)}`);
  const aliases = WEEKDAY_ALIASES[weekday] || [weekday];
  return aliases.some((alias) => haystack.includes(alias));
}

function formatWorkoutMessage(planTitle: string, workout: any): string {
  const label = safeString(workout?.day) || safeString(workout?.name) || "Treino";
  let msg = `🏋️ *${planTitle}*\n\n📌 *${label}*\n`;
  const exercises = workout?.exercises || [];
  exercises.forEach((ex: any) => {
    msg += `\n• ${safeString(ex?.name)}`;
    if (ex?.sets) msg += ` — ${ex.sets}x${ex.reps || ""}`;
    if (ex?.rest) msg += ` (descanso: ${ex.rest})`;
    if (ex?.weight && ex.weight !== "—" && ex.weight !== "") msg += ` | ${ex.weight}`;
  });
  return msg;
}

function safeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.body === "string") return obj.body;
    if (typeof obj.conversation === "string") return obj.conversation;
  }

  return "";
}

function normalizePhone(value: string | null | undefined) {
  return safeString(value).replace(/\D/g, "");
}

function stripCountryCode(value: string) {
  const digits = normalizePhone(value);
  // Strip common country codes: Brazil (55), Mozambique (258), Portugal (351)
  if (digits.startsWith("55") && digits.length > 11) return digits.slice(2);
  if (digits.startsWith("258") && digits.length > 9) return digits.slice(3);
  if (digits.startsWith("351") && digits.length > 9) return digits.slice(3);
  return digits;
}

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function sendWhatsApp(url: string, tokenCandidates: string[], phone: string, text: string) {
  const tokens = [...new Set(tokenCandidates.map((t) => safeString(t).trim()).filter(Boolean))];
  if (!tokens.length) throw new Error("No UAZAPI token available to send reply");

  const number = safeString(phone).replace(/@.*$/, "");
  let lastError: Error | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    const response = await fetch(`${url}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ number, text: `*ORBE*\n\n${text}` }),
    });

    const responseText = await response.text();
    if (response.ok) {
      if (i > 0) console.log(`Reply sent with fallback token #${i + 1}`);
      return responseText;
    }

    const err = new Error(`UAZAPI send error [${response.status}]: ${responseText.slice(0, 400)}`);

    if (response.status === 401 || response.status === 403) {
      console.warn(`Token #${i + 1} rejected by UAZAPI (${response.status}), trying fallback if available`);
      lastError = err;
      continue;
    }

    throw err;
  }

  throw lastError ?? new Error("Unable to send WhatsApp reply");
}

// ========== AI FUNCTIONS ==========

async function callAI(apiKey: string, systemPrompt: string, userMessage: string, tools?: any[], toolChoice?: any, chatHistory?: Array<{role: string, content: string}>) {
  const messages: any[] = [
    { role: "system", content: systemPrompt },
  ];
  // Add recent chat history for context
  if (chatHistory?.length) {
    for (const msg of chatHistory) {
      messages.push({ role: msg.role === "assistant" ? "assistant" : "user", content: msg.content });
    }
  }
  messages.push({ role: "user", content: userMessage });

  const body: any = { model: "google/gemini-3-flash-preview", messages };
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

async function downloadMediaFromUazapi(uazapiUrl: string, uazapiToken: string, messageId: string): Promise<{ base64: string; mimeType: string }> {
  // Correct UAZAPI endpoint: POST /message/download with { id: messageId }
  const downloadUrl = `${uazapiUrl}/message/download`;
  console.log(`Downloading media via UAZAPI: id=${messageId}, url=${downloadUrl}`);

  const res = await fetch(downloadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: uazapiToken },
    body: JSON.stringify({ id: messageId }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`UAZAPI media download failed [${res.status}]:`, errText.slice(0, 300));
    throw new Error(`UAZAPI media download failed [${res.status}]`);
  }

  const data = await res.json();
  console.log(`UAZAPI media response keys: ${Object.keys(data).join(", ")}`);

  // UAZAPI returns { base64: "...", mimetype: "audio/ogg; codecs=opus" } or similar
  if (data.base64) {
    return { base64: data.base64, mimeType: data.mimetype || data.mimeType || "audio/ogg" };
  }

  // Some UAZAPI versions return the data nested
  if (data.data?.base64) {
    return { base64: data.data.base64, mimeType: data.data.mimetype || data.data.mimeType || "audio/ogg" };
  }

  // Some UAZAPI versions return a URL to the decrypted file
  const fileUrl = data.fileURL || data.fileUrl || data.url || data.mediaUrl || data.data?.fileURL || data.data?.url;
  if (fileUrl) {
    console.log(`UAZAPI returned file URL, downloading: ${fileUrl}`);
    const mediaRes = await fetch(fileUrl);
    if (!mediaRes.ok) throw new Error(`Failed to fetch decrypted media [${mediaRes.status}]`);
    const buffer = new Uint8Array(await mediaRes.arrayBuffer());
    const ct = data.mimetype || data.mimeType || mediaRes.headers.get("content-type") || "audio/ogg";
    return { base64: uint8ToBase64(buffer), mimeType: ct.split(";")[0].trim() };
  }

  throw new Error("UAZAPI media download returned no usable data: " + JSON.stringify(data).slice(0, 300));
}

async function downloadMediaDirect(url: string): Promise<{ base64: string; mimeType: string }> {
  const mediaRes = await fetch(url);
  if (!mediaRes.ok) {
    const mediaErr = await mediaRes.text();
    throw new Error(`Falha ao baixar áudio [${mediaRes.status}]: ${mediaErr.slice(0, 200)}`);
  }
  const buffer = new Uint8Array(await mediaRes.arrayBuffer());
  const ct = mediaRes.headers.get("content-type") || "audio/ogg";
  return { base64: uint8ToBase64(buffer), mimeType: ct.split(";")[0].trim() };
}

async function transcribeAudio(_apiKey: string, audioBase64: string, mimeType = "audio/ogg"): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  // Determine file extension from mime type
  let cleanMime = mimeType.split(";")[0].trim();
  if (!cleanMime.startsWith("audio/")) cleanMime = "audio/ogg";
  const extMap: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/x-m4a": "m4a",
  };
  const ext = extMap[cleanMime] || "ogg";

  console.log(`Transcribing audio via OpenAI Whisper: mime=${cleanMime}, ext=${ext}, base64_length=${audioBase64.length}`);

  // Convert base64 to binary
  const binaryStr = atob(audioBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  // Build multipart form data for OpenAI Whisper API
  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type: cleanMime }), `audio.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("OpenAI Whisper transcription error:", res.status, t, `mime=${cleanMime}, ext=${ext}, bytes=${bytes.length}`);
    throw new Error(`Não consegui transcrever o áudio [${res.status}]: ${t.slice(0, 200)}`);
  }

  const data = await res.json();
  const transcription = (data.text || "").trim();
  console.log(`Transcription result: "${transcription.slice(0, 100)}"`);
  return transcription;
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
              "wallet_balance", "monthly_summary", "financial_projection", "check_savings_goal", "save_to_cofrinho",
              // Estudos
              "list_events", "add_event", "list_subjects", "subject_question", "check_class_schedule",
              // Fit
              "log_workout", "active_plan", "check_progress", "nutrition_question",
              // Tarefas
              "add_task", "list_tasks", "complete_task", "delete_task",
              // Geral
              "daily_summary", "help", "chat",
              // Agentes conversacionais
              "agent_chat"
            ]
          },
          params: {
            type: "object",
            description: "Parameters for the action",
            properties: {
              name: { type: "string", description: "Name/title. For expenses/incomes: 'Supermercado', 'Uber'. For academic events (add_event): the full event title e.g. 'Trabalho de Matemática Discreta', 'Prova de Cálculo'. ALWAYS fill this." },
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
              day: { type: "string", description: "Target weekday when asking for routine by day (ex: segunda, terça, hoje, amanhã)." },
              month: { type: "number" },
              year: { type: "number" },
              wallet_name: { type: "string" },
              paid: { type: "boolean" },
              goal_name: { type: "string", description: "Name of a savings goal (cofrinho/meta). E.g. 'reserva emergência', 'viagem'." },
              show_exercises: { type: "boolean", description: "Set to true when the user explicitly asks to see the exercises of a workout. Default false — just confirm which workout it is." },
              agent: { type: "string", enum: ["fit", "finance", "studies_central"], description: "Which agent to connect for agent_chat. fit=Personal/Nutricionista, finance=Consultor Financeiro, studies_central=Tutor de Estudos" },
            },
          },
          reply_text: { type: "string", description: "Friendly reply message to send back to user via WhatsApp. Portuguese Brazilian." },
        },
        required: ["module", "action", "reply_text"],
      },
    },
  },
];

async function parseIntent(apiKey: string, text: string, context: string, chatHistory?: Array<{role: string, content: string}>) {
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
- Valores financeiros na moeda do usuário (informada no contexto)
- Se o usuário pedir resumo do dia, use "daily_summary"
- Para qualquer pergunta conversacional, use action "chat" com reply_text respondendo diretamente
- IMPORTANTE: Ao registrar gastos (add_expense), SEMPRE preencha params.category com a categoria mais adequada entre: Alimentação, Educação, Lazer, Moradia, Saúde, Transporte, Vestuário, Outros. Ex: supermercado → "Alimentação", uber → "Transporte", farmácia → "Saúde".
- IMPORTANTE: Para gastos (add_expense), se o usuário mencionar de qual carteira/banco o dinheiro saiu, preencha params.wallet_name. Se NÃO mencionar, deixe wallet_name VAZIO — o sistema vai perguntar automaticamente de qual carteira saiu. NÃO invente o nome da carteira.
- IMPORTANTE: DIFERENCIE entre EVENTOS ACADÊMICOS e TAREFAS GENÉRICAS:
  • Provas, trabalhos, seminários, apresentações, entregas de disciplina, atividades acadêmicas → use "add_event" (módulo estudos). Preencha params.subject_name com a disciplina, params.type com "prova", "trabalho" ou "seminario", e params.due_date com a data.
  • Tarefas do dia-a-dia (comprar algo, ligar, pagar, resolver algo pessoal) → use "add_task" (módulo tarefas).
  • Se mencionar disciplina, matéria, faculdade, professor, ou termos acadêmicos → SEMPRE é add_event, NUNCA add_task.
- IMPORTANTE: Quando o usuário perguntar "tenho aula hoje?", "quais aulas de quarta?", "tenho aula amanhã?" ou qualquer pergunta sobre HORÁRIO/GRADE de aulas, use action "check_class_schedule" com params.day preenchido (ex: "quarta", "hoje", "amanha"). NÃO use list_events — list_events é para provas/trabalhos/eventos, NÃO para grade de aulas.
- IMPORTANTE: Ao responder sobre treinos, dieta ou agenda, responda APENAS sobre o dia específico perguntado. NÃO liste a semana inteira. Se perguntaram "treino de segunda", mostre SÓ o de segunda. Se perguntaram "treino de hoje", mostre SÓ o de hoje.
- MUITO IMPORTANTE: Quando o usuário perguntar "temos treino hoje?", "tem treino hoje?", "qual o treino de hoje?", "treino de segunda?" ou qualquer pergunta sobre QUAL TREINO fazer em um dia, use action "active_plan" com params.day preenchido (ex: "hoje", "segunda", "amanha"). NÃO use check_progress — check_progress é APENAS para ver peso, IMC e evolução corporal. active_plan é para ver o PLANO DE TREINO do dia.
- Quando o usuário pedir para ver os exercícios de um treino específico, use action "active_plan" com params.day e params.show_exercises = true.
- IMPORTANTE: Quando o usuário perguntar sobre metas de economia, cofrinho, reserva de emergência, quanto falta para alcançar uma meta, use action "check_savings_goal" e preencha params.goal_name. NÃO use monthly_summary para perguntas sobre metas.
- IMPORTANTE: Quando o usuário quiser GUARDAR/DEPOSITAR dinheiro no cofrinho (ex: "guardei 500 no cofrinho", "depositar 200 na reserva"), use action "save_to_cofrinho". Preencha params.amount, params.wallet_name (de onde sai o dinheiro) e params.goal_name (meta destino). Se o usuário NÃO mencionar o nome da meta, deixe goal_name vazio — o sistema vai listar as opções.
- IMPORTANTE: Quando o usuário perguntar sobre saldo, gastos ou informações de uma carteira/conta ESPECÍFICA, preencha params.wallet_name com o nome da carteira. Responda APENAS com os dados da carteira pedida. NÃO inclua dados de outras carteiras, resumo geral ou patrimônio total a menos que o usuário peça explicitamente.
- Mantenha respostas CONCISAS e FOCADAS no que foi perguntado. Máximo 10-15 linhas no WhatsApp.
- MUITO IMPORTANTE: Leve em conta o HISTÓRICO DE CONVERSA recente. Se o usuário está respondendo a uma pergunta anterior, CONECTE com o contexto anterior.
- MUITO IMPORTANTE: Se a última mensagem do assistente no histórico foi um LEMBRETE DE TAREFA (ex: "Você tem tarefa pra hoje: Comprar leite") e o usuário responde com algo como "já fiz", "feito", "já comprei", "pronto", "concluído" → a intenção é COMPLETAR A TAREFA (complete_task), NÃO registrar gasto. Preencha params.task_title com o título da tarefa mencionada no lembrete.
- NUNCA invente dados que não estão na mensagem. Se o usuário diz "já comprei" sem mencionar valor, NÃO crie um gasto com valor inventado. Verifique se faz sentido como conclusão de tarefa primeiro.
- IMPORTANTE: Quando o usuário quiser CONVERSAR com um agente especialista, use action "agent_chat":
  • "falar com personal", "nutricionista", "quero o personal", "personal me ajuda" → agent_chat com params.agent = "fit"
  • "falar com consultor", "consultor financeiro", "análise financeira detalhada" → agent_chat com params.agent = "finance"
  • "falar com tutor", "tutor de estudos", "me ajuda com as matérias" → agent_chat com params.agent = "studies_central"
  • Perguntas que exigem análise PROFUNDA com cruzamento de dados (ex: "analisa minha evolução", "monta um plano de estudos") → sugira agent_chat.
  • Ações rápidas (registrar gasto, ver saldo, criar tarefa) NÃO precisam de agent_chat — use as ações normais.`;

  const result = await callAI(apiKey, systemPrompt, text, INTENT_TOOLS, { type: "function", function: { name: "execute_action" } }, chatHistory);

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

function parseFallbackIntent(text: string) {
  const t = text.trim().toLowerCase();

  if (t.startsWith("tarefa:") || t.startsWith("tarefa ") || t.includes("adicionar tarefa")) {
    const title = text.replace(/^tarefa\s*:\s*/i, "").replace(/^adicionar tarefa\s*/i, "").trim() || "Tarefa WhatsApp";
    return {
      module: "tarefas",
      action: "add_task",
      params: { task_title: title, category: "geral", priority: "media" },
      reply_text: `✅ Tarefa criada: *${title}*`,
    };
  }

  if (t.includes("minhas tarefas") || t.includes("tarefas pendentes")) {
    return {
      module: "tarefas",
      action: "list_tasks",
      params: {},
      reply_text: "📋 Aqui estão suas tarefas pendentes:",
    };
  }

  if (t.includes("resumo financeiro") || t.includes("como está minha grana")) {
    return {
      module: "financeiro",
      action: "monthly_summary",
      params: {},
      reply_text: "📊 Aqui vai seu resumo financeiro:",
    };
  }

  return {
    module: "geral",
    action: "chat",
    params: {},
    reply_text: "Recebi sua mensagem 👍. Tente 'tarefa: ...', 'minhas tarefas' ou 'resumo financeiro'.",
  };
}

// ========== AGENT ORCHESTRATOR CALLER ==========

async function callAgentOrchestrator(supabase: any, userId: string, agent: string, userMessage: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente no whatsapp-hub");
  }

  // Load recent chat history for context continuity
  const { data: recentMsgs } = await supabase
    .from("agent_chat_messages")
    .select("role, content")
    .eq("user_id", userId)
    .eq("agent", agent)
    .order("created_at", { ascending: false })
    .limit(20);

  const history = (recentMsgs || []).reverse().map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  // Add current message
  history.push({ role: "user", content: userMessage });

  const orchestratorUrl = `${supabaseUrl}/functions/v1/agent-orchestrator`;
  const resp = await fetch(orchestratorUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: anonKey || serviceRoleKey,
      "x-internal-service-key": serviceRoleKey,
    },
    body: JSON.stringify({
      messages: history,
      agent,
      user_id: userId,
      stream: false,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Agent orchestrator error [${resp.status}]:`, errText.slice(0, 300));
    throw new Error(`Erro no agente [${resp.status}]`);
  }

  const data = await resp.json();
  return data.content || "Desculpe, não consegui gerar uma resposta.";
}

// ========== ACTION EXECUTORS ==========

async function executeAction(supabase: any, userId: string, intent: any, originalText = ""): Promise<string> {
  const { module, action, params = {}, reply_text } = intent;
  const now = brNow();
  const currentMonth = params.month || now.getMonth() + 1;
  const currentYear = params.year || now.getFullYear();

  try {
    switch (action) {
      // ===== FINANCEIRO =====
      case "add_expense": {
        const dueDate = params.due_date || now.toISOString().split("T")[0];
        // Look up category by name if provided
        let categoryId: string | null = null;
        if (params.category) {
          const { data: cats } = await supabase.from("categories")
            .select("id, name")
            .ilike("name", `%${params.category}%`)
            .limit(1);
          if (cats?.length) {
            categoryId = cats[0].id;
          }
        }

        // Fetch user's wallets
        const { data: userWallets } = await supabase.from("wallets")
          .select("id, name, balance")
          .eq("user_id", userId)
          .order("is_default", { ascending: false });

        // Look up wallet by name if provided
        let walletId: string | null = null;
        let walletName: string | null = null;
        if (params.wallet_name && userWallets?.length) {
          const normalizedInput = normalizeText(params.wallet_name);
          const found = userWallets.find((w: any) =>
            normalizeText(w.name).includes(normalizedInput) || normalizedInput.includes(normalizeText(w.name))
          );
          if (found) {
            walletId = found.id;
            walletName = found.name;
          }
        }

        // If no wallet specified, ask the user which wallet to use
        if (!walletId && userWallets?.length) {
          let walletList = userWallets.map((w: any, i: number) =>
            `${i + 1}. ${w.name} (${fmtBRL(w.balance)})`
          ).join("\n");

          await supabase.from("whatsapp_pending_actions").insert({
            user_id: userId,
            action_type: "select_expense_wallet",
            action_data: {
              name: params.name || "Gasto WhatsApp",
              amount: params.amount || 0,
              due_date: dueDate,
              category_id: categoryId,
              type: params.type || "variavel",
              wallets: userWallets.map((w: any) => ({ id: w.id, name: w.name, balance: w.balance })),
            },
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          });

          return `💸 Percebi que você gastou *${fmtBRL(params.amount || 0)}* com *${params.name || "despesa"}*.\n\nDe qual carteira/banco saiu o dinheiro?\n\n${walletList}\n\nResponda com o número ou nome.`;
        }

        // Check wallet balance before registering
        if (walletId && userWallets?.length) {
          const wallet = userWallets.find((w: any) => w.id === walletId);
          if (wallet && wallet.balance < (params.amount || 0)) {
            return `❌ Saldo insuficiente na carteira *${wallet.name}*.\n\n💰 Saldo atual: ${fmtBRL(wallet.balance)}\n💸 Valor do gasto: ${fmtBRL(params.amount || 0)}\n\nTente outra carteira ou adicione saldo primeiro.`;
          }
        }

        const { data: expenseData, error } = await supabase.from("expenses").insert({
          user_id: userId,
          name: params.name || "Gasto WhatsApp",
          amount: params.amount || 0,
          due_date: dueDate,
          month: new Date(dueDate).getMonth() + 1,
          year: new Date(dueDate).getFullYear(),
          type: params.type || "variavel",
          paid: !!walletId,
          category_id: categoryId,
          wallet_id: walletId,
        }).select("id").single();
        if (error) throw error;
        // If wallet specified, create debit transaction
        if (walletId && expenseData) {
          const { error: txError } = await supabase.from("wallet_transactions").insert({
            wallet_id: walletId,
            user_id: userId,
            amount: params.amount || 0,
            type: "debit",
            description: `Gasto: ${params.name || "Despesa WhatsApp"}`,
            reference_type: "expense",
            reference_id: expenseData.id,
          });

          if (txError) {
            // Rollback: never keep paid expense without successful debit
            await supabase.from("expenses").delete().eq("id", expenseData.id);
            throw txError;
          }
        }
        return reply_text;
      }

      case "add_income": {
        // Look up wallet by name if provided
        let incWalletId: string | null = null;
        if (params.wallet_name) {
          const { data: wallets } = await supabase.from("wallets")
            .select("id, name").eq("user_id", userId)
            .ilike("name", `%${params.wallet_name}%`).limit(1);
          if (wallets?.length) {
            incWalletId = wallets[0].id;
          }
        }
        const { data: incomeData, error } = await supabase.from("incomes").insert({
          user_id: userId,
          description: params.name || params.description || "Renda WhatsApp",
          amount: params.amount || 0,
          month: currentMonth,
          year: currentYear,
          recurring: false,
          wallet_id: incWalletId,
        }).select("id").single();
        if (error) throw error;
        // If wallet specified, create credit transaction
        if (incWalletId && incomeData) {
          await supabase.from("wallet_transactions").insert({
            wallet_id: incWalletId,
            user_id: userId,
            amount: params.amount || 0,
            type: "credit",
            description: `Renda: ${params.name || params.description || "Renda WhatsApp"}`,
            reference_type: "income",
            reference_id: incomeData.id,
          });
        }
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
        let query = supabase.from("expenses")
          .select("name, amount, paid, due_date, wallet_id, wallets(name)")
          .eq("user_id", userId).eq("month", currentMonth).eq("year", currentYear)
          .order("due_date");
        // Filter by wallet if specified
        if (params.wallet_name) {
          const { data: wallets } = await supabase.from("wallets")
            .select("id, name").eq("user_id", userId)
            .ilike("name", `%${params.wallet_name}%`).limit(1);
          if (wallets?.length) {
            query = query.eq("wallet_id", wallets[0].id);
          }
        }
        const { data } = await query;
        if (!data?.length) return params.wallet_name
          ? `📊 Nenhum gasto encontrado na conta *${params.wallet_name}* este mês.`
          : "📊 Nenhum gasto registrado este mês.";
        const total = data.reduce((s: number, e: any) => s + Number(e.amount), 0);
        const paid = data.filter((e: any) => e.paid).reduce((s: number, e: any) => s + Number(e.amount), 0);
        const walletLabel = params.wallet_name ? ` (${params.wallet_name})` : "";
        let msg = `📊 *Gastos${walletLabel} ${currentMonth}/${currentYear}*\n\n`;
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
        // If a specific wallet is asked, return ONLY that wallet
        if (params.wallet_name) {
          const { data } = await supabase.from("wallets")
            .select("name, balance").eq("user_id", userId)
            .ilike("name", `%${params.wallet_name}%`).limit(1);
          if (!data?.length) return `🏦 Carteira "${params.wallet_name}" não encontrada.`;
          const w = data[0];
          return `💳 *${w.name}*\nSaldo: ${fmtBRL(Number(w.balance))}`;
        }
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

      case "check_savings_goal": {
        let query = supabase.from("savings_goals")
          .select("name, target_amount, current_amount, deadline")
          .eq("user_id", userId);
        if (params.goal_name) {
          query = query.ilike("name", `%${params.goal_name}%`);
        }
        const { data } = await query;
        if (!data?.length) return params.goal_name
          ? `🐷 Meta "${params.goal_name}" não encontrada.`
          : "🐷 Nenhuma meta de economia cadastrada.";
        
        let msg = "";
        for (const g of data) {
          const target = Number(g.target_amount);
          const current = Number(g.current_amount);
          const remaining = Math.max(target - current, 0);
          const pct = target > 0 ? Math.round((current / target) * 100) : 0;
          msg += `🐷 *${g.name}*\n`;
          msg += `🎯 Meta: ${fmtBRL(target)}\n`;
          msg += `💰 Guardado: ${fmtBRL(current)} (${pct}%)\n`;
          msg += `📌 Falta: ${fmtBRL(remaining)}\n`;
          if (g.deadline) msg += `📅 Prazo: ${new Date(g.deadline).toLocaleDateString("pt-BR")}\n`;
          msg += "\n";
        }
        return msg.trim();
      }

      case "save_to_cofrinho": {
        const amount = params.amount || 0;
        if (amount <= 0) return "❌ Informe o valor a guardar no cofrinho.";

        // Look up wallet
        let cofWalletId: string | null = null;
        let cofWalletName = "";
        if (params.wallet_name) {
          const { data: wallets } = await supabase.from("wallets")
            .select("id, name").eq("user_id", userId)
            .ilike("name", `%${params.wallet_name}%`).limit(1);
          if (wallets?.length) {
            cofWalletId = wallets[0].id;
            cofWalletName = wallets[0].name;
          }
        }

        // Look up savings goals
        const { data: goals } = await supabase.from("savings_goals")
          .select("id, name, target_amount, current_amount")
          .eq("user_id", userId);
        
        if (!goals?.length) return "🐷 Você não tem metas de economia cadastradas. Crie uma no app primeiro!";

        // If goal_name specified, find it
        let targetGoal: any = null;
        if (params.goal_name) {
          const normalized = params.goal_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          targetGoal = goals.find((g: any) => 
            g.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalized)
          );
        }

        // If no goal found and user didn't specify, list options and store pending action
        if (!targetGoal) {
          // Store pending action for follow-up
          await supabase.from("whatsapp_pending_actions").insert({
            user_id: userId,
            action_type: "select_cofrinho_goal",
            action_data: {
              amount,
              wallet_id: cofWalletId,
              wallet_name: cofWalletName,
              goals: goals.map((g: any) => ({
                id: g.id,
                name: g.name,
                target_amount: g.target_amount,
                current_amount: g.current_amount,
              })),
            },
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          });

          let msg = `🐷 Em qual meta deseja guardar ${fmtBRL(amount)}?\n\n`;
          goals.forEach((g: any, i: number) => {
            const current = Number(g.current_amount);
            const target = Number(g.target_amount);
            const remaining = Math.max(target - current, 0);
            msg += `${i + 1}️⃣ *${g.name}* (falta ${fmtBRL(remaining)})\n`;
          });
          msg += `\nResponda com o número ou nome da meta.`;
          return msg;
        }

        // Debit from wallet if specified
        if (cofWalletId) {
          await supabase.from("wallet_transactions").insert({
            wallet_id: cofWalletId,
            user_id: userId,
            amount,
            type: "debit",
            description: `Cofrinho: ${targetGoal.name}`,
            reference_type: "savings",
            reference_id: targetGoal.id,
          });
        }

        // Update savings goal amount
        const newAmount = Number(targetGoal.current_amount) + amount;
        await supabase.from("savings_goals")
          .update({ current_amount: newAmount })
          .eq("id", targetGoal.id);

        const target = Number(targetGoal.target_amount);
        const remaining = Math.max(target - newAmount, 0);
        const pct = target > 0 ? Math.round((newAmount / target) * 100) : 0;

        let msg = `🐷 *${fmtBRL(amount)}* guardado em *${targetGoal.name}*!`;
        if (cofWalletName) msg += `\n💳 Debitado de: ${cofWalletName}`;
        msg += `\n\n💰 Guardado: ${fmtBRL(newAmount)} (${pct}%)`;
        msg += `\n📌 Falta: ${fmtBRL(remaining)}`;
        if (remaining === 0) msg += `\n\n🎉 Parabéns! Meta alcançada!`;
        return msg;
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
          title: params.name || params.task_title || params.description || "Evento WhatsApp",
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
        return reply_text;
      }

      case "check_class_schedule": {
        const requestedDay = getRequestedWeekdayFromText(params.day || "", now)
          || getRequestedWeekdayFromText(originalText, now);
        if (!requestedDay) return "❌ Não entendi qual dia. Diga por exemplo: 'tenho aula na quarta?'";

        const dayLabel = WEEKDAY_LABELS[requestedDay] || requestedDay;
        const { data: subjects } = await supabase.from("subjects")
          .select("name, schedule, color, teacher")
          .eq("user_id", userId);

        if (!subjects?.length) return "📚 Nenhuma disciplina cadastrada.";

        // Filter subjects that have classes on the requested day
        const classesOnDay: { name: string; time: string; teacher: string | null }[] = [];
        for (const subj of subjects) {
          const schedule = (subj.schedule || []) as any[];
          for (const slot of schedule) {
            const rawSlotDay = safeString(slot.day || slot.dia || slot.weekday || slot.diaSemana || slot.week_day);
            const slotDayKey = getRequestedWeekdayFromText(rawSlotDay, now);
            if (slotDayKey === requestedDay) {
              // Build time string from start/end fields (format used by the app)
              const startTime = safeString(slot.start || slot.startTime || slot.time || slot.horario || slot.hora);
              const endTime = safeString(slot.end || slot.endTime);
              const timeStr = startTime && endTime ? `${startTime} - ${endTime}` : startTime || "";
              classesOnDay.push({
                name: subj.name,
                time: timeStr,
                teacher: subj.teacher,
              });
            }
          }
        }

        if (!classesOnDay.length) return `✅ Nenhuma aula na *${dayLabel}*! Dia livre. 🎉`;

        // Sort by time
        classesOnDay.sort((a, b) => a.time.localeCompare(b.time));

        let msg = `📚 *Aulas de ${dayLabel}*\n\n`;
        classesOnDay.forEach((c) => {
          msg += `📖 *${c.name}*\n`;
          if (c.time) msg += `   🕐 ${c.time}\n`;
          if (c.teacher) msg += `   👨‍🏫 ${c.teacher}\n`;
          msg += "\n";
        });
        return msg;
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

        const workouts = (plan.plan_data as any)?.workouts || (plan.plan_data as any)?.days || [];
        const requestedWeekday = getRequestedWeekdayFromText(params.day || params.weekday || params.dia || "", now) || getRequestedWeekdayFromText(originalText, now);

        if (requestedWeekday) {
          // 1. Try direct name/day match first
          let workout = workouts.find((w: any) => workoutMatchesWeekday(w, requestedWeekday));

          // 2. If no match, map workouts to user's weekly_availability days
          if (!workout && workouts.length > 0) {
            const { data: fitProfile } = await supabase.from("fit_profiles")
              .select("weekly_availability").eq("user_id", userId).maybeSingle();
            
            const availability = (fitProfile?.weekly_availability || []) as string[];
            // Normalize availability days to WEEKDAY_KEYS format
            const availableDays: string[] = [];
            for (const rawDay of availability) {
              const dayKey = getRequestedWeekdayFromText(rawDay, now);
              if (dayKey && !availableDays.includes(dayKey)) availableDays.push(dayKey);
            }
            // Sort by weekday order (segunda=1 ... sabado=6, domingo=0)
            availableDays.sort((a, b) => {
              const order = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 } as Record<string, number>;
              return (order[a] ?? 99) - (order[b] ?? 99);
            });

            // Map workout index to available day
            const dayIndex = availableDays.indexOf(requestedWeekday);
            if (dayIndex >= 0 && dayIndex < workouts.length) {
              workout = workouts[dayIndex];
            }
          }

          if (!workout) {
            // Check if there's ANY workout today by cycling through workouts
            // based on the day of the week (fallback for plans without availability)
            const todayDayNum = now.getDay(); // 0=dom, 1=seg...
            // Exclude sunday (rest) and map mon-sat = indices 0-5
            if (todayDayNum >= 1 && todayDayNum <= 6 && workouts.length > 0) {
              const idx = (todayDayNum - 1) % workouts.length;
              // Only use this fallback if the requested day matches today
              if (requestedWeekday === WEEKDAY_KEYS[todayDayNum]) {
                workout = workouts[idx];
              }
            }
          }

          if (!workout) return `❌ Não encontrei treino para *${WEEKDAY_LABELS[requestedWeekday] || requestedWeekday}* no seu plano atual.\n\nHoje pode ser dia de descanso! 💤`;
          
          const dayLabel = WEEKDAY_LABELS[requestedWeekday] || requestedWeekday;
          const workoutLabel = safeString(workout?.name) || safeString(workout?.day) || "Treino";
          
          // If user just asked "temos treino hoje?" → simple confirmation
          // If user asked for exercises → show full detail
          if (params.show_exercises) {
            return `📅 *${dayLabel}*\n\n` + formatWorkoutMessage(plan.title, workout);
          }
          
          // Simple, motivational confirmation
          const exerciseCount = (workout?.exercises || []).length;
          return `💪 Sim, campeão! Para *${dayLabel}* temos:\n\n🏋️ *${workoutLabel}*${exerciseCount ? ` (${exerciseCount} exercícios)` : ""}\n\nQuer ver os exercícios detalhados? É só me dizer! 🔥`;
        }

        let msg = `🏋️ *${plan.title}*\n\n`;
        // Try to show day mapping if available
        let availableDays: string[] = [];
        const { data: fitProfile2 } = await supabase.from("fit_profiles")
          .select("weekly_availability").eq("user_id", userId).maybeSingle();
        const avail2 = (fitProfile2?.weekly_availability || []) as string[];
        for (const rawDay of avail2) {
          const dk = getRequestedWeekdayFromText(rawDay, now);
          if (dk && !availableDays.includes(dk)) availableDays.push(dk);
        }
        availableDays.sort((a, b) => {
          const order = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 } as Record<string, number>;
          return (order[a] ?? 99) - (order[b] ?? 99);
        });

        workouts.slice(0, 7).forEach((w: any, i: number) => {
          const dayTag = availableDays[i] ? `${WEEKDAY_LABELS[availableDays[i]]}` : "";
          msg += `📌 *${w.name || w.day}*${dayTag ? ` (${dayTag})` : ""}\n`;
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
          `🤖 *Agentes IA (conversa profunda):*\n` +
          `• "falar com o personal"\n` +
          `• "consultor financeiro"\n` +
          `• "tutor de estudos"\n` +
          `• "sair" (encerrar sessão)\n\n` +
          `📊 *Geral:*\n` +
          `• "resumo do dia"\n` +
          `• "ajuda"\n\n` +
          `🎤 Também aceito áudio!`;
      }

      case "agent_chat": {
        const agentType = params.agent || "fit";
        const agentLabels: Record<string, string> = {
          fit: "🏋️ *Personal/Nutricionista*",
          finance: "💰 *Consultor Financeiro*",
          studies_central: "📚 *Tutor de Estudos*",
        };

        // Create agent session (30 min)
        await supabase.from("whatsapp_pending_actions").insert({
          user_id: userId,
          action_type: "agent_session",
          action_data: { agent: agentType },
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        });

        // Check if message has a real question beyond activation
        const justActivation = /^(falar|quero|conectar|chamar|abrir|iniciar)\s+(com\s+)?(o\s+)?(personal|nutricionista|consultor|financeiro|tutor|estudos)/i.test(originalText.trim());

        if (!justActivation && originalText.trim().length > 15) {
          try {
            const agentResponse = await withTimeout(
              callAgentOrchestrator(supabase, userId, agentType, originalText),
              25000, "agent_first_msg"
            );

            await supabase.from("agent_chat_messages").insert([
              { user_id: userId, agent: agentType, role: "user", content: originalText, source: "whatsapp" },
              { user_id: userId, agent: agentType, role: "assistant", content: agentResponse, source: "whatsapp" },
            ]);

            return `🔗 ${agentLabels[agentType] || "Agente"} conectado!\n\n${agentResponse}\n\n_Diga *sair* para voltar ao modo normal._`;
          } catch (e) {
            console.error("Agent first msg error:", e);
          }
        }

        return `🔗 ${agentLabels[agentType] || "Agente"} conectado!\n\nAgora suas mensagens vão direto para o agente com acesso completo aos seus dados.\n\nPergunte o que quiser! Diga *sair* para voltar ao modo normal.`;
      }

      case "chat":
      default:
        return reply_text || "Não entendi. Diga *ajuda* para ver o que posso fazer! 🤖";
    }
  } catch (e) {
    console.error(`Action error [${action}]:`, e);
    const rawMessage = e instanceof Error
      ? e.message
      : ((e as any)?.message || "erro desconhecido");
    const normalizedError = normalizeText(rawMessage);

    if (normalizedError.includes("saldo insuficiente")) {
      return `❌ ${rawMessage}`;
    }

    return `❌ Não consegui concluir sua solicitação. ${rawMessage}`;
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
    if (!UAZAPI_URL) throw new Error("UAZAPI_URL not configured");

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();

    // Log full structure keys for debugging
    console.log("Webhook keys:", JSON.stringify(Object.keys(body)));
    console.log("EventType:", body.EventType);
    if (body.chat) console.log("chat keys:", JSON.stringify(Object.keys(body.chat)));
    if (body.message) console.log("message obj:", JSON.stringify(body.message).slice(0, 800));
    if (body.messages) console.log("messages obj:", JSON.stringify(body.messages).slice(0, 800));
    // Log any key that might contain the actual text
    for (const k of ["text", "body", "content", "conversation", "msg", "data", "Info"]) {
      if (body[k] !== undefined) console.log(`body.${k}:`, JSON.stringify(body[k]).slice(0, 500));
    }

    const webhookToken = safeString(body.token).trim();
    const configuredToken = safeString(UAZAPI_TOKEN).trim();
    const outboundTokens = [webhookToken, configuredToken];
    if (!outboundTokens.some(Boolean)) throw new Error("No UAZAPI token available to send reply");

    // ===== PARSE UAZAPI WEBHOOK FORMAT =====
    // UAZAPI v2 format: { BaseUrl, EventType: "messages", chat: {...}, message?: {...}, ... }
    // The actual message content and phone number location needs to be determined from logs.

    let phone = "";
    let textMessage = "";
    let audioUrl: string | null = null;
    let audioMimeType = "audio/ogg";
    let isAudio = false;
    let messageId = "";

    if (body.EventType === "messages" || body.EventType === "message") {
      // UAZAPI proprietary format
      const chat = body.chat || {};
      const msg = body.message || body.msg || body.data || {};

      // Phone priority for UAZAPI payload
      const chatId = safeString(chat.id || chat.jid || chat.remoteJid || chat.wa_chatid || "");
      phone = safeString(
        msg.sender_pn
        || msg.chatid
        || chat.phone
        || chat.number
        || msg.owner
        || body.phone
        || body.from
        || chatId
      );

      // sanitize jid-like phone formats
      phone = phone.replace(/@.*$/, "");

      // Check if it's our own message (fromMe)
      if (msg.fromMe === true || body.fromMe === true || msg.key?.fromMe === true) {
        return new Response(JSON.stringify({ handled: false, reason: "own message" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract text from message (UAZAPI)
      // IMPORTANT: msg.content can be an object {text, contextInfo}, so only use .text from it
      textMessage = msg.text
        || (typeof msg.content === "string" ? msg.content : msg.content?.text)
        || msg.conversation
        || msg.body
        || msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.extendedTextMessage?.text
        || msg.caption
        || (typeof body.text === "string" ? body.text : "")
        || (typeof body.body === "string" ? body.body : "")
        || body.conversation
        || "";

      // If message is a nested object with a key property (baileys style inside uazapi)
      if (!textMessage && msg.key && msg.message) {
        const innerMsg = msg.message;
        textMessage = innerMsg.conversation
          || innerMsg.extendedTextMessage?.text
          || innerMsg.imageMessage?.caption
          || innerMsg.videoMessage?.caption
          || innerMsg.documentMessage?.caption
          || "";

        if (innerMsg.audioMessage) {
          isAudio = true;
          audioUrl = innerMsg.audioMessage.url || innerMsg.audioMessage.directPath || null;
          audioMimeType = innerMsg.audioMessage.mimetype || "audio/ogg";
        }

        if (!phone && msg.key.remoteJid) phone = msg.key.remoteJid.replace(/@.*$/, "");

        if (msg.key.fromMe) {
          return new Response(JSON.stringify({ handled: false, reason: "own message" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Extract messageid for media download via UAZAPI
      messageId = msg.messageid || msg.id || msg.key?.id || "";

      // Audio
      if (!isAudio && (
        msg.type === "audio"
        || msg.type === "ptt"
        || msg.messageType === "AudioMessage"
        || msg.messageType === "audioMessage"
        || body.type === "audio"
      )) {
        isAudio = true;
        audioUrl = msg.content?.URL || msg.mediaUrl || msg.url || msg.audioUrl || body.mediaUrl || null;
        audioMimeType = msg.content?.mimetype || msg.mimetype || "audio/ogg";
      }
      if (body.base64 && isAudio) audioUrl = body.base64;
      if (body.mediaUrl) audioUrl = body.mediaUrl;

    } else if (body.event === "messages.upsert" || body.data?.key) {
      // Baileys/whatsmeow direct format
      const data = body.data || body;
      const key = data.key || {};
      const msg = data.message || {};

      if (key.fromMe) {
        return new Response(JSON.stringify({ handled: false, reason: "own message" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      phone = (key.remoteJid || "").replace(/@.*$/, "");
      textMessage = msg.conversation || msg.extendedTextMessage?.text || "";

      if (msg.audioMessage) {
        isAudio = true;
        audioUrl = msg.audioMessage.url || data.mediaUrl || null;
        audioMimeType = msg.audioMessage.mimetype || "audio/ogg";
      }
      if (!textMessage) {
        textMessage = msg.imageMessage?.caption || msg.documentMessage?.caption || msg.videoMessage?.caption || "";
      }
    } else {
      // Generic fallback
      phone = body.phone || body.from || body.number || body.remoteJid?.replace(/@.*$/, "") || "";
      textMessage = body.message || body.text || body.body || body.conversation || "";
      audioUrl = body.audioUrl || body.audio_url || body.mediaUrl || null;
      isAudio = body.isAudio || body.type === "audio" || !!audioUrl;
    }

    // Ignore group messages
    if (phone.includes("-") || body.chat?.id?.includes("@g.us")) {
      return new Response(JSON.stringify({ handled: false, reason: "group message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!phone) {
      console.log("No phone found. Full body:", JSON.stringify(body).slice(0, 2000));
      return new Response(JSON.stringify({ error: "no phone found in payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure textMessage is always a string
    if (typeof textMessage !== "string") {
      textMessage = textMessage?.text || textMessage?.body || JSON.stringify(textMessage) || "";
    }
    textMessage = String(textMessage || "");

    console.log(`Parsed: phone=${phone}, text=${textMessage.slice(0, 100)}, isAudio=${isAudio}`);

    // Find user by phone (normalized match)
    const incomingPhone = normalizePhone(phone);
    const incomingPhoneNoCc = stripCountryCode(incomingPhone);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone, phone_verified, currency")
      .eq("phone_verified", true);

    if (profilesError) throw profilesError;

    const profile = (profiles || []).find((p: any) => {
      const pNorm = normalizePhone(p.phone);
      const pNoCc = stripCountryCode(pNorm);
      return pNorm === incomingPhone || pNoCc === incomingPhoneNoCc;
    });

    if (!profile) {
      console.log(`Unknown phone. incoming=${incomingPhone} (raw=${phone})`);
      return new Response(JSON.stringify({ handled: false, reason: "unknown phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = profile.user_id;
    setUserCurrency(profile.currency || "BRL");

    // Deduplicate incoming messages to avoid loops/repeated replies from webhook retries
    if (messageId) {
      const { error: dedupError } = await supabase
        .from("whatsapp_processed_messages")
        .insert({ user_id: userId, message_id: messageId });

      if (dedupError) {
        // 23505 = unique_violation (already processed)
        if ((dedupError as any).code === "23505") {
          console.log(`Duplicate message ignored: ${messageId}`);
          return new Response(JSON.stringify({ handled: false, reason: "duplicate message" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw dedupError;
      }
    }

    let userText = textMessage;

    // Transcribe audio if needed
    if (isAudio) {
      try {
        let audioB64 = "";
        let audioMime = audioMimeType;

        // Strategy 1: Use UAZAPI media download (decrypts WA encrypted media)
        if (messageId && UAZAPI_URL) {
          try {
            const tokens = [safeString(body.token).trim(), safeString(UAZAPI_TOKEN).trim()].filter(Boolean);
            let downloaded = false;
            for (const tok of tokens) {
              try {
                const media = await withTimeout(downloadMediaFromUazapi(UAZAPI_URL, tok, messageId), 10000, "uazapi_media");
                audioB64 = media.base64;
                audioMime = media.mimeType;
                downloaded = true;
                break;
              } catch (dlErr) {
                console.warn(`UAZAPI media download with token failed:`, dlErr);
              }
            }
            if (!downloaded) throw new Error("All UAZAPI media download attempts failed");
          } catch (uazErr) {
            console.warn("UAZAPI media download failed, trying direct URL:", uazErr);
          }
        }

        // Strategy 2: Direct URL download (may fail for encrypted media)
        if (!audioB64 && audioUrl) {
          try {
            const direct = await withTimeout(downloadMediaDirect(audioUrl), 10000, "direct_media");
            audioB64 = direct.base64;
            audioMime = direct.mimeType;
          } catch (directErr) {
            console.warn("Direct media download failed:", directErr);
          }
        }

        if (!audioB64) {
          throw new Error("Could not download audio from any source");
        }

        userText = await withTimeout(transcribeAudio(LOVABLE_API_KEY, audioB64, audioMime), 20000, "audio_transcription");
        if (!userText?.trim()) {
          try {
            await sendWhatsApp(UAZAPI_URL, outboundTokens, phone, "❌ Não consegui entender o áudio. Tente novamente ou envie por texto.");
          } catch (sendErr) {
            console.error("Failed to send audio_fail message:", sendErr);
          }
          return new Response(JSON.stringify({ handled: true, action: "audio_fail" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("Audio transcription failed:", e);
        try {
          await sendWhatsApp(UAZAPI_URL, outboundTokens, phone, "❌ Não consegui processar o áudio. Envie por texto, por favor.");
        } catch (sendErr) {
          console.error("Failed to send audio error message:", sendErr);
        }
        return new Response(JSON.stringify({ handled: true, action: "audio_fail" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!userText?.trim()) {
      return new Response(JSON.stringify({ handled: false, reason: "empty message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for pending actions (e.g. cofrinho goal selection)
    let responseText = "";
    let skipNormalFlow = false;
    let intent: any = null;

    const { data: pendingActions } = await supabase.from("whatsapp_pending_actions")
      .select("*")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (pendingActions?.length) {
      const pending = pendingActions[0];

      // ===== AGENT SESSION: route messages to agent orchestrator =====
      if (pending.action_type === "agent_session") {
        const agentData = pending.action_data as any;
        const agentType = agentData?.agent || "fit";
        const exitRe = /^(sair|voltar|encerrar|modo normal|menu)\s*[!.]*$/i;

        // Detect agent-switching/activation requests within an active session
        const normalizedUserText = normalizeText(userText);
        const switchMatch = normalizedUserText.match(
          /(?:falar|quero|conectar|chamar|abrir|iniciar)?\s*(?:com\s+)?(?:o\s+)?(personal|nutricionista|consultor|financeiro|tutor|estudos)/
        );
        const agentSwitchMap: Record<string, string> = {
          personal: "fit", nutricionista: "fit",
          consultor: "finance", financeiro: "finance",
          tutor: "studies_central", estudos: "studies_central",
        };
        const switchTarget = switchMatch ? agentSwitchMap[switchMatch[1]] : null;
        const agentLabels: Record<string, string> = {
          fit: "🏋️ *Personal/Nutricionista*",
          finance: "💰 *Consultor Financeiro*",
          studies_central: "📚 *Tutor de Estudos*",
        };

        if (exitRe.test(userText.trim())) {
          await supabase.from("whatsapp_pending_actions").delete().eq("id", pending.id);
          responseText = "👋 Sessão encerrada! Voltou ao modo normal.\n\nDiga *ajuda* para ver os comandos disponíveis.";
        } else if (switchTarget && switchTarget !== agentType) {
          // Switch to a different agent
          await supabase.from("whatsapp_pending_actions")
            .update({
              action_data: { agent: switchTarget },
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            })
            .eq("id", pending.id);

          responseText = `🔄 Sessão trocada!\n\n🔗 ${agentLabels[switchTarget] || "Agente"} conectado!\n\nAgora suas mensagens vão direto para o novo agente. Pergunte o que quiser! Diga *sair* para voltar ao modo normal.`;
        } else if (switchTarget && switchTarget === agentType) {
          // User repeated activation phrase for the same active agent; confirm instead of forwarding to AI
          await supabase.from("whatsapp_pending_actions")
            .update({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
            .eq("id", pending.id);

          responseText = `✅ ${agentLabels[agentType] || "Agente"} já está conectado.\n\nPode mandar sua pergunta agora — vou responder com base nos seus dados.`;
        } else {
          // Refresh session expiry
          await supabase.from("whatsapp_pending_actions")
            .update({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
            .eq("id", pending.id);

          try {
            responseText = await withTimeout(
              callAgentOrchestrator(supabase, userId, agentType, userText),
              25000, "agent_orchestrator"
            );
          } catch (agentErr) {
            console.error("Agent orchestrator error:", agentErr);
            responseText = "❌ Erro ao processar com o agente. Tente novamente.";
          }

          // Save to unified agent_chat_messages table
          try {
            await supabase.from("agent_chat_messages").insert([
              { user_id: userId, agent: agentType, role: "user", content: userText, source: "whatsapp" },
              { user_id: userId, agent: agentType, role: "assistant", content: responseText, source: "whatsapp" },
            ]);
          } catch (saveErr) {
            console.warn("Failed to save agent chat:", saveErr);
          }
        }
        skipNormalFlow = true;
      } else {
        // Non-session pending actions: delete and handle normally
        await supabase.from("whatsapp_pending_actions").delete().eq("id", pending.id);

        if (pending.action_type === "select_cofrinho_goal") {
          const data = pending.action_data as any;
          const goals = data.goals || [];
          const amount = data.amount || 0;
          const walletId = data.wallet_id || null;
          const walletName = data.wallet_name || "";
          const input = userText.trim();

          let selectedGoal: any = null;
          const numMatch = input.match(/\d+/);
          const num = numMatch ? Number(numMatch[0]) : Number.NaN;
          if (!Number.isNaN(num) && num >= 1 && num <= goals.length) {
            selectedGoal = goals[num - 1];
          } else {
            const normalized = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            selectedGoal = goals.find((g: any) =>
              g.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalized)
            );
          }

          if (selectedGoal) {
            if (walletId) {
              await supabase.from("wallet_transactions").insert({
                wallet_id: walletId,
                user_id: userId,
                amount,
                type: "debit",
                description: `Cofrinho: ${selectedGoal.name}`,
                reference_type: "savings",
                reference_id: selectedGoal.id,
              });
            }

            const newAmount = Number(selectedGoal.current_amount) + amount;
            await supabase.from("savings_goals")
              .update({ current_amount: newAmount })
              .eq("id", selectedGoal.id);

            const target = Number(selectedGoal.target_amount);
            const remaining = Math.max(target - newAmount, 0);
            const pct = target > 0 ? Math.round((newAmount / target) * 100) : 0;

            responseText = `🐷 *${fmtBRL(amount)}* guardado em *${selectedGoal.name}*!`;
            if (walletName) responseText += `\n💳 Debitado de: ${walletName}`;
            responseText += `\n\n💰 Guardado: ${fmtBRL(newAmount)} (${pct}%)`;
            responseText += `\n📌 Falta: ${fmtBRL(remaining)}`;
            if (remaining === 0) responseText += `\n\n🎉 Parabéns! Meta alcançada!`;
            skipNormalFlow = true;
          } else {
            responseText = "❌ Não entendi. Responda com o número da meta (ex: 1).";
            await supabase.from("whatsapp_pending_actions").insert({
              user_id: userId,
              action_type: "select_cofrinho_goal",
              action_data: data,
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            });
            skipNormalFlow = true;
          }
        }

        // Handle pending expense wallet selection
        if (pending.action_type === "select_expense_wallet") {
          const data = pending.action_data as any;
          const wallets = data.wallets || [];
          const input = userText.trim();

          let selectedWallet: any = null;
          const numMatch = input.match(/\d+/);
          const num = numMatch ? Number(numMatch[0]) : Number.NaN;
          if (!Number.isNaN(num) && num >= 1 && num <= wallets.length) {
            selectedWallet = wallets[num - 1];
          } else {
            const normalized = normalizeText(input);
            selectedWallet = wallets.find((w: any) =>
              normalizeText(w.name).includes(normalized) || normalized.includes(normalizeText(w.name))
            );
          }

          if (selectedWallet) {
            if (selectedWallet.balance < data.amount) {
              responseText = `❌ Saldo insuficiente na carteira *${selectedWallet.name}*.\n\n💰 Saldo atual: ${fmtBRL(selectedWallet.balance)}\n💸 Valor do gasto: ${fmtBRL(data.amount)}\n\nEscolha outra carteira ou adicione saldo primeiro.\n\n${wallets.map((w: any, i: number) => `${i + 1}. ${w.name} (${fmtBRL(w.balance)})`).join("\n")}`;
              await supabase.from("whatsapp_pending_actions").insert({
                user_id: userId,
                action_type: "select_expense_wallet",
                action_data: data,
                expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              });
              skipNormalFlow = true;
            } else {
              const dueDate = data.due_date || brNow().toISOString().split("T")[0];
              const { data: expenseData, error: expError } = await supabase.from("expenses").insert({
                user_id: userId,
                name: data.name,
                amount: data.amount,
                due_date: dueDate,
                month: new Date(dueDate).getMonth() + 1,
                year: new Date(dueDate).getFullYear(),
                type: data.type || "variavel",
                paid: true,
                category_id: data.category_id,
                wallet_id: selectedWallet.id,
              }).select("id").single();

              if (expError) throw expError;

              if (expenseData) {
                const { error: txError } = await supabase.from("wallet_transactions").insert({
                  wallet_id: selectedWallet.id,
                  user_id: userId,
                  amount: data.amount,
                  type: "debit",
                  description: `Gasto: ${data.name}`,
                  reference_type: "expense",
                  reference_id: expenseData.id,
                });
                if (txError) {
                  await supabase.from("expenses").delete().eq("id", expenseData.id);
                  throw txError;
                }
              }

              responseText = `✅ Gasto registrado!\n\n💸 *${data.name}*: ${fmtBRL(data.amount)}\n💳 Carteira: ${selectedWallet.name}\n💰 Novo saldo: ${fmtBRL(selectedWallet.balance - data.amount)}`;
              skipNormalFlow = true;
            }
          } else {
            responseText = "❌ Não entendi. Responda com o número da carteira (ex: 1).";
            await supabase.from("whatsapp_pending_actions").insert({
              user_id: userId,
              action_type: "select_expense_wallet",
              action_data: data,
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            });
            skipNormalFlow = true;
          }
        }
      }
    }

    if (!skipNormalFlow) {
      // Build context for AI
      const nome = profile.display_name?.split(" ")[0] || "Usuário";
      const userCurrencyCode = profile.currency || "BRL";
      const userCurrencySymbol = CURRENCY_CONFIG[userCurrencyCode]?.symbol || "R$";
      let context = `Usuário: ${nome}\nHoje: ${brNow().toLocaleDateString("pt-BR")}\nMoeda do usuário: ${userCurrencyCode} (${userCurrencySymbol}). Use SEMPRE esta moeda ao falar de valores financeiros.`;

      // Add today's pending tasks as context so the AI knows about them
      try {
        const todayStr = brNow().toISOString().split("T")[0];
        const { data: pendingTasks } = await supabase
          .from("tasks")
          .select("id, title, due_date, category")
          .eq("user_id", userId)
          .eq("status", "pendente")
          .lte("due_date", todayStr + "T23:59:59")
          .order("due_date", { ascending: true })
          .limit(10);
        if (pendingTasks?.length) {
          context += `\n\nTAREFAS PENDENTES DO USUÁRIO HOJE:`;
          for (const t of pendingTasks) {
            context += `\n- "${t.title}" (categoria: ${t.category || "geral"})`;
          }
        }
      } catch (taskCtxErr) {
        console.warn("Failed to fetch pending tasks context:", taskCtxErr);
      }

      // Fetch recent chat history (last 10 messages within 30 min)
      let chatHistory: Array<{role: string, content: string}> = [];
      try {
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: historyRows } = await supabase
          .from("whatsapp_chat_history")
          .select("role, content")
          .eq("user_id", userId)
          .gte("created_at", thirtyMinAgo)
          .order("created_at", { ascending: true })
          .limit(10);
        chatHistory = historyRows || [];
      } catch (histErr) {
        console.warn("Failed to fetch chat history:", histErr);
      }

      // Parse intent with timeout + deterministic fallback
      try {
        intent = await withTimeout(parseIntent(LOVABLE_API_KEY, userText, context, chatHistory), 18000, "parse_intent");
      } catch (intentError) {
        console.error("Intent parsing failed, using fallback:", intentError);
        intent = parseFallbackIntent(userText);
      }

      // Execute action with timeout
      try {
        responseText = await withTimeout(executeAction(supabase, userId, intent, userText), 12000, "execute_action");
      } catch (actionError) {
        console.error("Action execution failed:", actionError);
        responseText = "❌ Tive um erro ao executar sua solicitação. Tente novamente em instantes.";
      }
    }

    // Store user message and bot reply in chat history
    try {
      await supabase.from("whatsapp_chat_history").insert([
        { user_id: userId, role: "user", content: userText },
        { user_id: userId, role: "assistant", content: responseText },
      ]);
    } catch (storeErr) {
      console.warn("Failed to store chat history:", storeErr);
    }

    // Send reply and expose send status
    const intentModule = intent?.module || "geral";
    const intentAction = intent?.action || "pending_action";
    try {
      await withTimeout(sendWhatsApp(UAZAPI_URL, outboundTokens, phone, responseText), 12000, "send_reply");
    } catch (sendError) {
      console.error("Reply send failed:", sendError);
      return new Response(JSON.stringify({
        handled: true,
        module: intentModule,
        action: intentAction,
        transcribed: isAudio ? userText : undefined,
        send_status: "failed",
        send_error: sendError instanceof Error ? sendError.message : "unknown",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      handled: true,
      module: intentModule,
      action: intentAction,
      transcribed: isAudio ? userText : undefined,
      send_status: "sent",
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
