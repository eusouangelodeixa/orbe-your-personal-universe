import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subDays, differenceInCalendarDays } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly" | "weekdays" | "custom";
  category: "studies" | "fit" | "finance" | "personal" | "health";
  linked_module: "studies" | "fit" | "finance" | "tasks" | null;
  icon: string | null;
  color: string;
  target_per_period: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  completed_at: string;
  log_date: string;
  streak_at_time: number;
  notes: string | null;
}

export interface HabitWithStats extends Habit {
  streak: number;
  completedToday: boolean;
  completionRate7d: number;
}

// ─── Streak Calc ────────────────────────────────────────────────

function computeStreak(logs: HabitLog[]): number {
  if (!logs.length) return 0;
  const sorted = [...logs].sort(
    (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );
  let streak = 0;
  const today = format(new Date(), "yyyy-MM-dd");
  let expectedDate = today;

  for (const log of sorted) {
    if (log.log_date === expectedDate) {
      streak++;
      const prev = new Date(expectedDate);
      prev.setDate(prev.getDate() - 1);
      expectedDate = format(prev, "yyyy-MM-dd");
    } else if (log.log_date < expectedDate) {
      // If yesterday was skipped but today is still valid, check if first entry
      if (streak === 0 && log.log_date === format(subDays(new Date(), 1), "yyyy-MM-dd")) {
        streak = 1;
        const prev = new Date(log.log_date);
        prev.setDate(prev.getDate() - 1);
        expectedDate = format(prev, "yyyy-MM-dd");
      } else {
        break;
      }
    }
  }
  return streak;
}

function completionRate(logs: HabitLog[], days: number): number {
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");
  const relevant = logs.filter((l) => l.log_date >= since);
  return Math.round((relevant.length / days) * 100);
}

// ─── Hooks ──────────────────────────────────────────────────────

export function useHabits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["habits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user!.id)
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return (data as unknown as Habit[]) || [];
    },
  });
}

export function useHabitLogs(habitId: string | null, days: number = 30) {
  const { user } = useAuth();
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["habit_logs", habitId, days],
    enabled: !!user && !!habitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("*")
        .eq("habit_id", habitId!)
        .eq("user_id", user!.id)
        .gte("log_date", since)
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as HabitLog[]) || [];
    },
  });
}

export function useHabitsWithStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["habits_with_stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: habits, error: he } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user!.id)
        .eq("active", true)
        .order("created_at");
      if (he) throw he;
      if (!habits?.length) return [];

      const since = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const { data: allLogs, error: le } = await supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", user!.id)
        .gte("log_date", since)
        .order("log_date", { ascending: false });
      if (le) throw le;

      const today = format(new Date(), "yyyy-MM-dd");
      const typedLogs = (allLogs as unknown as HabitLog[]) || [];

      return (habits as unknown as Habit[]).map((h) => {
        const myLogs = typedLogs.filter((l) => l.habit_id === h.id);
        return {
          ...h,
          streak: computeStreak(myLogs),
          completedToday: myLogs.some((l) => l.log_date === today),
          completionRate7d: completionRate(myLogs, 7),
        } as HabitWithStats;
      });
    },
  });
}

export function useToggleHabit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, undo }: { habitId: string; undo?: boolean }) => {
      const today = format(new Date(), "yyyy-MM-dd");
      if (undo) {
        const { error } = await supabase
          .from("habit_logs")
          .delete()
          .eq("habit_id", habitId)
          .eq("user_id", user!.id)
          .eq("log_date", today);
        if (error) throw error;
      } else {
        // Compute streak
        const { data: recentLogs } = await supabase
          .from("habit_logs")
          .select("log_date")
          .eq("habit_id", habitId)
          .eq("user_id", user!.id)
          .order("log_date", { ascending: false })
          .limit(60);
        const streak = computeStreak((recentLogs as unknown as HabitLog[]) || []) + 1;
        const { error } = await supabase
          .from("habit_logs")
          .insert({
            habit_id: habitId,
            user_id: user!.id,
            log_date: today,
            streak_at_time: streak,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["habits_with_stats"] });
      qc.invalidateQueries({ queryKey: ["habit_logs", vars.habitId] });
      if (!vars.undo) toast.success("✅ Hábito completado!");
    },
    onError: () => toast.error("Erro ao atualizar hábito"),
  });
}

export function useCreateHabit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Pick<Habit, "title" | "description" | "frequency" | "category" | "linked_module" | "icon" | "color" | "target_per_period">
    ) => {
      const { data, error } = await supabase
        .from("habits")
        .insert({ ...payload, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Habit;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habits_with_stats"] });
      toast.success("🎯 Hábito criado!");
    },
    onError: () => toast.error("Erro ao criar hábito"),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Habit> & { id: string }) => {
      const { error } = await supabase
        .from("habits")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habits_with_stats"] });
    },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft-delete by deactivating
      const { error } = await supabase
        .from("habits")
        .update({ active: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habits_with_stats"] });
      toast.success("Hábito removido");
    },
  });
}
