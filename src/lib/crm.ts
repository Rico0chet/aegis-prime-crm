import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type PolicyRow = Database["public"]["Tables"]["policies"]["Row"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ClientStatus = Database["public"]["Enums"]["client_status"];
export type PolicyStatus = Database["public"]["Enums"]["policy_status"];
export type ActivityType = Database["public"]["Enums"]["activity_type"];

export type PolicyWithClient = PolicyRow & {
  clients: { first_name: string; last_name: string } | null;
};

export const POLICY_STATUSES: PolicyStatus[] = [
  "quoted",
  "submitted",
  "underwriting",
  "medical_scheduled",
  "approved",
  "issued",
  "declined",
];

export const CLIENT_STATUSES: ClientStatus[] = ["prospect", "active", "inactive"];

export const ACTIVITY_TYPES: ActivityType[] = ["call", "email", "meeting", "note"];

export const policyStatusLabel: Record<PolicyStatus, string> = {
  quoted: "Quoted",
  submitted: "Submitted",
  underwriting: "Underwriting",
  medical_scheduled: "Medical Scheduled",
  approved: "Approved",
  issued: "Issued",
  declined: "Declined",
};

export const policyStatusStyle: Record<PolicyStatus, string> = {
  quoted: "bg-brand-surface text-brand-muted ring-1 ring-brand-border",
  submitted: "bg-brand-info-surface text-brand-info-foreground",
  underwriting: "bg-brand-warning-surface text-brand-warning-foreground",
  medical_scheduled: "bg-brand-info-surface text-brand-info-foreground",
  approved: "bg-brand-positive-surface text-brand-positive-foreground",
  issued: "bg-brand-positive-surface text-brand-positive-foreground",
  declined: "bg-brand-surface text-brand-muted ring-1 ring-brand-border",
};

export const clientStatusLabel: Record<ClientStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

export function initialsOf(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function formatCurrency(value: number | null | undefined, compact = false) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ---------------------------------- profile --------------------------------- */

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, agency, license_number")
        .eq("id", userData.user.id)
        .maybeSingle();
      return (
        data ?? {
          id: userData.user.id,
          full_name: (userData.user.email ?? "Producer").split("@")[0] ?? null,
          agency: null,
          license_number: null,
        }
      );
    },
  });
}

/* ---------------------------------- clients --------------------------------- */

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClientRow[];
    },
  });
}

export type NewClient = {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  status: ClientStatus;
  notes?: string | null;
};

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewClient) => {
      const user_id = await requireUserId();
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...input, user_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clients"] });
      void qc.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<NewClient> & { id: string }) => {
      const { error } = await supabase.from("clients").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clients"] });
      void qc.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

/* --------------------------------- policies --------------------------------- */

export function usePolicies() {
  return useQuery({
    queryKey: ["policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*, clients(first_name, last_name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as PolicyWithClient[];
    },
  });
}

export type NewPolicy = {
  client_id: string;
  carrier: string;
  product_type: string;
  policy_number?: string | null;
  face_amount?: number | null;
  annual_premium?: number | null;
  target_commission?: number | null;
  status: PolicyStatus;
  renewal_date?: string | null;
  notes?: string | null;
};

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewPolicy) => {
      const user_id = await requireUserId();
      const { data, error } = await supabase
        .from("policies")
        .insert({ ...input, user_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

export function useUpdatePolicyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PolicyStatus }) => {
      const { error } = await supabase.from("policies").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("policies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

/* ----------------------------------- tasks ---------------------------------- */

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("completed", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as TaskRow[];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; due_at?: string | null; client_id?: string | null }) => {
      const user_id = await requireUserId();
      const { error } = await supabase.from("tasks").insert({ ...input, user_id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/* --------------------------------- activities -------------------------------- */

export function useActivities(limit = 8) {
  return useQuery({
    queryKey: ["activities", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as ActivityRow[];
    },
  });
}

export function useLogActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      summary: string;
      type: ActivityType;
      client_id?: string | null;
      policy_id?: string | null;
    }) => {
      const user_id = await requireUserId();
      const { error } = await supabase.from("activities").insert({ ...input, user_id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
