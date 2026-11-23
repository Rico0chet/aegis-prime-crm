import { createServerFn } from "@tanstack/react-start";

import {
  cleanNotes,
  cleanText,
  getAdminClient,
  loadIntakeLink,
  type PublicIntake,
} from "@/lib/intake.server";

export const getIntakeForm = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => ({ token: String(input.token ?? "") }))
  .handler(async ({ data }): Promise<PublicIntake> => {
    const link = await loadIntakeLink(data.token);
    const supabaseAdmin = await getAdminClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, agency")
      .eq("id", link.user_id)
      .maybeSingle();

    let questions: PublicIntake["questions"] = [];
    if (link.template_id) {
      const { data: qs } = await supabaseAdmin
        .from("needs_analysis_questions")
        .select("*")
        .eq("template_id", link.template_id)
        .order("sort_order");
      questions = (qs ?? []) as PublicIntake["questions"];
    }

    return {
      questions,
      advisorName: profile?.full_name ?? "Your insurance advisor",
      agency: profile?.agency ?? null,
      label: link.label,
    };
  });

export const submitIntakeForm = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      date_of_birth: string;
      notes: string;
      answers?: Record<string, string>;
    }) => ({
      answers: Object.fromEntries(
        Object.entries(input.answers ?? {})
          .slice(0, 1000)
          .map(([k, v]) => [String(k), cleanNotes(v)] as [string, string])
          .filter(([, v]) => v),
      ),
      token: String(input.token ?? ""),
      first_name: cleanText(input.first_name, 80),
      last_name: cleanText(input.last_name, 80),
      email: cleanText(input.email, 160),
      phone: cleanText(input.phone, 40),
      date_of_birth: cleanText(input.date_of_birth, 10),
      notes: cleanNotes(input.notes),
    }),
  )
  .handler(async ({ data }) => {
    const link = await loadIntakeLink(data.token);
    if (!data.first_name || !data.last_name) throw new Error("Please enter your first and last name.");
    if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
      throw new Error("Please enter a valid email address.");
    }
    const dob = /^\d{4}-\d{2}-\d{2}$/.test(data.date_of_birth) ? data.date_of_birth : null;

    const supabaseAdmin = await getAdminClient();
    const { data: client, error } = await supabaseAdmin.from("clients").insert({
      user_id: link.user_id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      date_of_birth: dob,
      notes: data.notes || null,
      status: "prospect",
    }).select("id").single();
    if (error) {
      console.error("Intake submission failed", error);
      throw new Error("We couldn't submit your details. Please try again.");
    }

    if (link.template_id && client && Object.keys(data.answers).length > 0) {
      const { data: qs } = await supabaseAdmin
        .from("needs_analysis_questions")
        .select("id")
        .eq("template_id", link.template_id);
      const valid = new Set((qs ?? []).map((q) => q.id));
      const { data: analysis, error: aErr } = await supabaseAdmin
        .from("client_needs_analyses")
        .insert({
          user_id: link.user_id,
          client_id: client.id,
          template_id: link.template_id,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (aErr) console.error("Intake analysis create failed", aErr);
      const rows = Object.entries(data.answers)
        .filter(([qid]) => valid.has(qid))
        .map(([question_id, value]) => ({ analysis_id: analysis!.id, question_id, user_id: link.user_id, value }));
      if (analysis && rows.length) {
        const { error: ansErr } = await supabaseAdmin.from("needs_analysis_answers").insert(rows);
        if (ansErr) console.error("Intake answers save failed", ansErr);
      }
    }

    await supabaseAdmin
      .from("intake_links")
      .update({ submission_count: link.submission_count + 1 })
      .eq("id", link.id);

    return { ok: true as const };
  });
