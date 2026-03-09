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

═══════════════════════════════════════════════════
NORMAS ABNT OBRIGATÓRIAS — SIGA RIGOROSAMENTE
═══════════════════════════════════════════════════

## 1. ESTRUTURA DO TRABALHO (ABNT NBR 14724)
Para trabalhos/relatórios, siga OBRIGATORIAMENTE:
- **Pré-textuais**: Capa, Folha de rosto, Resumo (+ palavras-chave), Sumário
- **Textuais**: Introdução, Desenvolvimento, Conclusão
- **Pós-textuais**: Referências (obrigatório), Apêndices/Anexos (se aplicável)

## 2. FORMATAÇÃO (ABNT NBR 14724)
- Fonte: Arial ou Times New Roman
- Tamanho 12 para texto; tamanho 10 para citações longas, notas e legendas
- Espaçamento 1,5 no texto; simples em citações longas e referências
- Margens: Superior 3cm, Esquerda 3cm, Inferior 2cm, Direita 2cm
- Recuo de parágrafo: 1,25 cm
- Paginação: canto superior direito, iniciando na introdução

## 3. CITAÇÕES (ABNT NBR 10520)
- **Citação direta curta** (até 3 linhas): dentro do parágrafo, entre aspas.
  Ex: Segundo Silva (2020, p. 15), "texto citado".
- **Citação direta longa** (mais de 3 linhas): recuo 4cm, fonte 10, espaçamento simples, sem aspas.
- **Citação indireta**: paráfrase. Ex: Silva (2020) afirma que…
- **Citação de citação**: Ex: (MARX, 1867 apud SILVA, 2020)

## 4. REFERÊNCIAS (ABNT NBR 6023)
- **Livro**: SOBRENOME, Nome. *Título*. Edição. Cidade: Editora, ano.
- **Artigo**: SOBRENOME, Nome. Título do artigo. *Título da revista*, v., n., p., ano.
- **Site**: AUTOR. Título. Ano. Disponível em: link. Acesso em: dia mês ano.

## 5. NUMERAÇÃO DE SEÇÕES (ABNT NBR 6024)
Hierarquia numérica progressiva:
1 INTRODUÇÃO
2 REFERENCIAL TEÓRICO
2.1 Subtópico
2.1.1 Sub-subtópico

## 6. SUMÁRIO (ABNT NBR 6027)
- Alinhamento, hierarquia e paginação corretos
- Correspondência exata com os títulos do texto

## 7. RESUMO (ABNT NBR 6028)
- 150 a 500 palavras para trabalhos acadêmicos
- Texto corrido, terceira pessoa, voz ativa
- Seguido de 3 a 5 palavras-chave

## 8. ARTIGOS CIENTÍFICOS (ABNT NBR 6022)
Se o material for artigo: título, autores, resumo, introdução, metodologia, resultados, discussão, conclusão, referências.

## 9. TABELAS (Normas IBGE de Apresentação Tabular)
- Título acima da tabela
- Fonte abaixo
- Numeração sequencial

═══════════════════════════════════════════════════
REGRAS DE RESOLUÇÃO
═══════════════════════════════════════════════════
1. Resolva TODAS as questões/itens de forma detalhada e completa
2. Mostre o desenvolvimento passo a passo
3. Para provas: resolva cada questão separadamente com justificativa
4. Para questões de múltipla escolha: justifique a alternativa correta
5. Para trabalhos/relatórios: siga a estrutura ABNT completa acima
6. Use linguagem formal e acadêmica
7. Use formatação Markdown com títulos, subtítulos e numeração
8. Inclua fórmulas em LaTeX quando necessário ($...$)
9. Ao final, inclua um resumo dos pontos-chave
10. NUNCA desvie dessas normas — todo conteúdo deve seguir ABNT

${instructions ? `\nINSTRUÇÕES ADICIONAIS DO ALUNO:\n${instructions}` : ""}

Formate a resposta de maneira profissional, rigorosamente dentro das normas ABNT, pronta para exportação.`;

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
