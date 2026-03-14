import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type BillingPeriod = "mensal" | "trimestral" | "anual";

export const ORBE_PLANS = {
  basic: {
    product_ids: ["prod_U73CrhAJW5hnAY", "prod_U7GZLZmtQEs6nC"],
    name: "Basic",
    prices: {
      mensal:     { price_id: "price_1T8p6B4tVPtm5YNwmqviEphn", amount: 19 },
      trimestral: { price_id: "price_1T925D4tVPtm5YNwovJCBB5I", amount: 48 },
      anual:      { price_id: "price_1T922Y4tVPtm5YNwXh4TxBoX", amount: 156 },
    },
  },
  student: {
    product_ids: ["prod_U73CVnib4ajQ4N", "prod_U7GaODnTewAWGr"],
    name: "Student",
    prices: {
      mensal:     { price_id: "price_1T8p6Y4tVPtm5YNwADcxhwGk", amount: 29 },
      trimestral: { price_id: "price_1T925D4tVPtm5YNwPVVvO2lP", amount: 72 },
      anual:      { price_id: "price_1T923H4tVPtm5YNwWTw2CCIN", amount: 228 },
    },
  },
  full: {
    product_ids: ["prod_U73DsZWuSfdT22", "prod_U7Gaazxt8yszR9"],
    name: "Full",
    prices: {
      mensal:     { price_id: "price_1T8p6t4tVPtm5YNwmi0BmeaK", amount: 44 },
      trimestral: { price_id: "price_1T925D4tVPtm5YNwvNJZ23i7", amount: 111 },
      anual:      { price_id: "price_1T923o4tVPtm5YNwDqUHYuBJ", amount: 348 },
    },
  },
  fit: {
    product_ids: ["prod_U73DxXtdvzBmJe", "prod_U7GbYmSLchwfz8"],
    name: "Fit Only",
    prices: {
      mensal:     { price_id: "price_1T8p7J4tVPtm5YNwryI6eC3Y", amount: 24 },
      trimestral: { price_id: "price_1T925D4tVPtm5YNwPlIrZ69H", amount: 60 },
      anual:      { price_id: "price_1T924S4tVPtm5YNwoMxSFbWE", amount: 192 },
    },
  },
} as const;

export type PlanKey = keyof typeof ORBE_PLANS;

interface SubscriptionInfo {
  subscribed: boolean;
  isAdmin: boolean;
  product_id: string | null;
  plan: PlanKey | null;
  subscription_end: string | null;
  trial: boolean;
  trialEndsAt: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  subscription: SubscriptionInfo;
  subscriptionLoading: boolean;
  checkSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultSub: SubscriptionInfo = {
  subscribed: false, isAdmin: false, product_id: null, plan: null,
  subscription_end: null, trial: false, trialEndsAt: null,
};

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, loading: true,
  subscription: defaultSub, subscriptionLoading: true,
  checkSubscription: async () => {}, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function productToPlan(productId: string | null): PlanKey | null {
  if (!productId) return null;
  for (const [key, plan] of Object.entries(ORBE_PLANS)) {
    if ((plan.product_ids as readonly string[]).includes(productId)) return key as PlanKey;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(defaultSub);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) { console.error("check-subscription error:", error); return; }
      if (data) {
        // Internal providers (lojou/manual) return plan directly as string
        const isInternalProvider = data.provider === "lojou" || data.provider === "manual";
        const plan = data.is_admin
          ? "full" as PlanKey
          : isInternalProvider && data.plan
            ? data.plan as PlanKey
            : (data.trial && !data.product_id ? "full" as PlanKey : productToPlan(data.product_id));
        setSubscription({
          subscribed: data.subscribed || false,
          isAdmin: data.is_admin || false,
          product_id: data.product_id || null,
          plan,
          subscription_end: data.subscription_end || null,
          trial: data.trial || false,
          trialEndsAt: data.trial_ends_at || null,
        });
      }
    } catch (err) {
      console.error("check-subscription failed:", err);
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
        if (session) {
          setTimeout(() => checkSubscription(), 0);
        } else {
          setSubscription(defaultSub);
          setSubscriptionLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) checkSubscription();
      else setSubscriptionLoading(false);
    });

    return () => authSub.unsubscribe();
  }, [checkSubscription]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, subscription, subscriptionLoading, checkSubscription, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
