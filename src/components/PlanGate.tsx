import { useAuth, ORBE_PLANS, PlanKey, BillingPeriod } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Crown, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";

const ROUTE_ACCESS: Record<string, PlanKey[]> = {
  finance: ["basic", "student", "full", "fit"],
  studies: ["student", "full"],
  fit: ["fit", "full"],
};

const SUGGESTED_PLAN: Record<string, PlanKey> = {
  finance: "basic",
  studies: "student",
  fit: "fit",
};

const GROUP_LABELS: Record<string, string> = {
  finance: "Financeiro",
  studies: "Estudos",
  fit: "Fit",
};

interface PlanGateProps {
  children: React.ReactNode;
  group: "finance" | "studies" | "fit";
}

export function PlanGate({ children, group }: PlanGateProps) {
  const { subscription, subscriptionLoading } = useAuth();

  if (subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admin bypass — full access
  if (subscription.isAdmin) return <>{children}</>;

  // Trial — full access to everything
  if (subscription.trial && subscription.subscribed) {
    return (
      <>
        <TrialBanner trialEndsAt={subscription.trialEndsAt} />
        {children}
      </>
    );
  }

  // Paid subscription — check plan
  const allowedPlans = ROUTE_ACCESS[group];
  const hasAccess = subscription.subscribed && subscription.plan && allowedPlans.includes(subscription.plan);

  if (hasAccess) return <>{children}</>;

  return <UpgradeWall group={group} />;
}

function TrialBanner({ trialEndsAt }: { trialEndsAt: string | null }) {
  if (!trialEndsAt) return null;
  const ends = new Date(trialEndsAt);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / (1000 * 60 * 60)));
  const daysLeft = Math.ceil(hoursLeft / 24);

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-center gap-2 text-sm">
      <Clock className="h-4 w-4 text-primary" />
      <span className="text-foreground">
        Trial gratuito: <strong className="text-primary">{daysLeft > 1 ? `${daysLeft} dias` : `${hoursLeft}h`}</strong> restantes
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">Assine para não perder acesso</span>
    </div>
  );
}

function UpgradeWall({ group }: { group: string }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (planKey: PlanKey) => {
    setLoading(planKey);
    try {
      const plan = ORBE_PLANS[planKey];
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: plan.price_id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast.error("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setLoading(null);
    }
  };

  const relevantPlans = Object.entries(ORBE_PLANS).filter(([key]) =>
    ROUTE_ACCESS[group].includes(key as PlanKey)
  );
  const suggestedKey = SUGGESTED_PLAN[group];

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="h-8 w-8 text-primary" />
        </div>

        <div>
          <h2 className="text-2xl font-display tracking-wider text-foreground">
            Módulo {GROUP_LABELS[group]}
          </h2>
          <p className="text-muted-foreground mt-2">
            Seu trial expirou. Assine um plano para continuar usando.
          </p>
        </div>

        <div className="space-y-3">
          {relevantPlans.map(([key, plan]) => {
            const isRecommended = key === suggestedKey;
            return (
              <div
                key={key}
                className={`relative p-4 rounded-xl border transition-all ${
                  isRecommended ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {isRecommended && (
                  <Badge className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[10px] gap-1">
                    <Sparkles className="h-3 w-3" /> Recomendado
                  </Badge>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="font-display tracking-wider text-foreground flex items-center gap-2">
                      {key === "full" && <Crown className="h-4 w-4 text-primary" />}
                      {plan.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      R$ {plan.price}<span className="text-xs">/mês</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isRecommended ? "default" : "outline"}
                    onClick={() => handleCheckout(key as PlanKey)}
                    disabled={loading !== null}
                  >
                    {loading === key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">🔒 Garantia de 7 dias. Cancele quando quiser.</p>
      </div>
    </div>
  );
}

export function useCheckout() {
  const [loading, setLoading] = useState(false);
  const checkout = async (planKey: PlanKey) => {
    setLoading(true);
    try {
      const plan = ORBE_PLANS[planKey];
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: plan.price_id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch { toast.error("Erro ao iniciar checkout."); }
    finally { setLoading(false); }
  };
  return { checkout, loading };
}
