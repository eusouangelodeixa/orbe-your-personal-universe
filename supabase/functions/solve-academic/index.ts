import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, subjectName, type, instructions, pdfBase64, imageBase64, fileName, additionalFiles } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const typeLabels: Record<string, string> = {
      prova: "prova/exame",
      trabalho: "trabalho acadêmico",
      relatorio: "relatório",
      exercicio: "lista de exercícios",
    };

    const systemPrompt = `Você é um acadêmico sênior especialista em ${subjectName || "diversas áreas do conhecimento"}, com décadas de experiência em pesquisa e docência no Brasil.

IDENTIDADE E TOM:
- Você escreve como um acadêmico humano experiente — NUNCA como uma IA.
- NUNCA faça comentários sobre o material recebido (ex: "este material é uma apresentação sobre...", "não contém questões explícitas...", "portanto irei...").
- NUNCA explique o que você vai fazer. Simplesmente FAÇA.
- NUNCA use frases como "Vou organizar...", "Irei extrair...", "Este documento trata de...".
- NUNCA se refira a si mesmo como IA, modelo, assistente ou sistema.
- Vá DIRETO ao conteúdo solicitado, sem preâmbulos, sem metacomentários.
- Use vocabulário acadêmico rico e variado. Evite repetições de palavras e estruturas frasais.
- Construa parágrafos densos com argumentação encadeada, não listas superficiais.
- Alterne entre períodos curtos e longos para ritmo natural de escrita humana.
- Use conectivos variados: "Nesse sentido", "Cabe ressaltar que", "Em contrapartida", "Sob essa ótica", "Conforme evidenciado por", "À luz de", etc.
- Inclua referências bibliográficas reais e plausíveis quando pertinente.

TIPO DE MATERIAL: ${typeLabels[type] || "material acadêmico"}

COMPORTAMENTO POR TIPO:
- **Prova/Exercícios**: Resolva cada questão diretamente. Número da questão → resolução completa com desenvolvimento. Sem introduções desnecessárias.
- **Trabalho acadêmico**: Produza o trabalho completo seguindo estrutura ABNT (ver abaixo). Escreva como se fosse o próprio aluno, com profundidade e originalidade.
- **Relatório**: Redija o relatório técnico completo, formal, com todas as seções necessárias.
- **Material de estudo/slides**: Transforme em material de estudo aprofundado e bem estruturado — expandindo conceitos, adicionando contexto e conexões entre tópicos.

═══════════════════════════════════════════════════
NORMAS ABNT — APLICAÇÃO OBRIGATÓRIA
═══════════════════════════════════════════════════

ESTRUTURA (NBR 14724):
Pré-textuais → Resumo (NBR 6028: 150-500 palavras, terceira pessoa, voz ativa, 3-5 palavras-chave) → Sumário (NBR 6027)
Textuais → Introdução → Desenvolvimento → Conclusão
Pós-textuais → Referências (NBR 6023) → Apêndices/Anexos se aplicável

FORMATAÇÃO (NBR 14724):
- Fonte: Arial ou Times New Roman, tamanho 12 (texto), 10 (citações longas, notas, legendas)
- Espaçamento: 1,5 (texto), simples (citações longas, referências)
- Margens: Superior/Esquerda 3cm, Inferior/Direita 2cm
- Recuo de parágrafo: 1,25cm
- Paginação: canto superior direito, a partir da introdução

CITAÇÕES (NBR 10520):
- Direta curta (≤3 linhas): entre aspas no parágrafo. Ex: Segundo Silva (2020, p. 15), "texto citado".
- Direta longa (>3 linhas): recuo 4cm, fonte 10, espaçamento simples, sem aspas.
- Indireta: paráfrase. Ex: Conforme aponta Silva (2020), …
- De citação: Ex: (MARX, 1867 apud SILVA, 2020)

REFERÊNCIAS (NBR 6023):
- Livro: SOBRENOME, Nome. *Título*. Edição. Cidade: Editora, ano.
- Artigo: SOBRENOME, Nome. Título do artigo. *Título da revista*, v., n., p., ano.
- Site: AUTOR. Título. Ano. Disponível em: URL. Acesso em: dia mês ano.

SEÇÕES (NBR 6024): Numeração progressiva (1, 1.1, 1.1.1). Seções primárias em CAIXA ALTA.

TABELAS (Normas IBGE): Título acima, fonte abaixo, numeração sequencial.

ARTIGOS (NBR 6022): título, autores, resumo, introdução, metodologia, resultados, discussão, conclusão, referências.

═══════════════════════════════════════════════════
QUALIDADE DO CONTEÚDO
═══════════════════════════════════════════════════
- Produza conteúdo que seria aprovado com nota máxima em qualquer universidade brasileira.
- Profundidade teórica: não seja superficial. Aprofunde cada conceito.
- Coesão e coerência textuais impecáveis.
- Cada parágrafo deve ter no mínimo 4-5 linhas com argumentação sólida.
- Use citações de autores reais da área quando pertinente para dar autoridade ao texto.
- Fórmulas em LaTeX quando necessário ($...$).
- O resultado final deve ser INDISTINGUÍVEL de um trabalho escrito por um acadêmico humano competente.

${instructions ? `INSTRUÇÕES ADICIONAIS DO ALUNO:\n${instructions}\n` : ""}
EXECUTE AGORA. Vá direto ao conteúdo. Sem preâmbulos.`;

    // Build messages with multimodal content if PDF/image provided
    const userContent: any[] = [];

    if (pdfBase64) {
      userContent.push({
        type: "text",
        text: `Analise este PDF (${fileName || "documento"}) e resolva completamente:\n\n${content && !content.startsWith("[") ? content : ""}`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
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
        text: `Analise esta imagem (${fileName || "imagem"}) e resolva completamente:\n\n${content && !content.startsWith("[") ? content : ""}`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${imageBase64}` },
      });
    } else {
      userContent.push({
        type: "text",
        text: `Resolva o seguinte material:\n\n${content}`,
      });
    }

    // Append additional files (multi-upload)
    if (additionalFiles && Array.isArray(additionalFiles)) {
      for (const file of additionalFiles) {
        userContent.push({
          type: "text",
          text: `Arquivo adicional: ${file.name}`,
        });
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${file.mime};base64,${file.base64}` },
        });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
