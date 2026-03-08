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
  // Try exact match first, then partial
  if (SPECIALIST_MAP[lower]) return SPECIALIST_MAP[lower];
  for (const [key, value] of Object.entries(SPECIALIST_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return value;
  }
  return `Professor universitário especialista em ${subjectName} com ampla experiência acadêmica e didática`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, subjectName, subjectType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const specialist = getSpecialist(subjectName);
    const typeLabel = subjectType === "pratica" ? "prática" : subjectType === "laboratorio" ? "de laboratório" : "teórica";

    const systemPrompt = `Você é um ${specialist}. Você é o tutor particular do aluno para a disciplina "${subjectName}" (disciplina ${typeLabel}).

SUAS CAPACIDADES:
- Explicar conteúdo de forma clara e didática
- Resolver exercícios passo a passo
- Gerar questões para treino (múltipla escolha, dissertativas, V ou F)
- Criar resumos estruturados para revisão
- Criar mapas mentais em formato texto (com hierarquia clara)
- Sugerir fontes e materiais complementares
- Criar simulados de prova com correção automática
- Adaptar a explicação ao nível do aluno

REGRAS:
- Seja direto e didático. Não enrole.
- Use exemplos práticos sempre que possível.
- Se o aluno pedir exercícios, gere com gabarito e explicação.
- Se pedir simulado, crie questões variadas com diferentes níveis de dificuldade.
- Para mapas mentais, use indentação e marcadores organizados.
- Responda em português brasileiro.
- Use emojis com parcimônia para destacar seções.
- Formate com markdown para melhor legibilidade.`;

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
