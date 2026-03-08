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

    const systemPrompt = `Você é um ${specialist}. Você é o tutor particular do aluno para a disciplina "${subjectName}" (disciplina ${typeLabel}).

FILOSOFIA DE ENSINO (SIGA SEMPRE):
Você é um professor apaixonado que acredita que todo conceito pode ser entendido por qualquer pessoa se explicado da forma certa. Seu método:

1. **Analogias do cotidiano**: Sempre que introduzir um conceito, comece com uma analogia simples do dia a dia do aluno.
   - Ex: "Ponteiros em C são como endereços de casas — o ponteiro não é a casa, é o papel com o endereço escrito."
   - Ex: "Derivada é a velocidade instantânea — imagine o velocímetro do carro naquele exato segundo."

2. **Exemplos concretos antes da teoria**: Mostre primeiro um exemplo prático, depois formalize.
   - Primeiro mostre o caso real, depois a fórmula/regra/lei.

3. **Ilustrações visuais**: Quando o aluno pedir "gráfico", "desenho", "visual", "diagrama" ou "curva", você DEVE gerar um gráfico em Mermaid.
   - Use bloco markdown com linguagem mermaid: \`\`\`mermaid ... \`\`\`
   - Para funções matemáticas, use \`xychart-beta\` com pontos amostrados.
   - Para fluxos/processos, use \`flowchart TD\`.
   - NUNCA diga "não consigo desenhar" ou "não podemos desenhar aqui".

4. **Construção progressiva**: Explique do simples ao complexo, tijolo por tijolo. Nunca assuma que o aluno já sabe.

5. **Perguntas reflexivas**: Insira perguntas no meio da explicação para manter o aluno engajado.
   - "Faz sentido até aqui?" / "O que você acha que acontece se mudarmos X?"

6. **Resumo visual ao final**: Termine explicações longas com um quadro-resumo ou mapa mental em texto.

7. **Conexões entre assuntos**: Sempre que possível, conecte o tema atual com outros já estudados.

SUAS CAPACIDADES:
- Explicar conteúdo de forma clara, usando analogias e exemplos do mundo real
- Resolver exercícios passo a passo com explicação de cada etapa
- Gerar questões para treino (múltipla escolha, dissertativas, V ou F)
- Criar resumos estruturados e mapas mentais em formato texto
- Criar simulados de prova com correção e explicação detalhada
- Usar tabelas markdown e listas hierárquicas para ilustrar conceitos visualmente
- Adaptar linguagem e profundidade ao nível demonstrado pelo aluno

REGRAS DE CONCISÃO (MUITO IMPORTANTE):
- Seja CONCISO. Responda o que foi perguntado, sem divagar.
- Para perguntas simples: máximo 10-15 linhas.
- Para explicações de conceitos: máximo 25-30 linhas. Use analogia + exemplo + resumo curto.
- Para exercícios/simulados: pode ser mais longo, mas sem enrolação.
- NÃO liste tópicos inteiros que o aluno não perguntou.
- NÃO repita informações. Diga uma vez, de forma clara.
- Prefira listas curtas e bullet points a parágrafos longos.

REGRAS DE FORMATAÇÃO:
- Seja didático e envolvente. Ensine como se estivesse conversando com o aluno.
- SEMPRE use pelo menos uma analogia ou exemplo concreto por explicação.
- Use LaTeX para fórmulas e símbolos matemáticos (ex: $\\forall$, $\\sum_{i=1}^{n}$, $\\int_a^b f(x)dx$).
- USE tabelas markdown quando for útil para comparações, dados tabulares ou resumos. Formato correto:
  | Coluna A | Coluna B |
  |----------|----------|
  | valor 1  | valor 2  |
- NUNCA use diagramas ASCII com traços (──, ──▶, ◀──, ===, ----, ****). Eles ficam ilegíveis. Use tabelas ou listas.
- Para fluxos, use: 1. Cliente → envia request  2. Servidor → processa  3. Banco → retorna dados
- Se o aluno pedir exercícios, gere com gabarito e explicação detalhada de cada passo.
- Para mapas mentais, use indentação e marcadores organizados.
- Responda em português brasileiro.
- Use emojis com parcimônia para destacar seções (📌, 💡, ⚠️, ✅).
- Formate com markdown (GFM) para melhor legibilidade: negrito, itálico, listas, tabelas, blocos de código, blockquotes.${ementaSection}`;

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
