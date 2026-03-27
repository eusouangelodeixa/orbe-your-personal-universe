import { AppLayout } from "@/components/AppLayout";
import { EnergyCheckIn } from "@/components/energy/EnergyCheckIn";
import { EnergyTimeline } from "@/components/energy/EnergyTimeline";
import { Zap } from "lucide-react";

export default function EnergyDashboard() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <Zap className="h-7 w-7 text-amber-500" /> Energia
          </h1>
          <p className="text-muted-foreground">Monitore sua capacidade cognitiva e física</p>
        </div>
        <EnergyCheckIn />
        <EnergyTimeline days={14} />
      </div>
    </AppLayout>
  );
}
