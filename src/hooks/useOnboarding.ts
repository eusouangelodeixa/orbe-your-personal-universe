import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingProgress {
  id: string;
  user_id: string;
  completed_steps: string[];
  completed: boolean;
}

const ONBOARDING_STEPS = [
  { id: "welcome", title: "Bem-vindo ao ORBE", description: "Conheça seu super-assistente pessoal" },
  { id: "finance", title: "Finanças", description: "Configure sua primeira carteira e renda" },
  { id: "studies", title: "Estudos", description: "Cadastre suas disciplinas e agenda" },
  { id: "fit", title: "Fitness", description: "Complete o perfil fitness" },
  { id: "whatsapp", title: "WhatsApp", description: "Conecte o bot do WhatsApp" },
  { id: "profile", title: "Perfil", description: "Personalize seu perfil" },
];

export { ONBOARDING_STEPS };

export function useOnboarding() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["onboarding", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_progress" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as OnboardingProgress | null;
    },
  });
}

export function useCompleteOnboardingStep() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (stepId: string) => {
      const { data: existing } = await supabase
        .from("onboarding_progress" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      const currentSteps: string[] = (existing as any)?.completed_steps || [];
      if (currentSteps.includes(stepId)) return;

      const newSteps = [...currentSteps, stepId];
      const allDone = ONBOARDING_STEPS.every(s => newSteps.includes(s.id));

      if (existing) {
        const { error } = await supabase.from("onboarding_progress" as any)
          .update({ completed_steps: newSteps, completed: allDone } as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("onboarding_progress" as any)
          .insert({ user_id: user!.id, completed_steps: newSteps, completed: allDone } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });
}

export function useSkipOnboarding() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const allStepIds = ONBOARDING_STEPS.map(s => s.id);
      const { data: existing } = await supabase
        .from("onboarding_progress" as any)
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("onboarding_progress" as any)
          .update({ completed_steps: allStepIds, completed: true } as any)
          .eq("id", (existing as any).id);
      } else {
        await supabase.from("onboarding_progress" as any)
          .insert({ user_id: user!.id, completed_steps: allStepIds, completed: true } as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });
}
