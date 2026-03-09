import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPECIALIST_MAP: Record<string, string> = {
  "matemática": "Professor de Matemática",
  "cálculo": "Professor de Cálculo",
  "física": "Professor de Física",
  "química": "Professor de Química",
  "biologia": "Professor de Biologia",
  "anatomia": "Professor de Anatomia",
  "fisiologia": "Professor de Fisiologia",
  "direito": "Professor de Direito",
  "direito civil": "Professor de Direito Civil",
  "direito penal": "Professor de Direito Penal",
  "programação": "Professor de Programação",
  "algoritmos": "Professor de Algoritmos",
  "banco de dados": "Professor de Banco de Dados",
  "redes": "Professor de Redes",
  "história": "Professor de História",
  "filosofia": "Professor de Filosofia",
  "sociologia": "Professor de Sociologia",
  "português": "Professor de Língua Portuguesa",
  "inglês": "Professor de Inglês",
  "economia": "Professor de Economia",
  "administração": "Professor de Administração",
  "contabilidade": "Professor de Contabilidade",
  "estatística": "Professor de Estatística",
  "psicologia": "Professor de Psicologia",
  "enfermagem": "Professor de Enfermagem",
  "farmácia": "Professor de Farmácia",
  "engenharia": "Professor de Engenharia",
  "arquitetura": "Professor de Arquitetura",
};

function getSpecialist(subjectName: string): string {
  const lower = subjectName.toLowerCase().trim();
  if (SPECIALIST_MAP[lower]) return SPECIALIST_MAP[lower];
  for (const [key, value] of Object.entries(SPECIALIST_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return value;
  }
  return `Professor de ${subjectName}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const { messages, subjectName, subjectType, ementaText } = await req.json();

    const specialist = getSpecialist(subjectName || "");
    const typeLabel =
      subjectType === "pratica" ? "prática" : subjectType === "laboratorio" ? "de laboratório" : "teórica";

    let ementaSection = "";
    if (ementaText) {
      ementaSection = `\nEMENTA:\n${ementaText}\nPriorize o conteúdo da ementa nas respostas.`;
    }

    const extraSystemPrompt = `Você é ${specialist}. Disciplina: "${subjectName}" (${typeLabel}). Idioma: português brasileiro.

COMPORTAMENTO:
- Responda APENAS o que foi perguntado. Direto ao assunto na primeira frase.
- Proibido: elogios à pergunta, transições narrativas, perguntas retóricas no final.
- Perguntas simples → 5-10 linhas. Conceitos → até 15 linhas. Exercícios → livre.
- Prefira bullets a parágrafos.

FORMATAÇÃO MATEMÁTICA — REGRA ABSOLUTA:
Toda expressão matemática deve usar LaTeX entre cifrões. Cada expressão aparece UMA ÚNICA VEZ.

Correto: "O coeficiente angular é $m = 2$ e o linear é $b = 0$."
Correto: "O domínio é $\\mathbb{R}$."

PROIBIDO (texto duplicado após a fórmula):
- "$m = 2$m = 2" ← ERRADO

GRÁFICOS (use EXATAMENTE esta sintaxe mermaid):
\`\`\`mermaid
xychart-beta
  title "y = x²"
  x-axis [-3, -2, -1, 0, 1, 2, 3]
  y-axis "y" 0 --> 9
  line [9, 4, 1, 0, 1, 4, 9]
\`\`\`
REGRAS MERMAID:
- x-axis SEMPRE usa array de valores
- y-axis usa "label" min --> max
- Cada eixo e linha DEVE estar em sua própria linha

OUTROS:
- Tabelas markdown para comparações.
- Máximo 2 emojis por resposta.
- Negrito para termos-chave.${ementaSection}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
    };
    if (authHeader) headers["Authorization"] = authHeader;

    const orchestratorUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-orchestrator`;
    const resp = await fetch(orchestratorUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        agent: "studies",
        extraSystemPrompt,
      }),
    });

    return new Response(resp.body, {
      status: resp.status,
      headers: {
        ...corsHeaders,
        "Content-Type": resp.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (e) {
    console.error("subject-chat proxy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
