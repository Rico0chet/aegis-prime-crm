import { assertProducerActive } from "@/lib/entitlement.server";
import type { Database } from "@/integrations/supabase/types";

type QuestionRow = Database["public"]["Tables"]["needs_analysis_questions"]["Row"];

export type PublicQuestion = {
  id: string;
  prompt: string;
  help_text: string | null;
  input_type: QuestionRow["input_type"];
  options: string[];
  is_required: boolean;
};

export type PublicInvite = {
  clientName: string;
  templateName: string;
  templateDescription: string | null;
  expiresAt: string;
  submittedAt: string | null;
  questions: PublicQuestion[];
  values: Record<string, string>;
};

export async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type LoadedInvite = {
  id: string;
  user_id: string;
  client_id: string;
  template_id: string;
  analysis_id: string | null;
  expires_at: string;
  opened_at: string | null;
  submitted_at: string | null;
  revoked_at: string | null;
};

export async function loadInvite(token: string): Promise<LoadedInvite> {
  if (!token || token.length < 16) throw new Error("This questionnaire link is not valid.");
  const supabaseAdmin = await getAdminClient();
  const { data, error } = await supabaseAdmin
    .from("needs_analysis_invites")
    .select("id, user_id, client_id, template_id, analysis_id, expires_at, opened_at, submitted_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("Invite lookup failed", error);
    throw new Error("This questionnaire link could not be opened.");
  }
  if (!data) throw new Error("This questionnaire link is not valid.");
  if (data.revoked_at) throw new Error("This questionnaire link has been cancelled.");
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("This questionnaire link has expired. Ask your advisor for a new one.");
  }
  await assertProducerActive(data.user_id);
  return data as LoadedInvite;
}

export function toPublicQuestions(rows: QuestionRow[]): PublicQuestion[] {
  return rows.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    help_text: question.help_text,
    input_type: question.input_type,
    options: Array.isArray(question.options) ? (question.options as unknown[]).map(String) : [],
    is_required: question.is_required,
  }));
}

/** Pull contact details out of the submitted answers so the client record stays current. */
export function contactPatchFromAnswers(
  questions: PublicQuestion[],
  values: Record<string, string>,
): { email?: string; phone?: string; date_of_birth?: string } {
  const patch: { email?: string; phone?: string; date_of_birth?: string } = {};
  for (const question of questions) {
    const value = (values[question.id] ?? "").trim();
    if (!value) continue;
    const prompt = question.prompt.toLowerCase();
    if (!patch.email && question.input_type !== "long_text" && /e-?mail/.test(prompt) && value.includes("@")) {
      patch.email = value;
    } else if (!patch.phone && /(phone|mobile|cell)/.test(prompt) && /\d{7}/.test(value.replace(/\D/g, ""))) {
      patch.phone = value;
    } else if (
      !patch.date_of_birth &&
      question.input_type === "date" &&
      /(date of birth|birth ?date|dob\b)/.test(prompt) &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      patch.date_of_birth = value;
    }
  }
  return patch;
}

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function safeHeader(value: string) {
  return value.replace(/[\r\n]/g, " ");
}

function encodeMessage(message: string) {
  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sendInviteEmail(input: {
  to: string;
  firstName: string;
  link: string;
  hours: number;
  advisorName: string;
}) {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const gmailApiKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableApiKey || !gmailApiKey) throw new Error("Email sending is not configured.");

  const profileResponse = await fetch(`${GATEWAY_URL}/users/me/profile`, {
    headers: { Authorization: `Bearer ${lovableApiKey}`, "X-Connection-Api-Key": gmailApiKey },
  });
  if (!profileResponse.ok) {
    console.error("Gmail profile lookup failed", await profileResponse.text());
    throw new Error("The connected email account could not be verified.");
  }
  const profile = (await profileResponse.json()) as { emailAddress?: string };
  if (!profile.emailAddress) throw new Error("The connected email account has no sender address.");

  const raw = [
    `To: ${safeHeader(input.to)}`,
    `From: ${safeHeader(profile.emailAddress)}`,
    `Subject: Your insurance needs analysis questionnaire`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    `Hi ${safeHeader(input.firstName)},`,
    "",
    "Please complete your confidential needs analysis using the secure link below.",
    "",
    input.link,
    "",
    `This link stays active for ${input.hours} hours.`,
    "",
    "Thank you,",
    safeHeader(input.advisorName),
  ].join("\r\n");

  const sendResponse = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": gmailApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodeMessage(raw) }),
  });
  if (!sendResponse.ok) {
    console.error("Invite email send failed", await sendResponse.text());
    throw new Error("The questionnaire email could not be sent.");
  }
}
