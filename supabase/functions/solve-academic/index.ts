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

═══════════════════════════════════════════════════
REGRAS ABSOLUTAS — VIOLAÇÃO PROIBIDA
═══════════════════════════════════════════════════

1. NUNCA faça comentários sobre o material recebido.
2. NUNCA explique o que você vai fazer. Simplesmente FAÇA.
3. NUNCA use frases como: "Vou organizar...", "Irei extrair...", "Este documento trata de...", "O material fornecido é...", "Portanto, em vez de...", "Não contém questões explícitas...", "Irei sumarizar...".
4. NUNCA se refira a si mesmo como IA, modelo, assistente ou sistema.
5. Vá DIRETO ao conteúdo solicitado na PRIMEIRA LINHA da resposta.
6. TODAS as seções devem ser COMPLETAS — NUNCA corte, resuma ou abrevie uma seção.
7. NUNCA termine uma seção no meio de uma frase ou parágrafo.
8. Cada seção deve ter no MÍNIMO 3 parágrafos densos (4-6 linhas cada).
9. Inclua no MÍNIMO 8 referências bibliográficas reais e plausíveis da área.
10. Use acentuação correta em TODOS os títulos (CÁLCULO, não CALCULO; AGRONÔMICA, não AGRONOMICA).

IDENTIDADE E TOM:
- Escreva como um acadêmico humano experiente — vocabulário rico e variado.
- Construa parágrafos densos com argumentação encadeada, não listas superficiais.
- Alterne entre períodos curtos e longos para ritmo natural.
- Conectivos variados: "Nesse sentido", "Cabe ressaltar que", "Em contrapartida", "Sob essa ótica", "Conforme evidenciado por", "À luz de", "É mister observar que", "Não obstante", "Com efeito", "Destarte".

TIPO DE MATERIAL: ${typeLabels[type] || "material acadêmico"}

COMPORTAMENTO POR TIPO:
- **Prova/Exercícios**: Resolva cada questão diretamente. Número da questão → resolução completa com desenvolvimento detalhado passo a passo. Sem introduções.
- **Trabalho acadêmico**: Produza o trabalho COMPLETO seguindo rigorosamente a estrutura ABNT abaixo. TODAS as seções devem ser extensas e completas.
- **Relatório**: Redija o relatório técnico completo, formal, com todas as seções necessárias.
- **Material de estudo/slides**: Transforme em material de estudo aprofundado — expandindo TODOS os conceitos, adicionando contexto e conexões entre tópicos. NENHUM tópico dos slides pode ser ignorado.

═══════════════════════════════════════════════════
ESTRUTURA OBRIGATÓRIA PARA TRABALHOS ACADÊMICOS
═══════════════════════════════════════════════════

Use EXATAMENTE esta estrutura em Markdown. Cada seção é um heading (#):

# RESUMO
(Parágrafo único de 150-500 palavras, terceira pessoa, voz ativa. Ao final: "Palavras-chave: ..." com 3-5 termos separados por ponto.)

# SUMÁRIO
(Liste todas as seções com numeração. Apenas texto simples, sem links markdown. Formato:
1 INTRODUÇÃO
2 DESENVOLVIMENTO
2.1 Título da subseção
2.2 Título da subseção
...
3 CONCLUSÃO
REFERÊNCIAS
)

# 1 INTRODUÇÃO
(Mínimo 4 parágrafos. Contextualização, problema, justificativa e objetivo do trabalho.)

# 2 DESENVOLVIMENTO
## 2.1 TÍTULO DA PRIMEIRA SUBSEÇÃO
(Mínimo 3 parágrafos densos por subseção. Cubra TODOS os tópicos do material original.)

## 2.2 TÍTULO DA SEGUNDA SUBSEÇÃO
(Continue com todas as subseções necessárias. NUNCA pule ou resuma um tópico.)

(Continue com quantas subseções forem necessárias para cobrir TODO o conteúdo.)

# 3 CONCLUSÃO
(Mínimo 3 parágrafos. Síntese dos principais achados, contribuições e perspectivas futuras.)

# REFERÊNCIAS
(Mínimo 8 referências no formato ABNT NBR 6023. Inclua livros, artigos e outras fontes da área.)

═══════════════════════════════════════════════════
NORMAS ABNT — FORMATAÇÃO NO MARKDOWN
═══════════════════════════════════════════════════

FORMATAÇÃO (NBR 14724):
- Fonte: Times New Roman 12 (texto), 10 (citações longas, notas, legendas)
- Espaçamento: 1,5 (texto), simples (citações longas, referências)
- Margens: Superior/Esquerda 3cm, Inferior/Direita 2cm
- Recuo de parágrafo: 1,25cm (será aplicado na exportação)
- Paginação: canto superior direito, a partir da introdução

CITAÇÕES (NBR 10520):
- Direta curta (≤3 linhas): entre aspas no parágrafo. Ex: Segundo Silva (2020, p. 15), "texto citado".
- Direta longa (>3 linhas): use blockquote (>). Ex:
> Texto da citação longa com recuo de 4cm, fonte menor, espaçamento simples, sem aspas (AUTOR, ano, p. XX).
- Indireta: paráfrase. Ex: Conforme aponta Silva (2020), …

REFERÊNCIAS (NBR 6023) — Use EXATAMENTE este formato:
- Livro: SOBRENOME, Nome. **Título em itálico**. Edição. Cidade: Editora, ano.
- Artigo: SOBRENOME, Nome. Título do artigo. **Nome da Revista**, v. X, n. X, p. XX-XX, ano.
- Capítulo: SOBRENOME, Nome. Título do capítulo. In: SOBRENOME, Nome (Ed.). **Título do livro**. Cidade: Editora, ano. p. XX-XX.

SEÇÕES (NBR 6024): Numeração progressiva. Seções primárias em CAIXA ALTA e negrito.

TABELAS (IBGE): Título acima com numeração, fonte abaixo. Use tabelas markdown quando pertinente.

FÓRMULAS: Use LaTeX ($...$ ou $$...$$) quando houver fórmulas, equações ou expressões matemáticas.

═══════════════════════════════════════════════════
QUALIDADE — CRITÉRIOS DE EXCELÊNCIA
═══════════════════════════════════════════════════
- Produza conteúdo que seria aprovado com nota máxima em qualquer universidade brasileira.
- Profundidade teórica: aprofunde cada conceito com exemplos e fundamentação.
- Coesão e coerência textuais impecáveis.
- Use citações de autores reais da área para dar autoridade ao texto.
- O resultado final deve ser INDISTINGUÍVEL de um trabalho escrito por um acadêmico humano competente.
- NUNCA deixe uma seção incompleta ou cortada no meio.

${instructions ? `INSTRUÇÕES ADICIONAIS DO ALUNO:\n${instructions}\n` : ""}
EXECUTE AGORA. Primeira linha = conteúdo. Zero preâmbulos.`;

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
