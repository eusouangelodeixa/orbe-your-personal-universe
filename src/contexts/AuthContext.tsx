import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Stripe product/price mapping
export const ORBE_PLANS = {
  basic: { product_id: "prod_U73CrhAJW5hnAY", price_id: "price_1T8p6B4tVPtm5YNwmqviEphn", name: "Basic", price: 19 },
  student: { product_id: "prod_U73CVnib4ajQ4N", price_id: "price_1T8p6Y4tVPtm5YNwADcxhwGk", name: "Student", price: 29 },
  full: { product_id: "prod_U73DsZWuSfdT22", price_id: "price_1T8p6t4tVPtm5YNwmi0BmeaK", name: "Full", price: 44 },
  fit: { product_id: "prod_U73DxXtdvzBmJe", price_id: "price_1T8p7J4tVPtm5YNwryI6eC3Y", name: "Fit Only", price: 24 },
} as const;

export type PlanKey = keyof typeof ORBE_PLANS;

interface SubscriptionInfo {
  subscribed: boolean;
  product_id: string | null;
  plan: PlanKey | null;
  subscription_end: string | null;
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

const defaultSub: SubscriptionInfo = { subscribed: false, product_id: null, plan: null, subscription_end: null };

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  subscription: defaultSub,
  subscriptionLoading: true,
  checkSubscription: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function productToPlan(productId: string | null): PlanKey | null {
  if (!productId) return null;
  for (const [key, plan] of Object.entries(ORBE_PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
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
        setSubscription({
          subscribed: data.subscribed || false,
          product_id: data.product_id || null,
          plan: productToPlan(data.product_id),
          subscription_end: data.subscription_end || null,
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

  // Auto-refresh subscription every 60s
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, subscription, subscriptionLoading, checkSubscription, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
