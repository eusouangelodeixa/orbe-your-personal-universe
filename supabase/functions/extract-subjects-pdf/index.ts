import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read the form data with the PDF file
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey && !OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert PDF to base64 for Gemini vision
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);

    const mimeType = file.type || "application/pdf";

    // Use AI with vision/tool calling to extract subjects from the PDF
    const systemPrompt = `Você é um extrator de grade horária acadêmica. Analise o PDF/imagem do horário de aulas e extraia TODAS as disciplinas encontradas.

Para cada disciplina, extraia:
- name: nome completo da disciplina
- teacher: nome do professor (se disponível, senão null)
- schedule: array de horários, cada um com { day: "Segunda|Terça|Quarta|Quinta|Sexta|Sábado", start: "HH:MM", end: "HH:MM" }
- weekly_hours: carga horária semanal estimada (calcule com base nos horários, se não estiver explícito)
- type: "teorica", "pratica" ou "laboratorio" (inferir do nome se possível, ex: "Lab" → laboratorio)
- course: nome do curso (se visível no documento)
- semester: semestre (se visível)

REGRAS:
- Se houver aulas duplicadas no mesmo dia (ex: 2 tempos seguidos), agrupe em um único slot com horário início e fim corretos
- Horários devem estar no formato 24h (ex: "08:00", "14:30")
- Dias da semana DEVEM usar exatamente: Segunda, Terça, Quarta, Quinta, Sexta, Sábado
- Se o PDF tiver formato de grade/tabela, interprete linhas e colunas corretamente
- Retorne APENAS disciplinas reais, não cabeçalhos ou labels da tabela`;

    const requestBody = {
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extraia todas as disciplinas deste documento de grade horária. Retorne usando a função extract_subjects.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_subjects",
            description: "Return extracted subjects from the schedule PDF",
            parameters: {
              type: "object",
              properties: {
                subjects: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Subject name" },
                      teacher: { type: "string", description: "Professor name or null" },
                      schedule: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            day: { type: "string", enum: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] },
                            start: { type: "string", description: "Start time HH:MM" },
                            end: { type: "string", description: "End time HH:MM" },
                          },
                          required: ["day", "start", "end"],
                        },
                      },
                      weekly_hours: { type: "number" },
                      type: { type: "string", enum: ["teorica", "pratica", "laboratorio"] },
                      course: { type: "string" },
                      semester: { type: "string" },
                    },
                    required: ["name", "schedule"],
                  },
                },
              },
              required: ["subjects"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_subjects" } },
    };

    const runAiRequest = async (provider: "lovable" | "openai") => {
      const isLovable = provider === "lovable";
      const token = isLovable ? apiKey : OPENAI_API_KEY;
      const endpoint = isLovable
        ? "https://ai.gateway.lovable.dev/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
      const model = isLovable ? "google/gemini-2.5-flash" : "gpt-4o";

      return fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...requestBody, model }),
      });
    };

    let aiResp = apiKey ? await runAiRequest("lovable") : await runAiRequest("openai");

    if (apiKey && !aiResp.ok && [402, 403].includes(aiResp.status) && OPENAI_API_KEY) {
      const fallbackReason = await aiResp.clone().text();
      console.warn("Lovable AI indisponível no extract-subjects-pdf, usando fallback OpenAI", {
        status: aiResp.status,
        reason: fallbackReason.slice(0, 200),
      });
      aiResp = await runAiRequest("openai");
    }

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);

      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ([402, 403].includes(aiResp.status)) {
        return new Response(JSON.stringify({ error: "Serviço de IA temporariamente indisponível." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao processar PDF com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não conseguiu extrair disciplinas deste documento" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const subjects = parsed.subjects || [];

    if (!subjects.length) {
      return new Response(JSON.stringify({ error: "Nenhuma disciplina encontrada no documento" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ subjects }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-subjects-pdf error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
