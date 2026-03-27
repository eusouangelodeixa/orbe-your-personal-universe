import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────

export interface SpiritualProfile {
  id: string;
  user_id: string;
  preferred_translation: "NVI" | "ARA" | "NTLH";
  reminder_time: string;
  reminder_channel: "whatsapp" | "push" | "email";
  spiritual_goal: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpiritualPlan {
  id: string;
  user_id: string;
  title: string;
  theme: string;
  plan_type: "intensive" | "intermediate" | "deep" | "complete";
  total_days: number;
  current_day: number;
  status: "active" | "paused" | "completed";
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface SpiritualPlanDay {
  id: string;
  plan_id: string;
  day_number: number;
  verse_reference: string;
  verse_text: string;
  explanation: string;
  reflection_questions: string[];
  practical_application: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface SpiritualLog {
  id: string;
  user_id: string;
  plan_id: string | null;
  plan_day_id: string | null;
  log_date: string;
  read_confirmed: boolean;
  reflection_notes: string | null;
  created_at: string;
}

export interface DailyVerse {
  id: string;
  user_id: string;
  verse_date: string;
  verse_reference: string;
  verse_text: string;
  explanation: string;
  application: string;
  sent_via: string | null;
  created_at: string;
}

// ─── Themes (curated) ───────────────────────────────────────────

export const SPIRITUAL_THEMES = {
  foundations: {
    label: "Fundamentos Espirituais",
    themes: [
      { key: "fe", label: "Fé", emoji: "✝️" },
      { key: "graca", label: "Graça", emoji: "🕊️" },
      { key: "salvacao", label: "Salvação", emoji: "💫" },
      { key: "arrependimento", label: "Arrependimento", emoji: "🙏" },
      { key: "espirito_santo", label: "Espírito Santo", emoji: "🔥" },
      { key: "oracao", label: "Oração", emoji: "🙏" },
      { key: "santificacao", label: "Santificação", emoji: "⭐" },
    ],
  },
  growth: {
    label: "Crescimento Espiritual",
    themes: [
      { key: "perseveranca", label: "Perseverança", emoji: "💪" },
      { key: "disciplina_espiritual", label: "Disciplina Espiritual", emoji: "📖" },
      { key: "obediencia", label: "Obediência", emoji: "🛐" },
      { key: "proposito", label: "Propósito", emoji: "🎯" },
      { key: "humildade", label: "Humildade", emoji: "🤲" },
      { key: "sabedoria", label: "Sabedoria", emoji: "📜" },
    ],
  },
  practical: {
    label: "Vida Cristã Prática",
    themes: [
      { key: "ansiedade", label: "Ansiedade", emoji: "😰" },
      { key: "medo", label: "Medo", emoji: "🛡️" },
      { key: "decisao", label: "Tomada de Decisão", emoji: "🧭" },
      { key: "relacionamentos", label: "Relacionamentos", emoji: "❤️" },
      { key: "perdao", label: "Perdão", emoji: "🕊️" },
      { key: "tentacao", label: "Tentação", emoji: "⚔️" },
    ],
  },
  leadership: {
    label: "Liderança Espiritual",
    themes: [
      { key: "chamado", label: "Chamado", emoji: "📢" },
      { key: "ministerio", label: "Ministério", emoji: "⛪" },
      { key: "servir", label: "Servir", emoji: "🤝" },
      { key: "evangelismo", label: "Evangelismo", emoji: "🌍" },
    ],
  },
};

export const PLAN_TYPES = [
  { key: "intensive", label: "Intensivo", days: 7, description: "7 dias de imersão" },
  { key: "intermediate", label: "Intermediário", days: 30, description: "30 dias de formação" },
  { key: "deep", label: "Formação Profunda", days: 90, description: "90 dias de transformação" },
  { key: "complete", label: "Formação Completa", days: 365, description: "1 ano de jornada" },
] as const;

// ─── AI-Generated Content (via agent-orchestrator) ──────────────

async function generatePlanContent(
  theme: string,
  totalDays: number,
  translation: string
): Promise<Array<Omit<SpiritualPlanDay, "id" | "plan_id" | "created_at">>> {
  // Generate first 7 days of content via IA
  const daysToGenerate = Math.min(totalDays, 7);
  const days: Array<Omit<SpiritualPlanDay, "id" | "plan_id" | "created_at">> = [];

  // Curated verse bank by theme (MVP — no external API needed)
  const VERSE_BANK: Record<string, Array<{ ref: string; text: string }>> = {
    fe: [
      { ref: "Hebreus 11:1", text: "Ora, a fé é a certeza daquilo que esperamos e a prova das coisas que não vemos." },
      { ref: "Romanos 10:17", text: "Consequentemente, a fé vem por ouvir a mensagem, e a mensagem é ouvida mediante a palavra de Cristo." },
      { ref: "Marcos 11:24", text: "Por isso, eu lhes digo: tudo o que vocês pedirem em oração, creiam que já o receberam, e assim será." },
      { ref: "Tiago 2:17", text: "Assim também a fé, por si só, se não for acompanhada de obras, está morta." },
      { ref: "2 Coríntios 5:7", text: "Porque vivemos por fé, e não pelo que vemos." },
      { ref: "Mateus 17:20", text: "Se vocês tiverem fé do tamanho de um grão de mostarda, dirão a este monte: 'Vá daqui para lá', e ele irá." },
      { ref: "Efésios 2:8-9", text: "Pois vocês são salvos pela graça, por meio da fé, e isto não vem de vocês, é dom de Deus." },
    ],
    graca: [
      { ref: "Efésios 2:8-9", text: "Pois vocês são salvos pela graça, por meio da fé, e isto não vem de vocês, é dom de Deus." },
      { ref: "2 Coríntios 12:9", text: "Mas ele me disse: 'Minha graça é suficiente para você, pois o meu poder se aperfeiçoa na fraqueza.'" },
      { ref: "Romanos 6:14", text: "Pois o pecado não os dominará, porque vocês não estão debaixo da Lei, mas debaixo da graça." },
      { ref: "Tito 2:11", text: "Porque a graça de Deus se manifestou salvadora a todos os homens." },
      { ref: "João 1:16", text: "Todos recebemos da sua plenitude, graça sobre graça." },
      { ref: "Romanos 5:20", text: "Mas onde aumentou o pecado, transbordou a graça." },
      { ref: "Hebreus 4:16", text: "Aproximemo-nos do trono da graça com toda a confiança." },
    ],
    ansiedade: [
      { ref: "Filipenses 4:6-7", text: "Não andem ansiosos por coisa alguma, mas em tudo, pela oração e súplicas, com ação de graças, apresentem seus pedidos a Deus." },
      { ref: "1 Pedro 5:7", text: "Lancem sobre ele toda a sua ansiedade, porque ele tem cuidado de vocês." },
      { ref: "Mateus 6:34", text: "Portanto, não se preocupem com o amanhã, pois o amanhã trará as suas próprias preocupações." },
      { ref: "Isaías 41:10", text: "Não tema, pois eu estou com você; não desanime, pois eu sou o seu Deus." },
      { ref: "Salmos 94:19", text: "Quando a ansiedade já me dominava no íntimo, o teu consolo trouxe alívio à minha alma." },
      { ref: "João 14:27", text: "Deixo-lhes a paz; a minha paz lhes dou. Não a dou como o mundo a dá." },
      { ref: "Salmos 55:22", text: "Lance as suas preocupações sobre o Senhor, e ele o susterá." },
    ],
    perseveranca: [
      { ref: "Gálatas 6:9", text: "Não nos cansemos de fazer o bem, pois no tempo próprio colheremos, se não desanimarmos." },
      { ref: "Tiago 1:12", text: "Feliz é o homem que persevera na provação, porque depois de aprovado receberá a coroa da vida." },
      { ref: "Romanos 5:3-4", text: "A tribulação produz perseverança; a perseverança, um caráter aprovado; e o caráter aprovado, esperança." },
      { ref: "Hebreus 12:1", text: "Corramos com perseverança a corrida que nos é proposta, tendo os olhos fitos em Jesus." },
      { ref: "Filipenses 3:14", text: "Prossigo para o alvo, a fim de ganhar o prêmio do chamado celestial de Deus em Cristo Jesus." },
      { ref: "2 Timóteo 4:7", text: "Combati o bom combate, terminei a corrida, guardei a fé." },
      { ref: "1 Coríntios 15:58", text: "Portanto, meus amados irmãos, sejam firmes e constantes, sempre abundantes na obra do Senhor." },
    ],
  };

  // Default verses for themes not in bank
  const defaultVerses = [
    { ref: "Provérbios 3:5-6", text: "Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento." },
    { ref: "Jeremias 29:11", text: "Pois eu sei os planos que tenho para vocês, planos de fazê-los prosperar e não de causar dano." },
    { ref: "Salmos 23:1", text: "O Senhor é o meu pastor; nada me faltará." },
    { ref: "Romanos 8:28", text: "Sabemos que Deus age em todas as coisas para o bem daqueles que o amam." },
    { ref: "Josué 1:9", text: "Seja forte e corajoso! Não se apavore, nem se desanime, pois o Senhor, o seu Deus, estará com você por onde você andar." },
    { ref: "Salmos 46:1", text: "Deus é o nosso refúgio e a nossa fortaleza, auxílio sempre presente na adversidade." },
    { ref: "Isaías 40:31", text: "Mas aqueles que esperam no Senhor renovam as suas forças. Voam alto como águias." },
  ];

  const verses = VERSE_BANK[theme] || defaultVerses;

  const reflectionBank = [
    "O que Deus está me ensinando com esse versículo?",
    "Como posso aplicar essa verdade na minha vida hoje?",
    "Há algo que preciso mudar na minha atitude?",
    "Como esse ensinamento se conecta com minha semana?",
    "Que decisão posso tomar baseado nessa palavra?",
  ];

  const applicationBank = [
    "Ore 5 minutos refletindo sobre essa passagem.",
    "Escolha uma situação do dia para aplicar esse princípio.",
    "Compartilhe essa reflexão com alguém hoje.",
    "Anote num diário o que Deus falou com você.",
    "Medite nessa palavra antes de dormir.",
    "Leia o capítulo completo desse versículo.",
    "Memorize o versículo principal de hoje.",
  ];

  for (let i = 0; i < daysToGenerate; i++) {
    const verse = verses[i % verses.length];
    const themeLabel = Object.values(SPIRITUAL_THEMES)
      .flatMap((g) => g.themes)
      .find((t) => t.key === theme)?.label || theme;

    days.push({
      day_number: i + 1,
      verse_reference: verse.ref,
      verse_text: verse.text,
      explanation: `Este versículo nos ensina sobre ${themeLabel.toLowerCase()}. ${verse.text.split(".")[0]}. A chave está em entender que Deus nos convida a viver essa verdade diariamente, não apenas conhecê-la intelectualmente.`,
      reflection_questions: [
        reflectionBank[i % reflectionBank.length],
        reflectionBank[(i + 2) % reflectionBank.length],
      ],
      practical_application: applicationBank[i % applicationBank.length],
      completed: false,
      completed_at: null,
    });
  }

  return days;
}

// ─── Hooks ──────────────────────────────────────────────────────

export function useSpiritualProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["spiritual_profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spiritual_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SpiritualProfile | null;
    },
  });
}

export function useSaveSpiritualProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SpiritualProfile>) => {
      const { data: existing } = await supabase
        .from("spiritual_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("spiritual_profiles")
          .update({ ...payload, updated_at: new Date().toISOString() } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("spiritual_profiles")
          .insert({ ...payload, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spiritual_profile"] });
      toast.success("📖 Perfil espiritual salvo!");
    },
    onError: () => toast.error("Erro ao salvar perfil"),
  });
}

export function useActivePlan() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["spiritual_plan_active", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spiritual_plans")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SpiritualPlan | null;
    },
  });
}

export function useCreatePlan() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ theme, planType }: { theme: string; planType: string }) => {
      const pt = PLAN_TYPES.find((p) => p.key === planType);
      if (!pt) throw new Error("Invalid plan type");

      // Get profile for translation
      const { data: profile } = await supabase
        .from("spiritual_profiles")
        .select("preferred_translation")
        .eq("user_id", user!.id)
        .maybeSingle();
      const translation = (profile as any)?.preferred_translation || "NVI";

      const themeLabel = Object.values(SPIRITUAL_THEMES)
        .flatMap((g) => g.themes)
        .find((t) => t.key === theme)?.label || theme;

      // Create plan
      const { data: plan, error: pe } = await supabase
        .from("spiritual_plans")
        .insert({
          user_id: user!.id,
          title: `${themeLabel} — ${pt.label}`,
          theme,
          plan_type: planType,
          total_days: pt.days,
          current_day: 0,
        } as any)
        .select()
        .single();
      if (pe) throw pe;

      // Generate days
      const dayContent = await generatePlanContent(theme, pt.days, translation);
      const daysData = dayContent.map((d) => ({
        ...d,
        plan_id: (plan as any).id,
      }));

      const { error: de } = await supabase
        .from("spiritual_plan_days")
        .insert(daysData as any);
      if (de) throw de;

      return plan;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spiritual_plan_active"] });
      toast.success("✝️ Plano de estudo criado!");
    },
    onError: () => toast.error("Erro ao criar plano"),
  });
}

export function usePlanDays(planId: string | null) {
  return useQuery({
    queryKey: ["spiritual_plan_days", planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spiritual_plan_days")
        .select("*")
        .eq("plan_id", planId!)
        .order("day_number");
      if (error) throw error;
      return (data as unknown as SpiritualPlanDay[]) || [];
    },
  });
}

export function useMarkDayRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dayId, planId, reflectionNotes }: { dayId: string; planId: string; reflectionNotes?: string }) => {
      // Mark day completed
      const { error: de } = await supabase
        .from("spiritual_plan_days")
        .update({ completed: true, completed_at: new Date().toISOString() } as any)
        .eq("id", dayId);
      if (de) throw de;

      // Create log
      const { error: le } = await supabase
        .from("spiritual_logs")
        .insert({
          user_id: user!.id,
          plan_id: planId,
          plan_day_id: dayId,
          log_date: format(new Date(), "yyyy-MM-dd"),
          read_confirmed: true,
          reflection_notes: reflectionNotes || null,
        } as any);
      if (le && le.code !== "23505") throw le;

      // Update plan current_day
      const { data: day } = await supabase
        .from("spiritual_plan_days")
        .select("day_number")
        .eq("id", dayId)
        .single();
      if (day) {
        await supabase
          .from("spiritual_plans")
          .update({ current_day: (day as any).day_number } as any)
          .eq("id", planId);

        // Check if plan is complete
        const { data: plan } = await supabase
          .from("spiritual_plans")
          .select("total_days")
          .eq("id", planId)
          .single();
        if (plan && (day as any).day_number >= (plan as any).total_days) {
          await supabase
            .from("spiritual_plans")
            .update({ status: "completed", completed_at: new Date().toISOString() } as any)
            .eq("id", planId);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spiritual_plan_days"] });
      qc.invalidateQueries({ queryKey: ["spiritual_plan_active"] });
      qc.invalidateQueries({ queryKey: ["spiritual_streak"] });
      toast.success("📖 Leitura registrada! Deus te abençoe.");
    },
    onError: () => toast.error("Erro ao registrar leitura"),
  });
}

export function useSpiritualStreak() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["spiritual_streak", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from("spiritual_logs")
        .select("log_date")
        .eq("user_id", user!.id)
        .order("log_date", { ascending: false })
        .limit(365);
      if (error) throw error;

      const typedLogs = (logs as unknown as Array<{ log_date: string }>) || [];
      if (!typedLogs.length) return { currentStreak: 0, bestStreak: 0, totalDays: 0 };

      // Current streak
      let currentStreak = 0;
      const today = format(new Date(), "yyyy-MM-dd");
      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
      let expected = typedLogs[0].log_date === today ? today : typedLogs[0].log_date === yesterday ? yesterday : null;

      if (expected) {
        for (const l of typedLogs) {
          if (l.log_date === expected) {
            currentStreak++;
            const prev = new Date(expected);
            prev.setDate(prev.getDate() - 1);
            expected = format(prev, "yyyy-MM-dd");
          } else break;
        }
      }

      // Best streak
      let bestStreak = 0;
      let tempStreak = 1;
      const sorted = [...typedLogs].sort((a, b) => a.log_date.localeCompare(b.log_date));
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].log_date);
        const curr = new Date(sorted[i].log_date);
        const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          tempStreak++;
        } else {
          bestStreak = Math.max(bestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      bestStreak = Math.max(bestStreak, tempStreak);

      return { currentStreak, bestStreak, totalDays: typedLogs.length };
    },
  });
}

export function useSpiritualProgress() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["spiritual_progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: plans, error } = await supabase
        .from("spiritual_plans")
        .select("id, theme, status, total_days, current_day")
        .eq("user_id", user!.id)
        .order("started_at", { ascending: false });
      if (error) throw error;
      const typedPlans = (plans as unknown as SpiritualPlan[]) || [];
      const completed = typedPlans.filter((p) => p.status === "completed").length;
      const themesStudied = [...new Set(typedPlans.map((p) => p.theme))];
      return { total: typedPlans.length, completed, themesStudied };
    },
  });
}

export function useTodayVerse() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["spiritual_daily_verse", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spiritual_daily_verses")
        .select("*")
        .eq("user_id", user!.id)
        .eq("verse_date", today)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DailyVerse | null;
    },
  });
}

export function useGenerateDailyVerse() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");

      // Simple daily rotation from curated list
      const DAILY_VERSES = [
        { ref: "Provérbios 3:5-6", text: "Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento; reconheça o Senhor em todos os seus caminhos, e ele endireitará as suas veredas.", explanation: "Confiança verdadeira acontece quando você para de depender apenas da sua própria lógica.", application: "Hoje, entregue uma preocupação específica a Deus." },
        { ref: "Salmos 23:1-3", text: "O Senhor é o meu pastor; nada me faltará. Em verdes pastagens me faz repousar e me conduz a águas tranquilas; restaura-me o vigor.", explanation: "Deus cuida de cada área da sua vida — emocional, física e espiritual.", application: "Reserve 5 minutos para estar em silêncio na presença de Deus." },
        { ref: "Isaías 40:31", text: "Mas aqueles que esperam no Senhor renovam as suas forças. Voam alto como águias; correm e não ficam exaustos, andam e não se cansam.", explanation: "Esperar em Deus não é passividade — é preparação para voo.", application: "Antes de cada tarefa difícil hoje, ore brevemente pedindo forças." },
        { ref: "Filipenses 4:13", text: "Tudo posso naquele que me fortalece.", explanation: "Paulo escreveu isso na prisão. A força vem de Cristo, não das circunstâncias.", application: "Enfrente um desafio que você tem adiado, confiando nessa promessa." },
        { ref: "Romanos 8:28", text: "Sabemos que Deus age em todas as coisas para o bem daqueles que o amam, dos que foram chamados de acordo com o seu propósito.", explanation: "Nem tudo é bom, mas Deus transforma tudo para o bem.", application: "Relembre uma dificuldade passada e agradeça pelo que aprendeu." },
        { ref: "Josué 1:9", text: "Não fui eu que lhe ordenei? Seja forte e corajoso! Não se apavore, nem se desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.", explanation: "Coragem não é ausência de medo — é agir mesmo com medo, sabendo que Deus está presente.", application: "Tome uma atitude corajosa hoje, mesmo que pequena." },
        { ref: "Jeremias 29:11", text: "Pois eu sei os planos que tenho para vocês, diz o Senhor, planos de fazê-los prosperar e não de causar dano, planos de dar-lhes esperança e um futuro.", explanation: "Os planos de Deus são maiores que os nossos. Mesmo quando não entendemos o presente, o futuro está no controle dEle.", application: "Escreva uma oração entregando seus planos a Deus." },
      ];

      const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const verse = DAILY_VERSES[dayOfYear % DAILY_VERSES.length];

      const { error } = await supabase
        .from("spiritual_daily_verses")
        .insert({
          user_id: user!.id,
          verse_date: today,
          verse_reference: verse.ref,
          verse_text: verse.text,
          explanation: verse.explanation,
          application: verse.application,
          sent_via: "panel",
        } as any);
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spiritual_daily_verse"] });
      toast.success("🙏 Versículo do dia gerado!");
    },
  });
}

export function useDeleteSpiritualProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("spiritual_profiles").delete().eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spiritual_profile"] });
      toast.success("Plano espiritual excluído!");
    },
    onError: () => toast.error("Erro ao excluir plano"),
  });
}
