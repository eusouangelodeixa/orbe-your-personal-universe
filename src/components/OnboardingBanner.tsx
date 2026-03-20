import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useOnboarding, useCompleteOnboardingStep, useSkipOnboarding, ONBOARDING_STEPS } from "@/hooks/useOnboarding";
import { useNavigate } from "react-router-dom";
import { Wallet, GraduationCap, Dumbbell, MessageSquare, UserCircle, Sparkles, X, ArrowRight, Check } from "lucide-react";

const STEP_ICONS: Record<string, typeof Wallet> = {
  welcome: Sparkles,
  finance: Wallet,
  studies: GraduationCap,
  fit: Dumbbell,
  whatsapp: MessageSquare,
  profile: UserCircle,
};

const STEP_ROUTES: Record<string, string> = {
  finance: "/planilha",
  studies: "/disciplinas",
  fit: "/fit/onboarding",
  whatsapp: "/perfil",
  profile: "/perfil",
};

export function OnboardingBanner() {
  const navigate = useNavigate();
  const { data: progress, isLoading } = useOnboarding();
  const completeStep = useCompleteOnboardingStep();
  const skipAll = useSkipOnboarding();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed) return null;
  if (progress?.completed) return null;

  const completedSteps = progress?.completed_steps || [];
  const totalSteps = ONBOARDING_STEPS.length;
  const doneCount = completedSteps.length;
  const pct = Math.round((doneCount / totalSteps) * 100);

  // Auto-complete welcome step
  if (!completedSteps.includes("welcome")) {
    completeStep.mutate("welcome");
  }

  const nextStep = ONBOARDING_STEPS.find(s => !completedSteps.includes(s.id));

  return (
    <Card className="border-primary/30 bg-primary/5 mb-6">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Bem-vindo ao ORBE!
            </h3>
            <p className="text-xs text-muted-foreground">Complete os passos para configurar seu assistente</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => skipAll.mutate()}>Pular</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDismissed(true)}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground font-medium">{doneCount}/{totalSteps}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {ONBOARDING_STEPS.map(step => {
            const done = completedSteps.includes(step.id);
            const Icon = STEP_ICONS[step.id] || Sparkles;
            const route = STEP_ROUTES[step.id];
            return (
              <Button
                key={step.id}
                variant={done ? "secondary" : "outline"}
                size="sm"
                className={`gap-1.5 text-xs h-8 ${done ? "opacity-60" : ""}`}
                onClick={() => {
                  if (!done && route) {
                    completeStep.mutate(step.id);
                    navigate(route);
                  }
                }}
                disabled={done}
              >
                {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                {step.title}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
