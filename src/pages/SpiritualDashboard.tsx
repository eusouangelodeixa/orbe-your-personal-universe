import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { SpiritualOnboarding } from "@/components/spiritual/SpiritualOnboarding";
import { SpiritualPlanSelector } from "@/components/spiritual/SpiritualPlanSelector";
import { SpiritualDayView } from "@/components/spiritual/SpiritualDayView";
import { SpiritualDashboardView } from "@/components/spiritual/SpiritualDashboardView";
import { useSpiritualProfile, useActivePlan } from "@/hooks/useSpiritual";
import { BookHeart, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SpiritualDashboard() {
  const { data: profile, isLoading: pLoading } = useSpiritualProfile();
  const { data: plan, isLoading: plLoading } = useActivePlan();
  const [justOnboarded, setJustOnboarded] = useState(false);
  const [tab, setTab] = useState("visao");

  if (pLoading || plLoading) return (
    <AppLayout>
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  const showOnboarding = !profile?.onboarding_completed && !justOnboarded;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <BookHeart className="h-7 w-7 text-primary" /> Formação Espiritual
          </h1>
          <p className="text-muted-foreground">Sistema de crescimento espiritual contínuo guiado por IA</p>
        </div>

        {showOnboarding ? (
          <SpiritualOnboarding onComplete={() => setJustOnboarded(true)} />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="visao">📊 Visão Geral</TabsTrigger>
              <TabsTrigger value="estudo" disabled={!plan}>📖 Estudo</TabsTrigger>
              <TabsTrigger value="plano">✝️ Novo Plano</TabsTrigger>
            </TabsList>
            <TabsContent value="visao" className="mt-4">
              <SpiritualDashboardView onStartPlan={() => setTab("plano")} />
            </TabsContent>
            <TabsContent value="estudo" className="mt-4">
              {plan ? (
                <SpiritualDayView />
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Crie um plano primeiro
                </div>
              )}
            </TabsContent>
            <TabsContent value="plano" className="mt-4">
              <SpiritualPlanSelector />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
