import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  contactPatchFromAnswers,
  getAdminClient,
  loadInvite,
  sendInviteEmail,
  toPublicQuestions,
  type PublicInvite,
} from "@/lib/invites.server";

export const getInviteQuestionnaire = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => ({ token: String(input.token ?? "") }))
  .handler(async ({ data }): Promise<PublicInvite> => {
    const invite = await loadInvite(data.token);
    const supabaseAdmin = await getAdminClient();

    const [clientResult, templateResult, questionResult] = await Promise.all([
      supabaseAdmin.from("clients").select("first_name, last_name").eq("id", invite.client_id).maybeSingle(),
      supabaseAdmin
        .from("needs_analysis_templates")
        .select("name, description")
        .eq("id", invite.template_id)
        .maybeSingle(),
      supabaseAdmin
        .from("needs_analysis_questions")
        .select("*")
        .eq("template_id", invite.template_id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    if (questionResult.error) throw new Error("The questionnaire could not be loaded.");

    let values: Record<string, string> = {};
    if (invite.analysis_id) {
      const { data: answers } = await supabaseAdmin
        .from("needs_analysis_answers")
        .select("question_id, value")
        .eq("analysis_id", invite.analysis_id);
      values = Object.fromEntries((answers ?? []).map((a) => [a.question_id, a.value ?? ""]));
    }

    if (!invite.opened_at) {
      await supabaseAdmin
        .from("needs_analysis_invites")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", invite.id)
        .is("opened_at", null);
    }

    return {
      clientName: clientResult.data
        ? `${clientResult.data.first_name} ${clientResult.data.last_name}`
        : "Client",
      templateName: templateResult.data?.name ?? "Needs analysis",
      templateDescription: templateResult.data?.description ?? null,
      expiresAt: invite.expires_at,
      submittedAt: invite.submitted_at,
      questions: toPublicQuestions(questionResult.data ?? []),
      values,
    };
  });

export const submitInviteQuestionnaire = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; values: Record<string, string> }) => ({
    token: String(input.token ?? ""),
    values: input.values ?? {},
  }))
  .handler(async ({ data }) => {
    const invite = await loadInvite(data.token);
    if (invite.submitted_at) throw new Error("This questionnaire has already been submitted.");
    const supabaseAdmin = await getAdminClient();

    const { data: questionRows, error: questionError } = await supabaseAdmin
      .from("needs_analysis_questions")
      .select("*")
      .eq("template_id", invite.template_id);
    if (questionError) throw new Error("The questionnaire could not be saved.");
    const questions = toPublicQuestions(questionRows ?? []);
    const allowed = new Set(questions.map((q) => q.id));

    let analysisId = invite.analysis_id;
    if (!analysisId) {
      const { data: analysis, error } = await supabaseAdmin
        .from("client_needs_analyses")
        .insert({
          user_id: invite.user_id,
          client_id: invite.client_id,
          template_id: invite.template_id,
        })
        .select("id")
        .single();
      if (error) throw new Error("The questionnaire could not be saved.");
      analysisId = analysis.id;
    }

    const rows = Object.entries(data.values)
      .filter(([questionId]) => allowed.has(questionId))
      .map(([questionId, value]) => ({
        analysis_id: analysisId as string,
        question_id: questionId,
        user_id: invite.user_id,
        value: String(value ?? "").slice(0, 5000),
      }));

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from("needs_analysis_answers")
        .upsert(rows, { onConflict: "analysis_id,question_id" });
      if (error) throw new Error("The questionnaire could not be saved.");
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("client_needs_analyses")
      .update({ completed_at: now })
      .eq("id", analysisId as string);

    const patch = contactPatchFromAnswers(questions, data.values);
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("clients").update(patch).eq("id", invite.client_id);
    }

    await supabaseAdmin
      .from("needs_analysis_invites")
      .update({ submitted_at: now, analysis_id: analysisId })
      .eq("id", invite.id);

    return { ok: true as const };
  });

export const emailInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string; link: string }) => ({
    inviteId: String(input.inviteId ?? ""),
    link: String(input.link ?? ""),
  }))
  .handler(async ({ data, context }) => {
    if (!/^https?:\/\//.test(data.link)) throw new Error("Invalid questionnaire link.");

    const { data: invite, error } = await context.supabase
      .from("needs_analysis_invites")
      .select("id, client_id, expires_at, created_at")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (error || !invite) throw new Error("Questionnaire link not found.");

    const [{ data: client }, { data: profile }] = await Promise.all([
      context.supabase
        .from("clients")
        .select("first_name, email")
        .eq("id", invite.client_id)
        .maybeSingle(),
      context.supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
    ]);

    if (!client?.email) throw new Error("This client has no email address on file.");

    const hours = Math.round(
      (new Date(invite.expires_at).getTime() - new Date(invite.created_at).getTime()) / 3600000,
    );

    await sendInviteEmail({
      to: client.email,
      firstName: client.first_name,
      link: data.link,
      hours,
      advisorName: profile?.full_name ?? "Your insurance advisor",
    });

    return { ok: true as const };
  });
