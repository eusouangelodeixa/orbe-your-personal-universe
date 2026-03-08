import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Utensils, Loader2, Sparkles, ShoppingCart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function FitMeals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const { data } = await supabase
      .from("fit_meal_plans" as any)
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setPlans((data as any) || []);
    setLoading(false);
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("fit-generate", {
        body: { type: "meal" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Plano alimentar gerado! 🎉");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar plano");
    }
    setGenerating(false);
  };

  const activePlan = plans.find(p => p.active);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Utensils className="h-6 w-6 text-primary" />
              Plano Alimentar
            </h1>
            <p className="text-muted-foreground text-sm">Personalizado para seu objetivo e orçamento</p>
          </div>
          <Button onClick={generatePlan} disabled={generating} size="sm" className="gap-1.5">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar com IA
          </Button>
        </div>

        {activePlan ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{activePlan.title}</CardTitle>
                  <Badge variant="default">Ativo</Badge>
                </div>
                <CardDescription>
                  Gerado em {new Date(activePlan.created_at).toLocaleDateString("pt-BR")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activePlan.plan_data?.meals ? (
                  <div className="space-y-4">
                    {activePlan.plan_data.meals.map((meal: any, i: number) => (
                      <div key={i} className="rounded-lg border p-3 space-y-1">
                        <p className="font-medium text-sm">{meal.name}</p>
                        <p className="text-xs text-muted-foreground">{meal.time}</p>
                        {meal.items?.map((item: string, j: number) => (
                          <p key={j} className="text-sm pl-3">• {item}</p>
                        ))}
                        {meal.calories && (
                          <p className="text-xs text-muted-foreground pl-3">{meal.calories} kcal</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {typeof activePlan.plan_data === "string" ? activePlan.plan_data : JSON.stringify(activePlan.plan_data, null, 2)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Shopping List */}
            {activePlan.shopping_list?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Lista de Compras
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-1">
                    {activePlan.shopping_list.map((item: string, i: number) => (
                      <p key={i} className="text-sm">• {item}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <Utensils className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">Nenhum plano alimentar ativo</p>
              <Button onClick={generatePlan} disabled={generating} className="gap-1.5">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar plano com IA
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
