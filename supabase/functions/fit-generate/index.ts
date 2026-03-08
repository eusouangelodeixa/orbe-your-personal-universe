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

    const { type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // Get user's fit profile
    const { data: fitProfile } = await supabase
      .from("fit_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!fitProfile) throw new Error("Perfil Fit não encontrado. Complete o cadastro primeiro.");

    const profileContext = `
PERFIL DO USUÁRIO:
- Idade: ${fitProfile.age} anos, Sexo: ${fitProfile.sex}
- Peso: ${fitProfile.weight}kg, Altura: ${fitProfile.height}cm, IMC: ${fitProfile.bmi}
- Objetivo: ${fitProfile.goal}
- Nível: ${fitProfile.experience_level}
- Local de treino: ${fitProfile.training_location}
- Dias disponíveis: ${JSON.stringify(fitProfile.weekly_availability)}
- Equipamentos: ${JSON.stringify(fitProfile.available_equipment)}
- Tipo de dieta: ${fitProfile.diet_type}
- Alergias: ${JSON.stringify(fitProfile.food_allergies)}
- Intolerâncias: ${JSON.stringify(fitProfile.food_intolerances)}
- Condições médicas: ${JSON.stringify(fitProfile.medical_conditions)}
- Suplementos: ${JSON.stringify(fitProfile.supplements)}
- Nutricionista: ${fitProfile.has_nutritionist ? "Sim" : "Não"}
- Orçamento alimentar: R$${fitProfile.monthly_food_budget}/mês
`;

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "workout") {
      systemPrompt = `Você é um personal trainer profissional. Crie um plano de treino personalizado em JSON.
O JSON deve ter o formato: { "title": "string", "days": [{ "name": "string", "exercises": [{ "name": "string", "sets": number, "reps": "string", "rest": "string", "weight": "string" }] }] }
Considere o perfil completo do usuário. Responda APENAS com o JSON, sem texto adicional.`;
      userPrompt = `Crie um plano de treino semanal personalizado para este perfil:\n${profileContext}`;
    } else if (type === "meal") {
      systemPrompt = `Você é um nutricionista profissional. Crie um plano alimentar personalizado em JSON.
O JSON deve ter o formato: { "title": "string", "meals": [{ "name": "string", "time": "string", "items": ["string"], "calories": number }], "shopping_list": ["string"], "total_calories": number, "estimated_cost": number }
Respeite todas as restrições alimentares, alergias e orçamento. Responda APENAS com o JSON, sem texto adicional.`;
      userPrompt = `Crie um plano alimentar diário personalizado para este perfil:\n${profileContext}`;
    } else {
      throw new Error("Tipo inválido. Use 'workout' ou 'meal'.");
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições. Tente novamente em breve." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro na IA");
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let parsed: any;
    try {
      // Try to extract JSON from markdown code blocks or raw
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      parsed = { raw_text: content };
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (type === "workout") {
      // Deactivate previous plans
      await adminClient.from("fit_workout_plans").update({ active: false }).eq("user_id", userId);
      // Insert new plan
      await adminClient.from("fit_workout_plans").insert({
        user_id: userId,
        title: parsed.title || "Plano de Treino IA",
        source: "ai",
        plan_data: parsed,
        active: true,
      });
    } else {
      await adminClient.from("fit_meal_plans").update({ active: false }).eq("user_id", userId);
      await adminClient.from("fit_meal_plans").insert({
        user_id: userId,
        title: parsed.title || "Plano Alimentar IA",
        source: "ai",
        plan_data: parsed,
        shopping_list: parsed.shopping_list || [],
        active: true,
      });
    }

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fit-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
