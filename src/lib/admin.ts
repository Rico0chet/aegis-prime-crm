import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type QuestionInputType = Database["public"]["Enums"]["question_input_type"];
export type TemplateRow = Database["public"]["Tables"]["needs_analysis_templates"]["Row"];
export type QuestionRow = Database["public"]["Tables"]["needs_analysis_questions"]["Row"];
export type AnalysisRow = Database["public"]["Tables"]["client_needs_analyses"]["Row"];
export type AnswerRow = Database["public"]["Tables"]["needs_analysis_answers"]["Row"];

export const QUESTION_INPUT_TYPES: QuestionInputType[] = [
  "short_text",
  "long_text",
  "number",
  "currency",
  "date",
  "yes_no",
  "single_select",
  "multi_select",
];

export const questionTypeLabel: Record<QuestionInputType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
  currency: "Currency",
  date: "Date",
  yes_no: "Yes / No",
  single_select: "Single choice",
  multi_select: "Multiple choice",
};

export function optionsOf(question: QuestionRow): string[] {
  return Array.isArray(question.options) ? (question.options as unknown[]).map(String) : [];
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

/* ----------------------------------- roles ---------------------------------- */

export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (error) return false;
      return Boolean(data);
    },
  });
}

export type ProducerRecord = {
  id: string;
  full_name: string | null;
  agency: string | null;
  license_number: string | null;
  roles: AppRole[];
};

export function useProducers() {
  return useQuery({
    queryKey: ["admin", "producers"],
    queryFn: async (): Promise<ProducerRecord[]> => {
      const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name, agency, license_number"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
      if (profileError) throw profileError;
      if (roleError) throw roleError;
      return (profiles ?? []).map((profile) => ({
        ...profile,
        roles: (roles ?? []).filter((r) => r.user_id === profile.id).map((r) => r.role),
      }));
    },
  });
}

export function useSetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role, grant }: { userId: string; role: AppRole; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase
          .from("user_roles")
          .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "producers"] });
      void qc.invalidateQueries({ queryKey: ["is-admin"] });
    },
  });
}

export function useUpdateProducerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      full_name?: string | null;
      agency?: string | null;
      license_number?: string | null;
    }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "producers"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/* --------------------------------- templates -------------------------------- */

export function useTemplates() {
  return useQuery({
    queryKey: ["needs-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("needs_analysis_templates")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TemplateRow[];
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string | null; product_type?: string | null }) => {
      const { data, error } = await supabase
        .from("needs_analysis_templates")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["needs-templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      name?: string;
      description?: string | null;
      product_type?: string | null;
      is_active?: boolean;
      sort_order?: number;
    }) => {
      const { error } = await supabase.from("needs_analysis_templates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["needs-templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("needs_analysis_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["needs-templates"] });
      void qc.invalidateQueries({ queryKey: ["needs-questions"] });
    },
  });
}

/* --------------------------------- questions -------------------------------- */

export function useQuestions(templateId?: string) {
  return useQuery({
    queryKey: ["needs-questions", templateId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("needs_analysis_questions")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (templateId) query = query.eq("template_id", templateId);
      const { data, error } = await query;
      if (error) throw error;
      return data as QuestionRow[];
    },
    enabled: templateId !== undefined,
  });
}

export type NewQuestion = {
  template_id: string;
  prompt: string;
  help_text?: string | null;
  input_type: QuestionInputType;
  options?: string[];
  is_required?: boolean;
  sort_order?: number;
};

export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ options = [], ...input }: NewQuestion) => {
      const { error } = await supabase
        .from("needs_analysis_questions")
        .insert({ ...input, options });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["needs-questions"] }),
  });
}

export function useUpdateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      options,
      ...patch
    }: {
      id: string;
      prompt?: string;
      help_text?: string | null;
      input_type?: QuestionInputType;
      options?: string[];
      is_required?: boolean;
      sort_order?: number;
    }) => {
      const { error } = await supabase
        .from("needs_analysis_questions")
        .update({ ...patch, ...(options ? { options } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["needs-questions"] }),
  });
}

export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("needs_analysis_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["needs-questions"] }),
  });
}

/* ------------------------------ client analyses ------------------------------ */

export function useClientAnalyses(clientId?: string) {
  return useQuery({
    queryKey: ["client-analyses", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_needs_analyses")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AnalysisRow[];
    },
    enabled: Boolean(clientId),
  });
}

export function useCreateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { client_id: string; template_id: string }) => {
      const user_id = await requireUserId();
      const { data, error } = await supabase
        .from("client_needs_analyses")
        .insert({ ...input, user_id })
        .select()
        .single();
      if (error) throw error;
      return data as AnalysisRow;
    },
    onSuccess: (_data, variables) =>
      void qc.invalidateQueries({ queryKey: ["client-analyses", variables.client_id] }),
  });
}

export function useAnswers(analysisId?: string) {
  return useQuery({
    queryKey: ["needs-answers", analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("needs_analysis_answers")
        .select("*")
        .eq("analysis_id", analysisId!);
      if (error) throw error;
      return data as AnswerRow[];
    },
    enabled: Boolean(analysisId),
  });
}

export function useSaveAnswers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      analysisId,
      answers,
      complete,
    }: {
      analysisId: string;
      answers: Record<string, string>;
      complete?: boolean;
    }) => {
      const user_id = await requireUserId();
      const rows = Object.entries(answers).map(([question_id, value]) => ({
        analysis_id: analysisId,
        question_id,
        user_id,
        value,
      }));
      if (rows.length > 0) {
        const { error } = await supabase
          .from("needs_analysis_answers")
          .upsert(rows, { onConflict: "analysis_id,question_id" });
        if (error) throw error;
      }
      if (complete) {
        const { error } = await supabase
          .from("client_needs_analyses")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", analysisId);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["needs-answers", variables.analysisId] });
      void qc.invalidateQueries({ queryKey: ["client-analyses"] });
    },
  });
}
