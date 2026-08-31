/**
 * Server-side entitlement checks for producer-owned public surfaces
 * (booking pages, intake links, questionnaire invites).
 *
 * A producer who is out of trial with no active subscription keeps read access
 * to their own data, but their client-facing links stop working.
 */

export async function producerHasAccess(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("producer_has_access", { user_uuid: userId });
  if (error) {
    console.error("producer_has_access check failed", error);
    // Fail open on infrastructure errors so paying producers are never locked out.
    return true;
  }
  return Boolean(data);
}

export const INACTIVE_PRODUCER_MESSAGE =
  "This link is temporarily unavailable. Please contact your insurance advisor directly.";

export async function assertProducerActive(userId: string): Promise<void> {
  if (!(await producerHasAccess(userId))) {
    throw new Error(INACTIVE_PRODUCER_MESSAGE);
  }
}
