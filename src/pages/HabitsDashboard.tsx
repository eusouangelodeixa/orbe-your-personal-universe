import { AppLayout } from "@/components/AppLayout";
import { HabitList } from "@/components/habits/HabitList";
import { HabitForm } from "@/components/habits/HabitForm";
import { Target } from "lucide-react";

export default function HabitsDashboard() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <Target className="h-7 w-7 text-primary" /> Hábitos
          </h1>
          <p className="text-muted-foreground">Forme comportamentos consistentes</p>
        </div>
        <HabitForm />
        <HabitList />
      </div>
    </AppLayout>
  );
}
