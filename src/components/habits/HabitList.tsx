import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, Flame, MoreVertical, Trash2 } from "lucide-react";
import { useHabitsWithStats, useToggleHabit, useDeleteHabit, HabitWithStats } from "@/hooks/useHabits";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const CATEGORY_COLORS: Record<string, string> = {
  studies: "bg-indigo-500",
  fit: "bg-amber-500",
  finance: "bg-emerald-500",
  personal: "bg-pink-500",
  health: "bg-red-500",
};

export function HabitList() {
  const { data: habits = [], isLoading } = useHabitsWithStats();
  const toggleHabit = useToggleHabit();
  const deleteHabit = useDeleteHabit();

  if (isLoading) return <div className="animate-pulse space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted" />)}</div>;

  if (!habits.length) return (
    <div className="text-center py-8 text-sm text-muted-foreground">
      Nenhum hábito cadastrado. Crie o primeiro acima!
    </div>
  );

  return (
    <div className="space-y-2">
      {habits.map((h) => (
        <Card key={h.id} className={`transition-all ${h.completedToday ? "opacity-75" : ""}`}>
          <CardContent className="py-3 flex items-center gap-3">
            <button
              onClick={() => toggleHabit.mutate({ habitId: h.id, undo: h.completedToday })}
              className="shrink-0 transition-colors"
              disabled={toggleHabit.isPending}
            >
              {h.completedToday ? (
                <CheckCircle className="h-6 w-6 text-primary" />
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground hover:text-primary" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_COLORS[h.category] || "bg-muted-foreground"}`} />
                <span className={`text-sm font-medium ${h.completedToday ? "line-through text-muted-foreground" : ""}`}>
                  {h.icon ?? ""} {h.title}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {h.streak > 0 && (
                  <span className="text-xs text-amber-500 flex items-center gap-0.5">
                    <Flame className="h-3 w-3" /> {h.streak}d
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{h.completionRate7d}% (7d)</span>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] shrink-0">
              {h.frequency === "daily" ? "Diário" : h.frequency === "weekly" ? "Semanal" : h.frequency === "weekdays" ? "Dias úteis" : "Custom"}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteHabit.mutate(h.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
