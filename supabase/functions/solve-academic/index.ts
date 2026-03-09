import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, subjectName, type, instructions, pdfBase64, imageBase64, fileName } = await req.json();
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

    // Build messages with multimodal content if PDF/image provided
    const userContent: any[] = [];

    if (pdfBase64) {
      userContent.push({
        type: "text",
        text: `Extraia todo o conteúdo deste PDF (${fileName || "documento"}) e resolva completamente todas as questões/itens encontrados:\n\n${content && !content.startsWith("[") ? content : ""}`,
      });
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:application/pdf;base64,${pdfBase64}`,
        },
      });
    } else if (imageBase64) {
      const ext = (fileName || "").split(".").pop()?.toLowerCase() || "png";
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
      };
      const mime = mimeMap[ext] || "image/png";
      userContent.push({
        type: "text",
        text: `Extraia todo o conteúdo desta imagem (${fileName || "imagem"}) e resolva completamente todas as questões/itens encontrados:\n\n${content && !content.startsWith("[") ? content : ""}`,
      });
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${mime};base64,${imageBase64}`,
        },
      });
    } else {
      userContent.push({
        type: "text",
        text: `Resolva o seguinte material:\n\n${content}`,
      });
    }

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
          { role: "user", content: userContent },
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
