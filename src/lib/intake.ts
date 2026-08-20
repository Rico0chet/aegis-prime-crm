import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type IntakeLinkRow = Database["public"]["Tables"]["intake_links"]["Row"];

export function intakeUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/intake/${token}`;
}

function generateToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

export function useIntakeLinks(enabled = true) {
  return useQuery({
    queryKey: ["intake-links"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as IntakeLinkRow[];
    },
  });
}

export function useCreateIntakeLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string | null) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("intake_links")
        .insert({ user_id: userData.user.id, token: generateToken(), label })
        .select()
        .single();
      if (error) throw error;
      return data as IntakeLinkRow;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["intake-links"] }),
  });
}

export function useSetIntakeLinkActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("intake_links").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["intake-links"] }),
  });
}

export function useDeleteIntakeLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("intake_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["intake-links"] }),
  });
}
