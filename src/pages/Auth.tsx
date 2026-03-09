import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ORBE_PLANS, PlanKey, BillingPeriod } from "@/contexts/AuthContext";
import { OrbeIcon } from "@/components/OrbeIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const selectedPlan = searchParams.get("plan") as PlanKey | null;
  const selectedPeriod = (searchParams.get("period") as BillingPeriod) || "mensal";

  useEffect(() => {
    if (!session) return;
    // If user came from pricing with a plan, trigger checkout
    if (selectedPlan && ORBE_PLANS[selectedPlan]) {
      const triggerCheckout = async () => {
        try {
          const plan = ORBE_PLANS[selectedPlan];
          const period: BillingPeriod = selectedPeriod in plan.prices ? selectedPeriod : "mensal";
          const { data, error } = await supabase.functions.invoke("create-checkout", {
            body: { priceId: plan.prices[period].price_id },
          });
          if (error) throw error;
          if (data?.url) window.open(data.url, "_blank");
        } catch (err) {
          console.error("Checkout error:", err);
        }
        navigate("/dashboard", { replace: true });
      };
      triggerCheckout();
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [session, navigate, selectedPlan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative bg-background">
      {/* Amber glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10 border border-border bg-card p-8">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <OrbeIcon size={48} />
          </div>
          <h1 className="font-display text-4xl tracking-wider text-foreground mb-2">
            {isLogin ? "ENTRAR" : "CRIAR CONTA"}
          </h1>
          <p className="font-syne text-[10px] font-semibold tracking-[3px] uppercase text-primary">
            {isLogin ? "Acesse seu universo pessoal" : "Comece a organizar sua vida"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-syne text-[10px] font-semibold tracking-[2px] uppercase text-muted-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="font-syne text-[10px] font-semibold tracking-[2px] uppercase text-muted-foreground">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              maxLength={72}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-11"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLogin ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-sm text-muted-foreground">
            {isLogin ? "Não tem conta? " : "Já tem conta? "}
          </span>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-syne text-xs font-semibold tracking-wider uppercase text-primary hover:text-primary/80 transition-colors"
          >
            {isLogin ? "Criar agora" : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
