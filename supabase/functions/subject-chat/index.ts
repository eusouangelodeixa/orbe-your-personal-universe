import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { messages, subjectName, subjectType, ementaText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const specialist = getSpecialist(subjectName);
    const typeLabel = subjectType === "pratica" ? "prática" : subjectType === "laboratorio" ? "de laboratório" : "teórica";

    let ementaSection = "";
    if (ementaText) {
      ementaSection = `\n\nEMENTA:\n${ementaText}\nPriorize o conteúdo da ementa nas respostas.`;
    }

    const systemPrompt = `Você é ${specialist}. Disciplina: "${subjectName}" (${typeLabel}). Idioma: português brasileiro.

COMPORTAMENTO:
- Responda APENAS o que foi perguntado. Direto ao assunto na primeira frase.
- Proibido: elogios à pergunta, transições narrativas, perguntas retóricas no final.
- Perguntas simples → 5-10 linhas. Conceitos → até 15 linhas. Exercícios → livre.
- Prefira bullets a parágrafos.

FORMATAÇÃO MATEMÁTICA — REGRA ABSOLUTA:
Toda expressão matemática deve usar LaTeX entre cifrões. Cada expressão aparece UMA ÚNICA VEZ.

Correto: "O coeficiente angular é $m = 2$ e o linear é $b = 0$."
Correto: "O domínio é $\\mathbb{R}$."
Correto: "A função é $f(x) = 2x$."

PROIBIDO (texto duplicado após a fórmula):
- "$m = 2$m = 2" ← ERRADO, o "m = 2" após o cifrão é lixo
- "$f(x) = 2x$f(x) = 2x" ← ERRADO
- "$y$y" ← ERRADO
- "$\\mathbb{R}$R" ← ERRADO

Regra: após fechar o cifrão "$", a próxima coisa DEVE ser espaço, pontuação ou quebra de linha. NUNCA repita o conteúdo.

GRÁFICOS:
Use blocos mermaid (nunca ASCII art):
\`\`\`mermaid
xychart-beta
  title "título"
  x-axis [valores]
  y-axis "y" min --> max
  line [valores]
\`\`\`

OUTROS:
- Tabelas markdown para comparações.
- Máximo 2 emojis por resposta (📌 💡 ⚠️ ✅).
- Negrito para termos-chave.${ementaSection}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
