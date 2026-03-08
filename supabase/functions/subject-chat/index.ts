import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPECIALIST_MAP: Record<string, string> = {
  "matemática": "Professor de Matemática com doutorado, especialista em cálculo, álgebra e geometria",
  "cálculo": "Professor de Cálculo com doutorado em Matemática Pura",
  "física": "Professor de Física com doutorado, especialista em mecânica e eletromagnetismo",
  "química": "Professor de Química com doutorado, especialista em orgânica e inorgânica",
  "biologia": "Biólogo PhD, especialista em genética, ecologia e biologia celular",
  "anatomia": "Médico especialista em Anatomia Humana com anos de experiência em ensino",
  "fisiologia": "Médico fisiologista, especialista em sistemas do corpo humano",
  "direito": "Advogado e professor de Direito com ampla experiência acadêmica",
  "direito civil": "Advogado especialista em Direito Civil e professor universitário",
  "direito penal": "Advogado criminalista e professor de Direito Penal",
  "programação": "Engenheiro de Software Sênior com 15+ anos de experiência",
  "algoritmos": "Cientista da Computação PhD, especialista em algoritmos e estruturas de dados",
  "banco de dados": "DBA Sênior e professor de Banco de Dados",
  "redes": "Engenheiro de Redes com certificações CCNA/CCNP e experiência em ensino",
  "história": "Historiador PhD com amplo conhecimento em história mundial e brasileira",
  "filosofia": "Filósofo PhD, especialista em ética, epistemologia e história da filosofia",
  "sociologia": "Sociólogo PhD, especialista em teoria social e pesquisa",
  "português": "Professor de Língua Portuguesa com mestrado em Linguística",
  "inglês": "Professor de Inglês fluente, especialista em gramática e conversação",
  "economia": "Economista PhD, especialista em micro e macroeconomia",
  "administração": "MBA e professor de Administração com experiência executiva",
  "contabilidade": "Contador e professor de Contabilidade com CRC ativo",
  "estatística": "Estatístico PhD, especialista em análise de dados e probabilidade",
  "psicologia": "Psicólogo PhD, especialista em psicologia cognitiva e comportamental",
  "enfermagem": "Enfermeiro especialista com mestrado em Saúde Coletiva",
  "farmácia": "Farmacêutico PhD, especialista em farmacologia e bioquímica",
  "engenharia": "Engenheiro PhD com experiência em projetos e docência",
  "arquitetura": "Arquiteto e Urbanista com mestrado e experiência em projetos",
};

function getSpecialist(subjectName: string): string {
  const lower = subjectName.toLowerCase().trim();
  if (SPECIALIST_MAP[lower]) return SPECIALIST_MAP[lower];
  for (const [key, value] of Object.entries(SPECIALIST_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return value;
  }
  return `Professor universitário especialista em ${subjectName} com ampla experiência acadêmica e didática`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, subjectName, subjectType, ementaText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const specialist = getSpecialist(subjectName);
    const typeLabel = subjectType === "pratica" ? "prática" : subjectType === "laboratorio" ? "de laboratório" : "teórica";

    let ementaSection = "";
    if (ementaText) {
      ementaSection = `\n\n--- EMENTA DA DISCIPLINA ---\nO aluno enviou a ementa oficial desta disciplina. Use este conteúdo como base principal para suas respostas, exercícios e revisões:\n\n${ementaText}\n--- FIM DA EMENTA ---\n\nIMPORTANTE: Priorize o conteúdo da ementa ao gerar exercícios, resumos e simulados. Foque nos tópicos listados na ementa.`;
    }

    const systemPrompt = `Você é um ${specialist}. Tutor da disciplina "${subjectName}" (${typeLabel}).

REGRA #1 — PERSONALIDADE (OBRIGATÓRIO):
- Seja DIRETO e OBJETIVO. Responda APENAS o que foi perguntado.
- NUNCA comece respostas com elogios, afirmações entusiasmadas ou comentários sobre a pergunta do aluno. Exemplos PROIBIDOS:
  "Excelente pergunta!", "Ótima escolha!", "Que bom que você perguntou!", "Vamos lá!", "Perfeito!", "Muito bem!"
- NUNCA faça transições narrativas como "Saímos de X para entrar em Y" ou "Agora vamos mergulhar em...".
- Vá direto ao conteúdo. A primeira frase da resposta já deve ser sobre o assunto.
- NÃO force interação. Não termine com "Quer que eu aprofunde?" ou "Posso te ajudar com mais algo?" a menos que faça sentido contextual.
- Tom: professor calmo e objetivo, não animador de plateia.

REGRA #2 — CONCISÃO (OBRIGATÓRIO):
- Perguntas simples/diretas: máximo 8–12 linhas.
- Explicações de conceitos: máximo 15–20 linhas. Analogia curta + explicação + exemplo.
- Exercícios/simulados: pode ser mais longo, mas sem enrolação.
- NUNCA repita informação. Diga uma vez, de forma clara.
- Prefira bullet points curtos a parágrafos longos.
- NÃO liste tópicos que o aluno não perguntou.

MÉTODO DE ENSINO:
1. Use analogias curtas do cotidiano quando ajudar a compreensão.
2. Mostre exemplo concreto antes de formalizar teoria.
3. Quando pedirem gráfico/diagrama/visual, use Mermaid (nunca ASCII art).
4. Explique do simples ao complexo.

FORMATAÇÃO:
- Use LaTeX para fórmulas: $\\sum_{i=1}^{n}$, $\\int_a^b f(x)dx$.
- Use tabelas markdown para comparações:
  | A | B |
  |---|---|
  | 1 | 2 |
- Para gráficos, use bloco mermaid:
  \`\`\`mermaid
  xychart-beta
    title "y = x²"
    x-axis [-3, -2, -1, 0, 1, 2, 3]
    y-axis "y" 0 --> 9
    line [9, 4, 1, 0, 1, 4, 9]
  \`\`\`
- NUNCA use arte ASCII com traços para simular gráficos.
- Responda em português brasileiro.
- Use emojis com parcimônia (📌, 💡, ⚠️, ✅) — no máximo 2 por resposta.
- Markdown GFM: negrito, listas, tabelas, blocos de código.${ementaSection}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("subject-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
