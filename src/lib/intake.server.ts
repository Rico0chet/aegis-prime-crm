import { assertProducerActive } from "@/lib/entitlement.server";
export type PublicIntake = {
  advisorName: string;
  agency: string | null;
  label: string | null;
};

export async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type LoadedIntakeLink = {
  id: string;
  user_id: string;
  label: string | null;
  is_active: boolean;
  submission_count: number;
};

export async function loadIntakeLink(token: string): Promise<LoadedIntakeLink> {
  if (!token || token.length < 16) throw new Error("This intake link is not valid.");
  const supabaseAdmin = await getAdminClient();
  const { data, error } = await supabaseAdmin
    .from("intake_links")
    .select("id, user_id, label, is_active, submission_count")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("Intake link lookup failed", error);
    throw new Error("This intake link could not be opened.");
  }
  if (!data) throw new Error("This intake link is not valid.");
  if (!data.is_active) throw new Error("This intake link is no longer accepting submissions.");
  await assertProducerActive(data.user_id);
  return data as LoadedIntakeLink;
}

export function cleanText(value: unknown, max = 500) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanNotes(value: unknown) {
  return String(value ?? "").trim().slice(0, 4000);
}
