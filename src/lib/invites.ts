import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type InviteRow = Database["public"]["Tables"]["needs_analysis_invites"]["Row"];

export const INVITE_DURATIONS = [48, 72] as const;
export type InviteDuration = (typeof INVITE_DURATIONS)[number];

export function inviteUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/questionnaire/${token}`;
}

export function inviteState(invite: InviteRow): "submitted" | "revoked" | "expired" | "active" {
  if (invite.submitted_at) return "submitted";
  if (invite.revoked_at) return "revoked";
  if (new Date(invite.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

function generateToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

export function useClientInvites(clientId?: string) {
  return useQuery({
    queryKey: ["invites", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("needs_analysis_invites")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InviteRow[];
    },
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      templateId,
      hours,
    }: {
      clientId: string;
      templateId: string;
      hours: InviteDuration;
    }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not signed in");
      const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("needs_analysis_invites")
        .insert({
          user_id: userData.user.id,
          client_id: clientId,
          template_id: templateId,
          token: generateToken(),
          expires_at: expiresAt,
        })
        .select()
        .single();
      if (error) throw error;
      return data as InviteRow;
    },
    onSuccess: (invite) => void qc.invalidateQueries({ queryKey: ["invites", invite.client_id] }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invite: InviteRow) => {
      const { error } = await supabase
        .from("needs_analysis_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", invite.id);
      if (error) throw error;
      return invite;
    },
    onSuccess: (invite) => void qc.invalidateQueries({ queryKey: ["invites", invite.client_id] }),
  });
}
