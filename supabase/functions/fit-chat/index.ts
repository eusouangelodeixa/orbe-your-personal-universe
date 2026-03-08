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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // Get user's fit profile for context
    const { data: fitProfile } = await supabase
      .from("fit_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const profileContext = fitProfile ? `
PERFIL DO USUÁRIO:
- Idade: ${fitProfile.age} anos, Sexo: ${fitProfile.sex}
- Peso: ${fitProfile.weight}kg, Altura: ${fitProfile.height}cm, IMC: ${fitProfile.bmi}
- Objetivo: ${fitProfile.goal}
- Nível: ${fitProfile.experience_level}
- Dieta: ${fitProfile.diet_type}
- Alergias: ${JSON.stringify(fitProfile.food_allergies)}
- Condições: ${JSON.stringify(fitProfile.medical_conditions)}
- Suplementos: ${JSON.stringify(fitProfile.supplements)}
- Orçamento alimentar: R$${fitProfile.monthly_food_budget}/mês
` : "Perfil não cadastrado.";

    const systemPrompt = `Você é o ORBE Fit, um nutricionista e personal trainer IA.

REGRAS DE COMUNICAÇÃO (OBRIGATÓRIAS):
- Seja DIRETO e OBJETIVO. Respostas curtas, como um profissional em consulta.
- Máximo 3-4 parágrafos curtos por resposta. Sem listas enormes.
- Não repita informações que o usuário já sabe.
- Não faça introduções longas. Vá direto ao ponto.
- Use tom profissional e acolhedor, como um nutricionista de verdade falando com seu paciente.
- Só use markdown para organizar quando necessário (negrito para ênfase, listas curtas).
- NÃO faça disclaimers longos. Um breve "consulte seu médico" quando relevante basta.
- Quando o usuário perguntar algo simples, responda em 1-2 frases.
- Português brasileiro, sem formalidade excessiva.

${profileContext}

Você orienta sobre treino, alimentação, suplementação e ajustes de plano.
Para questões médicas sérias, oriente brevemente a buscar um profissional.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro na IA");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("fit-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
