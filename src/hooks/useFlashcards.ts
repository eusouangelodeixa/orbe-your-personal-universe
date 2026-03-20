import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Flashcard {
  id: string;
  user_id: string;
  subject_id: string | null;
  front: string;
  back: string;
  difficulty: number;
  next_review: string;
  interval_days: number;
  ease_factor: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export function useFlashcards(subjectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["flashcards", user?.id, subjectId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("flashcards" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("next_review");
      if (subjectId) q = q.eq("subject_id", subjectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as Flashcard[];
    },
  });
}

export function useDueFlashcards(subjectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["flashcards_due", user?.id, subjectId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("flashcards" as any)
        .select("*")
        .eq("user_id", user!.id)
        .lte("next_review", new Date().toISOString())
        .order("next_review");
      if (subjectId) q = q.eq("subject_id", subjectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as Flashcard[];
    },
  });
}

export function useAddFlashcard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (card: { subject_id?: string; front: string; back: string }) => {
      const { error } = await supabase.from("flashcards" as any).insert({
        ...card,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      qc.invalidateQueries({ queryKey: ["flashcards_due"] });
      toast.success("Flashcard criado!");
    },
    onError: () => toast.error("Erro ao criar flashcard"),
  });
}

export function useAddFlashcardsBatch() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (cards: { subject_id?: string; front: string; back: string }[]) => {
      const rows = cards.map(c => ({ ...c, user_id: user!.id }));
      const { error } = await supabase.from("flashcards" as any).insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      qc.invalidateQueries({ queryKey: ["flashcards_due"] });
      toast.success("Flashcards criados!");
    },
    onError: () => toast.error("Erro ao criar flashcards"),
  });
}

/** SM-2 spaced repetition algorithm */
function calculateNextReview(card: Flashcard, quality: number) {
  // quality: 0-5 (0=total blackout, 5=perfect)
  let ef = card.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ef = Math.max(1.3, ef);

  let interval: number;
  if (quality < 3) {
    interval = 1; // reset
  } else if (card.review_count === 0) {
    interval = 1;
  } else if (card.review_count === 1) {
    interval = 6;
  } else {
    interval = Math.round(card.interval_days * ef);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    ease_factor: ef,
    interval_days: interval,
    next_review: nextReview.toISOString(),
    review_count: quality < 3 ? 0 : card.review_count + 1,
    difficulty: quality < 3 ? Math.min(card.difficulty + 1, 5) : Math.max(card.difficulty - 1, 0),
  };
}

export function useReviewFlashcard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ card, quality }: { card: Flashcard; quality: number }) => {
      const updates = calculateNextReview(card, quality);
      const { error } = await supabase
        .from("flashcards" as any)
        .update(updates as any)
        .eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      qc.invalidateQueries({ queryKey: ["flashcards_due"] });
    },
  });
}

export function useDeleteFlashcard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flashcards" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      qc.invalidateQueries({ queryKey: ["flashcards_due"] });
      toast.success("Flashcard removido");
    },
  });
}
