import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { GoalBoard, GoalDetail } from "@/components/norte/GoalBoard";
import { Compass } from "lucide-react";

export default function NorteDashboard() {
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <Compass className="h-7 w-7 text-primary" /> Norte
          </h1>
          <p className="text-muted-foreground">Sistema de direção de vida — defina e acompanhe metas estratégicas</p>
        </div>

        {selectedGoalId ? (
          <GoalDetail goalId={selectedGoalId} onBack={() => setSelectedGoalId(null)} />
        ) : (
          <GoalBoard onSelect={(id) => setSelectedGoalId(id)} />
        )}
      </div>
    </AppLayout>
  );
}
