import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface IntensiveStudySession {
  id: string;
  user_id: string;
  goal: "recovery" | "exam_prep" | "mastery" | "review";
  status: "planned" | "running" | "completed" | "partial" | "not_completed";
  plan_date: string;
  wake_time: string | null;
  sleep_time: string | null;
  high_energy_start: string | null;
  high_energy_end: string | null;
  total_blocks: number;
  completed_blocks: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntensiveStudyBlock {
  id: string;
  session_id: string;
  user_id: string;
  subject_id: string | null;
  topic: string;
  difficulty_level: number;
  urgency_level: number;
  priority_score: number;
  duration_min: number;
  start_time: string | null;
  block_order: number;
  status: "planned" | "running" | "completed" | "partial" | "not_completed";
  comprehension: "understood" | "partial" | "not_understood" | null;
  quiz_score: number | null;
  pomodoro_count: number;
  created_at: string;
  updated_at: string;
}

export interface IntensiveStudyTopic {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic: string;
  difficulty_level: number;
  urgency_level: number;
  priority_score: number;
  times_studied: number;
  avg_quiz_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface IntensiveStudyQuizResult {
  id: string;
  block_id: string;
  user_id: string;
  question: string;
  user_answer: string | null;
  is_correct: boolean | null;
  response_time_s: number | null;
  confidence: number | null;
  created_at: string;
}

export interface TopicInput {
  subject_id: string;
  subject_name: string;
  topic: string;
  difficulty_level: number;
  urgency_level: number;
  exam_date: string | null; // ISO date string of next exam
}

export interface CircadiaConfig {
  wake_time: string;      // "HH:MM"
  sleep_time: string;     // "HH:MM"
  high_energy_start: string;
  high_energy_end: string;
}

export interface TimeSlot {
  start: string; // "HH:MM"
  end: string;
  durationMin: number;
  isHighEnergy: boolean;
}

// ─── Priority Algorithm ─────────────────────────────────────────────────────

export function computePriorityScore(
  difficulty: number,
  urgency: number,
  examDate: string | null,
  today: Date = new Date()
): number {
  let proximityScore = 0;
  if (examDate) {
    const daysUntil = differenceInDays(parseISO(examDate), today);
    if (daysUntil <= 1) proximityScore = 5;
    else if (daysUntil <= 3) proximityScore = 4;
    else if (daysUntil <= 7) proximityScore = 3;
    else if (daysUntil <= 14) proximityScore = 2;
    else proximityScore = 1;
  }
  const score = (difficulty * 0.4) + (urgency * 0.4) + (proximityScore * 0.2);
  return Math.round(score * 100) / 100;
}

// ─── Time helpers ───────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Availability Engine ────────────────────────────────────────────────────

/** Returns a sorted list of free TimeSlots for a given date after blocking busy periods */
export async function buildAvailabilityMap(
  userId: string,
  date: string, // ISO date "YYYY-MM-DD"
  circadia: CircadiaConfig
): Promise<TimeSlot[]> {
  const dayOfWeek = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][
    new Date(date).getDay()
  ];

  // Collect blocked intervals (all in minutes since midnight)
  type Interval = { start: number; end: number; label: string };
  const blocked: Interval[] = [];

  // Block before wake and 1h before sleep
  const wakeMin = timeToMinutes(circadia.wake_time);
  const sleepMin = timeToMinutes(circadia.sleep_time);
  if (wakeMin > 0) blocked.push({ start: 0, end: wakeMin, label: "sleeping" });
  blocked.push({ start: sleepMin - 60, end: sleepMin, label: "pre-sleep wind down" });
  blocked.push({ start: sleepMin, end: 24 * 60, label: "sleeping" });

  // Academic schedule (regular classes on this day)
  const { data: subjects } = await supabase
    .from("subjects")
    .select("name, schedule")
    .eq("user_id", userId);
  for (const sub of subjects || []) {
    for (const slot of (sub.schedule || []) as any[]) {
      if (slot.day === dayOfWeek && slot.start && slot.end) {
        blocked.push({
          start: timeToMinutes(slot.start),
          end: timeToMinutes(slot.end),
          label: `Aula: ${sub.name}`,
        });
      }
    }
  }

  // Academic events on this date
  const { data: events } = await supabase
    .from("academic_events")
    .select("title, event_date")
    .eq("user_id", userId)
    .eq("event_date", date);
  for (const ev of events || []) {
    // Block 2h slot for exams/deliveries (full day flag for now at noon)
    blocked.push({ start: 12 * 60, end: 14 * 60, label: `Evento: ${ev.title}` });
  }

  // Fit workouts today — block 1h post-workout
  const { data: workouts } = await supabase
    .from("fit_workout_logs")
    .select("workout_date, duration_minutes")
    .eq("user_id", userId)
    .eq("workout_date", date);
  for (const w of workouts || []) {
    // Assume workout at 07:00 if time not stored — block 1h after duration
    const workoutEnd = wakeMin + (w.duration_minutes || 60);
    blocked.push({ start: workoutEnd, end: workoutEnd + 60, label: "Recuperação pós-treino" });
  }

  // Fixed tasks on this date
  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, due_date")
    .eq("user_id", userId)
    .eq("due_date", date)
    .in("status", ["pendente", "em_andamento"]);
  for (const t of tasks || []) {
    // Block 30-min slot per task with fixed time (no time stored, skip)
  }

  // Merge and sort blocked intervals
  blocked.sort((a, b) => a.start - b.start);

  // Build free slots between blocked zones
  const DAY_START = wakeMin;
  const DAY_END = sleepMin - 60;
  const highEnergyStart = timeToMinutes(circadia.high_energy_start);
  const highEnergyEnd = timeToMinutes(circadia.high_energy_end);

  const freeSlots: TimeSlot[] = [];
  let cursor = DAY_START;

  for (const interval of blocked) {
    if (interval.start > cursor && cursor < DAY_END) {
      const slotEnd = Math.min(interval.start, DAY_END);
      const duration = slotEnd - cursor;
      if (duration >= 25) {
        freeSlots.push({
          start: minutesToTime(cursor),
          end: minutesToTime(slotEnd),
          durationMin: duration,
          isHighEnergy:
            cursor >= highEnergyStart && slotEnd <= highEnergyEnd,
        });
      }
    }
    cursor = Math.max(cursor, interval.end);
  }

  // Final free slot after last blocked interval
  if (cursor < DAY_END) {
    const duration = DAY_END - cursor;
    if (duration >= 25) {
      freeSlots.push({
        start: minutesToTime(cursor),
        end: minutesToTime(DAY_END),
        durationMin: duration,
        isHighEnergy:
          cursor >= highEnergyStart && DAY_END <= highEnergyEnd,
      });
    }
  }

  return freeSlots;
}

// ─── Plan Generation ────────────────────────────────────────────────────────

export interface GeneratedBlock {
  subject_id: string;
  subject_name: string;
  topic: string;
  difficulty_level: number;
  urgency_level: number;
  priority_score: number;
  duration_min: number;
  start_time: string;
  block_order: number;
}

/** 
 * Distributes study topics into free slots following cognitive scheduling rules:
 * - Max 90 min per topic block
 * - Min 25 min per block
 * - 10 min break between different subjects
 * - Avoid two high-difficulty (≥4) subjects in a row
 * - Fill high-energy slots first for high-priority topics
 */
export function generatePlan(
  topics: TopicInput[],
  slots: TimeSlot[],
  today: Date = new Date()
): GeneratedBlock[] {
  if (!topics.length || !slots.length) return [];

  // Sort topics by priority descending
  const sorted = [...topics].sort((a, b) =>
    computePriorityScore(b.difficulty_level, b.urgency_level, b.exam_date, today) -
    computePriorityScore(a.difficulty_level, a.urgency_level, a.exam_date, today)
  );

  // Separate high-energy from normal slots
  const highEnergy = slots.filter((s) => s.isHighEnergy);
  const normal = slots.filter((s) => !s.isHighEnergy);
  // High-priority (heavy) topics go into high-energy slots
  const heavyTopics = sorted.filter((t) => t.difficulty_level >= 4 || t.urgency_level >= 4);
  const lightTopics = sorted.filter((t) => t.difficulty_level < 4 && t.urgency_level < 4);

  const orderedTopics = [...heavyTopics, ...lightTopics];
  const orderedSlots = [...highEnergy, ...normal];

  const blocks: GeneratedBlock[] = [];
  let blockOrder = 0;
  let lastSubjectId = "";
  let lastWasHeavy = false;

  const BREAK_MIN = 10;
  const MAX_BLOCK_MIN = 90;
  const MIN_BLOCK_MIN = 25;

  for (const slot of orderedSlots) {
    let slotCursor = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);

    for (const topic of orderedTopics) {
      if (slotCursor >= slotEnd) break;

      const isHeavy = topic.difficulty_level >= 4;

      // Avoid two heavy blocks in a row
      if (isHeavy && lastWasHeavy) {
        // Try to insert a light topic between two heavy ones
        const lighter = orderedTopics.find(
          (lt) => lt !== topic && lt.difficulty_level < 4
        );
        if (lighter) {
          // Place lighter topic first, then continue with heavy
        }
      }

      // Add break between different subjects
      if (lastSubjectId && lastSubjectId !== topic.subject_id) {
        slotCursor += BREAK_MIN;
      }

      const available = slotEnd - slotCursor;
      if (available < MIN_BLOCK_MIN) break;

      const blockDuration = Math.min(available, MAX_BLOCK_MIN);
      const score = computePriorityScore(
        topic.difficulty_level,
        topic.urgency_level,
        topic.exam_date,
        today
      );

      blocks.push({
        subject_id: topic.subject_id,
        subject_name: topic.subject_name,
        topic: topic.topic,
        difficulty_level: topic.difficulty_level,
        urgency_level: topic.urgency_level,
        priority_score: score,
        duration_min: blockDuration,
        start_time: minutesToTime(slotCursor),
        block_order: blockOrder++,
      });

      slotCursor += blockDuration;
      lastSubjectId = topic.subject_id;
      lastWasHeavy = isHeavy;
    }
  }

  return blocks;
}

// ─── Adaptation Loop ────────────────────────────────────────────────────────

export async function triggerAdaptation(
  blockId: string,
  quizScore: number, // 0–100
  userId: string
): Promise<void> {
  const { data: block } = await supabase
    .from("intensive_study_blocks")
    .select("priority_score, urgency_level, session_id")
    .eq("id", blockId)
    .single();

  if (!block) return;

  if (quizScore < 60) {
    // Increase priority — cap at 5
    const newPriority = Math.min(Number(block.priority_score) + 0.8, 5);
    await supabase
      .from("intensive_study_blocks")
      .update({ priority_score: newPriority, status: "partial" } as any)
      .eq("id", blockId);
    toast.warning("📌 Sessão reagendada — este tópico precisa de reforço!", {
      description: `Score: ${Math.round(quizScore)}%. Prioridade aumentada.`,
    });
  } else if (quizScore >= 80) {
    // Reduce priority — floor at 1
    const newPriority = Math.max(Number(block.priority_score) - 0.5, 1);
    await supabase
      .from("intensive_study_blocks")
      .update({ priority_score: newPriority, status: "completed", comprehension: "understood" } as any)
      .eq("id", blockId);
    toast.success("🎉 Excelente! Tópico dominado — prioridade reduzida.");
  } else {
    await supabase
      .from("intensive_study_blocks")
      .update({ status: "completed", comprehension: "partial" } as any)
      .eq("id", blockId);
  }

  // Update session completed_blocks count
  const { data: blocks } = await supabase
    .from("intensive_study_blocks")
    .select("status")
    .eq("session_id", block.session_id);
  const done = (blocks || []).filter(
    (b: any) => b.status === "completed" || b.status === "partial"
  ).length;
  const total = (blocks || []).length;
  const sessionStatus: string =
    done === total ? "completed" : done > 0 ? "partial" : "running";
  await supabase
    .from("intensive_study_sessions")
    .update({ completed_blocks: done, status: sessionStatus } as any)
    .eq("id", block.session_id);
}

// ─── CRUD Hooks ─────────────────────────────────────────────────────────────

export function useIntensiveSessions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["intensive_sessions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intensive_study_sessions")
        .select("*")
        .eq("user_id", user!.id)
        .order("plan_date", { ascending: false });
      if (error) throw error;
      return data as unknown as IntensiveStudySession[];
    },
  });
}

export function useIntensiveSession(sessionId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["intensive_session", sessionId],
    enabled: !!user && !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intensive_study_sessions")
        .select("*")
        .eq("id", sessionId!)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data as unknown as IntensiveStudySession;
    },
  });
}

export function useCreateIntensiveSession() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<IntensiveStudySession, "id" | "user_id" | "created_at" | "updated_at" | "completed_blocks">
    ) => {
      const { data, error } = await supabase
        .from("intensive_study_sessions")
        .insert({ ...payload, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as IntensiveStudySession;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["intensive_sessions"] }); },
    onError: () => toast.error("Erro ao criar sessão intensiva"),
  });
}

export function useUpdateIntensiveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<IntensiveStudySession> & { id: string }) => {
      const { error } = await supabase
        .from("intensive_study_sessions")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["intensive_session", vars.id] });
      qc.invalidateQueries({ queryKey: ["intensive_sessions"] });
    },
  });
}

export function useIntensiveBlocks(sessionId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["intensive_blocks", sessionId],
    enabled: !!user && !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intensive_study_blocks")
        .select("*")
        .eq("session_id", sessionId!)
        .eq("user_id", user!.id)
        .order("block_order");
      if (error) throw error;
      return data as unknown as IntensiveStudyBlock[];
    },
  });
}

export function useSaveIntensiveBlocks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      blocks,
    }: {
      sessionId: string;
      blocks: GeneratedBlock[];
    }) => {
      const rows = blocks.map((b) => ({
        ...b,
        session_id: sessionId,
        user_id: user!.id,
      }));
      const { error } = await supabase
        .from("intensive_study_blocks")
        .insert(rows as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["intensive_blocks", vars.sessionId] });
      qc.invalidateQueries({ queryKey: ["intensive_session", vars.sessionId] });
    },
    onError: () => toast.error("Erro ao salvar blocos do plano"),
  });
}

export function useUpdateIntensiveBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      sessionId,
      ...data
    }: Partial<IntensiveStudyBlock> & { id: string; sessionId: string }) => {
      const { error } = await supabase
        .from("intensive_study_blocks")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
      return { sessionId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["intensive_blocks", result?.sessionId] });
    },
  });
}

export function useSaveQuizResults() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      blockId,
      sessionId,
      results,
    }: {
      blockId: string;
      sessionId: string;
      results: Array<{
        question: string;
        user_answer: string;
        is_correct: boolean;
        response_time_s: number;
        confidence: number;
      }>;
    }) => {
      const rows = results.map((r) => ({ ...r, block_id: blockId, user_id: user!.id }));
      const { error } = await supabase
        .from("intensive_study_quiz_results")
        .insert(rows as any);
      if (error) throw error;
      // Compute score and trigger adaptation
      const score = (results.filter((r) => r.is_correct).length / results.length) * 100;
      const avgScore = Math.round(score);
      await supabase
        .from("intensive_study_blocks")
        .update({ quiz_score: avgScore } as any)
        .eq("id", blockId);
      await triggerAdaptation(blockId, avgScore, user!.id);
      return { sessionId, blockId, score: avgScore };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["intensive_blocks", result.sessionId] });
      qc.invalidateQueries({ queryKey: ["intensive_session", result.sessionId] });
    },
    onError: () => toast.error("Erro ao salvar resultados do quiz"),
  });
}

// Convenience hook: active session for today
export function useTodayIntensiveSession() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["intensive_today", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intensive_study_sessions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("plan_date", today)
        .in("status", ["planned", "running"])
        .maybeSingle();
      if (error) throw error;
      return data as unknown as IntensiveStudySession | null;
    },
  });
}
