import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, subjectName, type, instructions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const typeLabels: Record<string, string> = {
      prova: "prova/exame",
      trabalho: "trabalho acadêmico",
      relatorio: "relatório",
      exercicio: "lista de exercícios",
    };

    const systemPrompt = `Você é um professor especialista em ${subjectName || "diversas áreas"} no contexto acadêmico brasileiro.

Sua tarefa é RESOLVER completamente o material acadêmico enviado pelo aluno (${typeLabels[type] || "material acadêmico"}).

REGRAS OBRIGATÓRIAS:
1. Resolva TODAS as questões/itens de forma detalhada e completa
2. Mostre o desenvolvimento passo a passo de cada resolução
3. Siga as normas acadêmicas brasileiras (ABNT quando aplicável)
4. Use formatação Markdown clara com títulos, subtítulos e numeração
5. Para trabalhos/relatórios: siga a estrutura ABNT (capa, introdução, desenvolvimento, conclusão, referências)
6. Para provas: resolva cada questão separadamente com justificativa
7. Para relatórios: use linguagem formal e acadêmica
8. Inclua fórmulas em LaTeX quando necessário ($...$)
9. Se houver questões de múltipla escolha, justifique a alternativa correta
10. Ao final, inclua um resumo dos pontos-chave

${instructions ? `\nINSTRUÇÕES ADICIONAIS DO ALUNO:\n${instructions}` : ""}

Formate a resposta de maneira profissional e bem estruturada, pronta para exportação.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Resolva o seguinte material:\n\n${content}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), {
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
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("solve-academic error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
