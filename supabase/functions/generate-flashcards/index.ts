import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Configuração do backend ausente");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subjectName, topic, syllabus, count } = await req.json();
    const safeCount = Math.min(20, Math.max(1, Number(count) || 5));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!LOVABLE_API_KEY && !OPENAI_API_KEY) {
      throw new Error("Nenhum provedor de IA configurado");
    }

    const systemPrompt = `Você é um especialista em aprendizagem ativa e memorização.
Gere flashcards curtos, claros e úteis, em português do Brasil.
Evite duplicidade, respostas longas e perguntas vagas.
Cada flashcard deve testar um conceito importante por vez.`;

    const userPrompt = `Crie ${safeCount} flashcards sobre a disciplina "${subjectName || "Geral"}"${topic ? ` com foco em "${topic}"` : ""}.
${syllabus ? `
Use também esta ementa como contexto:
${syllabus}
` : ""}
Os flashcards devem cobrir definições, relações entre conceitos, aplicações e pontos que costumam cair em provas.`;

    const requestBody = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_flashcards",
            description: "Retorna os flashcards gerados em formato estruturado.",
            parameters: {
              type: "object",
              properties: {
                flashcards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      front: { type: "string", description: "Pergunta ou frente do flashcard" },
                      back: { type: "string", description: "Resposta ou verso do flashcard" },
                    },
                    required: ["front", "back"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["flashcards"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_flashcards" } },
    };

    const runAiRequest = async (provider: "lovable" | "openai") => {
      const isLovable = provider === "lovable";
      const apiKey = isLovable ? LOVABLE_API_KEY : OPENAI_API_KEY;
      const endpoint = isLovable
        ? "https://ai.gateway.lovable.dev/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
      const model = isLovable ? "google/gemini-3-flash-preview" : "gpt-4.1";

      if (!apiKey) throw new Error(`Chave ${isLovable ? "LOVABLE_API_KEY" : "OPENAI_API_KEY"} ausente`);

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

    let aiRes = LOVABLE_API_KEY ? await runAiRequest("lovable") : await runAiRequest("openai");

    if (LOVABLE_API_KEY && !aiRes.ok && [402, 403].includes(aiRes.status) && OPENAI_API_KEY) {
      const fallbackReason = await aiRes.clone().text();
      console.warn("Lovable AI indisponível no generate-flashcards, usando fallback OpenAI", {
        status: aiRes.status,
        reason: fallbackReason.slice(0, 200),
      });
      aiRes = await runAiRequest("openai");
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("generate-flashcards AI error:", aiRes.status, errText);

      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if ([402, 403].includes(aiRes.status)) {
        return new Response(JSON.stringify({ error: "Serviço de IA temporariamente indisponível." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao gerar flashcards" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const toolCallArgs = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const rawContent = aiData.choices?.[0]?.message?.content;

    let parsed: { flashcards?: Array<{ front: string; back: string }> } = {};

    if (toolCallArgs) {
      parsed = JSON.parse(toolCallArgs);
    } else if (typeof rawContent === "string") {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        parsed = Array.isArray(extracted) ? { flashcards: extracted } : extracted;
      }
    }

    const flashcards = (parsed.flashcards || [])
      .filter((card) => card?.front?.trim() && card?.back?.trim())
      .slice(0, safeCount)
      .map((card) => ({
        front: card.front.trim(),
        back: card.back.trim(),
      }));

    if (flashcards.length === 0) {
      return new Response(JSON.stringify({ error: "A IA não retornou flashcards válidos." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ flashcards }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-flashcards error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});