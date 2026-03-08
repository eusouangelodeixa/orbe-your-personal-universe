import { useAuth, ORBE_PLANS, PlanKey } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";

// Which plans grant access to which route groups
const ROUTE_ACCESS: Record<string, PlanKey[]> = {
  finance: ["basic", "student", "full", "fit"],
  studies: ["student", "full"],
  fit: ["fit", "full"],
};

// Suggested plan for each route group
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
  /** Which feature group this gate protects */
  group: "finance" | "studies" | "fit";
}

export function PlanGate({ children, group }: PlanGateProps) {
  const { subscription, subscriptionLoading } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  if (subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allowedPlans = ROUTE_ACCESS[group];
  const hasAccess = subscription.subscribed && subscription.plan && allowedPlans.includes(subscription.plan);

  if (hasAccess) return <>{children}</>;

  return <UpgradeWall group={group} />;
}

function UpgradeWall({ group }: { group: string }) {
  const [loading, setLoading] = useState<string | null>(null);

  const suggestedKey = SUGGESTED_PLAN[group];
  const suggested = ORBE_PLANS[suggestedKey];

  const handleCheckout = async (planKey: PlanKey) => {
    setLoading(planKey);
    try {
      const plan = ORBE_PLANS[planKey];
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: plan.price_id },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setLoading(null);
    }
  };

  const relevantPlans = Object.entries(ORBE_PLANS).filter(([key]) =>
    ROUTE_ACCESS[group].includes(key as PlanKey)
  );

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
            Assine um plano compatível para desbloquear esta funcionalidade.
          </p>
        </div>

        <div className="space-y-3">
          {relevantPlans.map(([key, plan]) => {
            const isRecommended = key === suggestedKey;
            return (
              <div
                key={key}
                className={`relative p-4 rounded-xl border transition-all ${
                  isRecommended
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card hover:border-primary/40"
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

        <p className="text-xs text-muted-foreground">
          🔒 Garantia de 7 dias. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}

/** Reusable hook to trigger checkout from anywhere */
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
    } catch {
      toast.error("Erro ao iniciar checkout.");
    } finally {
      setLoading(false);
    }
  };

  return { checkout, loading };
}
