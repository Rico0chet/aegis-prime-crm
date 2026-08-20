import { supabase } from "@/integrations/supabase/client";

export type ExportDataset =
  | "clients"
  | "policies"
  | "tasks"
  | "activities"
  | "templates"
  | "questions"
  | "analyses"
  | "answers";

export const EXPORT_DATASETS: { id: ExportDataset; label: string; description: string }[] = [
  { id: "clients", label: "Clients", description: "Registry with contact, status and birthday settings" },
  { id: "policies", label: "Policies", description: "Applications and in-force policies per client" },
  { id: "tasks", label: "Follow-ups", description: "Tasks with due dates and completion" },
  { id: "activities", label: "Activities", description: "Logged calls, emails, meetings and notes" },
  { id: "templates", label: "Needs analysis templates", description: "Template catalogue" },
  { id: "questions", label: "Needs analysis questions", description: "Every question with type and options" },
  { id: "analyses", label: "Client analyses", description: "Which template was run for which client" },
  { id: "answers", label: "Analysis answers", description: "Question-by-question responses per client" },
];

type Row = Record<string, string | number | boolean | null>;

function clientName(c?: { first_name: string; last_name: string } | null) {
  return c ? `${c.first_name} ${c.last_name}`.trim() : "";
}

async function fetchAll<T>(build: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await build();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function buildExportSheets(selected: ExportDataset[]) {
  const sheets: { name: string; rows: Row[] }[] = [];

  const clients = await fetchAll(() =>
    supabase.from("clients").select("*").order("last_name", { ascending: true }),
  );
  const clientById = new Map(clients.map((c) => [c.id, c]));

  if (selected.includes("clients")) {
    sheets.push({
      name: "Clients",
      rows: clients.map((c) => ({
        "First name": c.first_name,
        "Last name": c.last_name,
        Email: c.email,
        Phone: c.phone,
        "Date of birth": c.date_of_birth,
        Status: c.status,
        "Birthday emails": c.birthday_email_enabled ? "Enabled" : "Disabled",
        "Last birthday email year": c.birthday_email_last_sent_year,
        Notes: c.notes,
        Created: c.created_at,
      })),
    });
  }

  if (selected.includes("policies")) {
    const policies = await fetchAll(() =>
      supabase.from("policies").select("*").order("created_at", { ascending: false }),
    );
    sheets.push({
      name: "Policies",
      rows: policies.map((p) => ({
        Client: clientName(clientById.get(p.client_id)),
        Carrier: p.carrier,
        "Product type": p.product_type,
        "Policy number": p.policy_number,
        "Face amount": p.face_amount,
        "Annual premium": p.annual_premium,
        "Target commission": p.target_commission,
        Status: p.status,
        "Application date": p.application_date,
        "Issue date": p.issue_date,
        "Renewal date": p.renewal_date,
        Notes: p.notes,
      })),
    });
  }

  if (selected.includes("tasks")) {
    const tasks = await fetchAll(() =>
      supabase.from("tasks").select("*").order("due_at", { ascending: true }),
    );
    sheets.push({
      name: "Follow-ups",
      rows: tasks.map((t) => ({
        Title: t.title,
        Client: clientName(t.client_id ? clientById.get(t.client_id) : null),
        Due: t.due_at,
        Completed: t.completed ? "Yes" : "No",
        Created: t.created_at,
      })),
    });
  }

  if (selected.includes("activities")) {
    const activities = await fetchAll(() =>
      supabase.from("activities").select("*").order("occurred_at", { ascending: false }),
    );
    sheets.push({
      name: "Activities",
      rows: activities.map((a) => ({
        Client: clientName(a.client_id ? clientById.get(a.client_id) : null),
        Type: a.type,
        Summary: a.summary,
        Occurred: a.occurred_at,
      })),
    });
  }

  const needsTemplates =
    selected.includes("templates") ||
    selected.includes("questions") ||
    selected.includes("analyses") ||
    selected.includes("answers");

  const templates = needsTemplates
    ? await fetchAll(() =>
        supabase.from("needs_analysis_templates").select("*").order("sort_order", { ascending: true }),
      )
    : [];
  const templateById = new Map(templates.map((t) => [t.id, t]));

  if (selected.includes("templates")) {
    sheets.push({
      name: "Templates",
      rows: templates.map((t) => ({
        Name: t.name,
        Description: t.description,
        "Product type": t.product_type,
        Active: t.is_active ? "Yes" : "No",
        Order: t.sort_order,
      })),
    });
  }

  const needsQuestions = selected.includes("questions") || selected.includes("answers");
  const questions = needsQuestions
    ? await fetchAll(() =>
        supabase
          .from("needs_analysis_questions")
          .select("*")
          .order("template_id", { ascending: true })
          .order("sort_order", { ascending: true }),
      )
    : [];
  const questionById = new Map(questions.map((q) => [q.id, q]));

  if (selected.includes("questions")) {
    sheets.push({
      name: "Questions",
      rows: questions.map((q) => ({
        Template: templateById.get(q.template_id)?.name ?? "",
        Section: q.help_text,
        Prompt: q.prompt,
        Type: q.input_type,
        Required: q.is_required ? "Yes" : "No",
        Options: Array.isArray(q.options) ? (q.options as unknown[]).map(String).join(" | ") : "",
        Order: q.sort_order,
      })),
    });
  }

  const needsAnalyses = selected.includes("analyses") || selected.includes("answers");
  const analyses = needsAnalyses
    ? await fetchAll(() =>
        supabase.from("client_needs_analyses").select("*").order("created_at", { ascending: false }),
      )
    : [];
  const analysisById = new Map(analyses.map((a) => [a.id, a]));

  if (selected.includes("analyses")) {
    sheets.push({
      name: "Client analyses",
      rows: analyses.map((a) => ({
        Client: clientName(clientById.get(a.client_id)),
        Template: templateById.get(a.template_id)?.name ?? "",
        Notes: a.notes,
        Completed: a.completed_at,
        Created: a.created_at,
        Updated: a.updated_at,
      })),
    });
  }

  if (selected.includes("answers")) {
    const answers = await fetchAll(() => supabase.from("needs_analysis_answers").select("*"));
    sheets.push({
      name: "Analysis answers",
      rows: answers
        .map((ans) => {
          const analysis = analysisById.get(ans.analysis_id);
          const question = questionById.get(ans.question_id);
          return {
            Client: analysis ? clientName(clientById.get(analysis.client_id)) : "",
            Template: analysis ? (templateById.get(analysis.template_id)?.name ?? "") : "",
            Section: question?.help_text ?? "",
            Prompt: question?.prompt ?? "",
            Answer: ans.value,
            Updated: ans.updated_at,
            _sort: question?.sort_order ?? 0,
          } as Row & { _sort: number };
        })
        .sort((a, b) => String(a.Client).localeCompare(String(b.Client)) || a._sort - b._sort)
        .map(({ _sort: _ignored, ...rest }) => rest),
    });
  }

  return sheets;
}

export async function downloadCrmWorkbook(selected: ExportDataset[]) {
  const XLSX = await import("xlsx");
  const sheets = await buildExportSheets(selected);
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const rows = sheet.rows.length ? sheet.rows : [{ "No records": "" }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0] ?? {});
    worksheet["!cols"] = headers.map((header) => {
      const widest = rows.reduce(
        (max, row) => Math.max(max, String(row[header] ?? "").length),
        header.length,
      );
      return { wch: Math.min(Math.max(widest + 2, 10), 60) };
    });
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `aegis-prime-export-${stamp}.xlsx`);
  return sheets.map((s) => ({ name: s.name, count: s.rows.length }));
}
