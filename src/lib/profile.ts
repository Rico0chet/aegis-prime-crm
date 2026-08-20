import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type LicenseRow = Database["public"]["Tables"]["producer_licenses"]["Row"];

export type ProfilePatch = {
  full_name?: string | null;
  title?: string | null;
  agency?: string | null;
  phone?: string | null;
  bio?: string | null;
  license_number?: string | null;
  npn?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  surelc_url?: string | null;
  nipr_url?: string | null;
  avatar_url?: string | null;
};

export type LicenseInput = {
  id?: string;
  state: string;
  license_number: string;
  lines_of_authority?: string | null;
  issued_on?: string | null;
  expires_on?: string | null;
  is_active: boolean;
  notes?: string | null;
};

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user;
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const user = await requireUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProfileRow | null;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      const user = await requireUser();
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...patch }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** Avatars live in a private bucket, so render them through a short-lived signed URL. */
export function useAvatarUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["avatar-url", path],
    enabled: Boolean(path),
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const user = await requireUser();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: path }, { onConflict: "id" });
      if (error) throw error;
      return path;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useLicenses() {
  return useQuery({
    queryKey: ["producer-licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producer_licenses")
        .select("*")
        .order("state", { ascending: true });
      if (error) throw error;
      return data as LicenseRow[];
    },
  });
}

export function useSaveLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LicenseInput) => {
      const user = await requireUser();
      const { id, ...values } = input;
      if (id) {
        const { error } = await supabase.from("producer_licenses").update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("producer_licenses")
        .insert({ ...values, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["producer-licenses"] });
    },
  });
}

export function useDeleteLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("producer_licenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["producer-licenses"] });
    },
  });
}
