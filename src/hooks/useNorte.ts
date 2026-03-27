import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────

export interface Goal {
  id: string;
  user_id: string;
  goal_type: "financial" | "academic" | "physical" | "personal" | "career";
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  deadline: string | null;
  priority: number;
  status: "active" | "paused" | "completed" | "abandoned";
  parent_goal_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface GoalMilestone {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  milestone_order: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  linked_task_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface GoalWithProgress extends Goal {
  milestones: GoalMilestone[];
  progressPct: number;
  daysLeft: number | null;
}

const GOAL_TYPE_META = {
  financial: { label: "Financeira", icon: "💰", color: "#10b981" },
  academic: { label: "Acadêmica", icon: "📚", color: "#6366f1" },
  physical: { label: "Física", icon: "💪", color: "#f59e0b" },
  personal: { label: "Pessoal", icon: "🎯", color: "#ec4899" },
  career: { label: "Carreira", icon: "🚀", color: "#3b82f6" },
};

// ─── Hooks ──────────────────────────────────────────────────────

export function useGoals(status?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["goals", user?.id, status],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("goals")
        .select("*")
        .eq("user_id", user!.id)
        .order("priority", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Goal[]) || [];
    },
  });
}

export function useGoalWithMilestones(goalId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["goal_detail", goalId],
    enabled: !!user && !!goalId,
    queryFn: async () => {
      const [goalRes, milestonesRes] = await Promise.all([
        supabase.from("goals").select("*").eq("id", goalId!).single(),
        supabase
          .from("goal_milestones")
          .select("*")
          .eq("goal_id", goalId!)
          .order("milestone_order"),
      ]);
      if (goalRes.error) throw goalRes.error;
      const goal = goalRes.data as unknown as Goal;
      const milestones = (milestonesRes.data as unknown as GoalMilestone[]) || [];
      const doneMilestones = milestones.filter((m) => m.status === "completed").length;
      const progressPct = milestones.length
        ? Math.round((doneMilestones / milestones.length) * 100)
        : goal.target_value
          ? Math.round((goal.current_value / goal.target_value) * 100)
          : 0;
      const daysLeft = goal.deadline
        ? differenceInDays(parseISO(goal.deadline), new Date())
        : null;

      return { ...goal, milestones, progressPct, daysLeft } as GoalWithProgress;
    },
  });
}

export function useActiveGoalsWithProgress() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["goals_with_progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: goals, error: ge } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("priority", { ascending: false });
      if (ge) throw ge;
      if (!goals?.length) return [];

      const goalIds = (goals as any[]).map((g) => g.id);
      const { data: allMilestones } = await supabase
        .from("goal_milestones")
        .select("*")
        .in("goal_id", goalIds)
        .order("milestone_order");

      const typedMilestones = (allMilestones as unknown as GoalMilestone[]) || [];

      return (goals as unknown as Goal[]).map((g) => {
        const milestones = typedMilestones.filter((m) => m.goal_id === g.id);
        const done = milestones.filter((m) => m.status === "completed").length;
        const progressPct = milestones.length
          ? Math.round((done / milestones.length) * 100)
          : g.target_value
            ? Math.round((g.current_value / Number(g.target_value)) * 100)
            : 0;
        const daysLeft = g.deadline
          ? differenceInDays(parseISO(g.deadline), new Date())
          : null;
        return { ...g, milestones, progressPct, daysLeft } as GoalWithProgress;
      });
    },
  });
}

export function useCreateGoal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Pick<Goal, "goal_type" | "title" | "description" | "target_value" | "unit" | "deadline" | "priority" | "tags">
    ) => {
      const { data, error } = await supabase
        .from("goals")
        .insert({ ...payload, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Goal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["goals_with_progress"] });
      toast.success("🎯 Meta criada!");
    },
    onError: () => toast.error("Erro ao criar meta"),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Goal> & { id: string }) => {
      const { error } = await supabase
        .from("goals")
        .update({ ...data, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["goals_with_progress"] });
      qc.invalidateQueries({ queryKey: ["goal_detail", vars.id] });
    },
  });
}

export function useCreateMilestone() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Pick<GoalMilestone, "goal_id" | "title" | "description" | "due_date" | "milestone_order">
    ) => {
      const { data, error } = await supabase
        .from("goal_milestones")
        .insert({ ...payload, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as GoalMilestone;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["goal_detail", vars.goal_id] });
      qc.invalidateQueries({ queryKey: ["goals_with_progress"] });
    },
    onError: () => toast.error("Erro ao criar marco"),
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      goalId,
      ...data
    }: Partial<GoalMilestone> & { id: string; goalId: string }) => {
      const payload = data.status === "completed"
        ? { ...data, completed_at: new Date().toISOString() }
        : data;
      const { error } = await supabase
        .from("goal_milestones")
        .update(payload as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["goal_detail", vars.goalId] });
      qc.invalidateQueries({ queryKey: ["goals_with_progress"] });
    },
  });
}

/** Get today's priorities from the Norte engine */
export function useTodayPriorities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["today_priorities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Active goals sorted by priority + deadline proximity
      const { data: goals } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("priority", { ascending: false });

      if (!goals?.length) return [];

      // For each goal get next pending milestone
      const goalIds = (goals as any[]).map((g) => g.id);
      const { data: milestones } = await supabase
        .from("goal_milestones")
        .select("*")
        .in("goal_id", goalIds)
        .in("status", ["pending", "in_progress"])
        .order("milestone_order");

      const priorities: Array<{
        goal: Goal;
        nextMilestone: GoalMilestone | null;
        urgency: "high" | "medium" | "low";
      }> = [];

      for (const g of goals as unknown as Goal[]) {
        const ms = (milestones as unknown as GoalMilestone[] || []).find((m) => m.goal_id === g.id);
        const daysLeft = g.deadline ? differenceInDays(parseISO(g.deadline), new Date()) : null;
        const urgency = daysLeft !== null && daysLeft <= 3 ? "high"
          : daysLeft !== null && daysLeft <= 7 ? "medium"
          : g.priority >= 4 ? "medium"
          : "low";
        priorities.push({ goal: g, nextMilestone: ms || null, urgency });
      }

      return priorities
        .sort((a, b) => {
          const urgencyOrder = { high: 0, medium: 1, low: 2 };
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        })
        .slice(0, 5);
    },
  });
}

export { GOAL_TYPE_META };
