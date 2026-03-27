import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CircadiaOnboarding } from "@/components/circadia/CircadiaOnboarding";
import { CircadiaDashboardView } from "@/components/circadia/CircadiaDashboardView";
import { useCircadianProfile } from "@/hooks/useCircadia";
import { Moon, Loader2 } from "lucide-react";

export default function CircadiaDashboard() {
  const { data: profile, isLoading } = useCircadianProfile();
  const [justCompleted, setJustCompleted] = useState(false);

  if (isLoading) return (
    <AppLayout>
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  const showOnboarding = !profile?.onboarding_completed && !justCompleted;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <Moon className="h-7 w-7 text-indigo-400" /> Circadia
          </h1>
          <p className="text-muted-foreground">Sistema de ritmo circadiano — regula o ritmo de todo o ORBE</p>
        </div>

        {showOnboarding ? (
          <CircadiaOnboarding onComplete={() => setJustCompleted(true)} />
        ) : (
          <CircadiaDashboardView />
        )}
      </div>
    </AppLayout>
  );
}
