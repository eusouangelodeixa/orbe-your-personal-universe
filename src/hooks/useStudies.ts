import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  teacher: string | null;
  course: string | null;
  semester: string | null;
  type: string;
  weekly_hours: number;
  schedule: { day: string; start: string; end: string }[];
  color: string;
  created_at: string;
  updated_at: string;
}

export interface AcademicEvent {
  id: string;
  user_id: string;
  subject_id: string;
  type: string; // prova, trabalho, atividade, revisao
  title: string;
  description: string | null;
  event_date: string;
  due_date: string | null;
  content_topics: string | null;
  weight: number | null;
  is_group: boolean;
  status: string; // pendente, em_andamento, entregue, realizado
  reminder_config: any[];
  created_at: string;
  updated_at: string;
}

export interface SubjectChatMessage {
  id: string;
  user_id: string;
  subject_id: string;
  role: string;
  content: string;
  created_at: string;
}

// ─── Subjects ───

export function useSubjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["subjects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("user_id", user!.id)
        .order("name");
      if (error) throw error;
      return data as unknown as Subject[];
    },
  });
}

export function useAddSubject() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (sub: Omit<Subject, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("subjects").insert({ ...sub, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); toast.success("Disciplina criada!"); },
    onError: () => toast.error("Erro ao criar disciplina"),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Subject> & { id: string }) => {
      const { error } = await supabase.from("subjects").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); toast.success("Disciplina atualizada!"); },
    onError: () => toast.error("Erro ao atualizar disciplina"),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); toast.success("Disciplina removida!"); },
    onError: () => toast.error("Erro ao remover disciplina"),
  });
}

// ─── Academic Events ───

export function useAcademicEvents(subjectId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academic_events", user?.id, subjectId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("academic_events")
        .select("*")
        .eq("user_id", user!.id)
        .order("event_date");
      if (subjectId) q = q.eq("subject_id", subjectId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as AcademicEvent[];
    },
  });
}

export function useAddAcademicEvent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ev: Omit<AcademicEvent, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("academic_events").insert({ ...ev, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic_events"] }); toast.success("Evento criado!"); },
    onError: () => toast.error("Erro ao criar evento"),
  });
}

export function useUpdateAcademicEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<AcademicEvent> & { id: string }) => {
      const { error } = await supabase.from("academic_events").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic_events"] }); toast.success("Evento atualizado!"); },
    onError: () => toast.error("Erro ao atualizar evento"),
  });
}

export function useDeleteAcademicEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academic_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic_events"] }); toast.success("Evento removido!"); },
    onError: () => toast.error("Erro ao remover evento"),
  });
}

// ─── Subject Chat Messages ───

export function useSubjectChatMessages(subjectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["subject_chat", user?.id, subjectId],
    enabled: !!user && !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_chat_messages")
        .select("*")
        .eq("user_id", user!.id)
        .eq("subject_id", subjectId)
        .order("created_at");
      if (error) throw error;
      return data as unknown as SubjectChatMessage[];
    },
  });
}

export function useAddSubjectChatMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (msg: { subject_id: string; role: string; content: string }) => {
      const { error } = await supabase.from("subject_chat_messages").insert({ ...msg, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["subject_chat", undefined, vars.subject_id] }); },
  });
}

export function useClearSubjectChat() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (subjectId: string) => {
      const { error } = await supabase
        .from("subject_chat_messages")
        .delete()
        .eq("user_id", user!.id)
        .eq("subject_id", subjectId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subject_chat"] }); toast.success("Histórico limpo!"); },
  });
}
