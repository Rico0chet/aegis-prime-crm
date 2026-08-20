import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getInviteQuestionnaire, submitInviteQuestionnaire } from "@/lib/invites.functions";
import type { PublicQuestion } from "@/lib/invites.server";

export const Route = createFileRoute("/questionnaire/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your Needs Analysis | Aegis Prime" },
      {
        name: "description",
        content: "Securely complete your confidential life insurance needs analysis questionnaire.",
      },
      { property: "og:title", content: "Your Needs Analysis | Aegis Prime" },
      {
        property: "og:description",
        content: "Securely complete your confidential life insurance needs analysis questionnaire.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuestionnairePage,
});

function QuestionnairePage() {
  const { token } = Route.useParams();
  const loadInvite = useServerFn(getInviteQuestionnaire);
  const submit = useServerFn(submitInviteQuestionnaire);
  const [values, setValues] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["questionnaire", token],
    queryFn: () => loadInvite({ data: { token } }),
    retry: false,
  });

  useEffect(() => {
    if (data) setValues(data.values);
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: () => submit({ data: { token, values } }),
    onSuccess: () => {
      setDone(true);
      toast.success("Thank you — your answers were submitted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <Shell><p className="text-sm text-brand-muted">Loading your questionnaire…</p></Shell>;
  }

  if (error || !data) {
    return (
      <Shell>
        <h1 className="font-display text-2xl">Link unavailable</h1>
        <p className="mt-2 text-sm text-brand-muted">
          {error instanceof Error ? error.message : "This questionnaire link is not valid."}
        </p>
      </Shell>
    );
  }

  if (done || data.submittedAt) {
    return (
      <Shell>
        <h1 className="font-display text-2xl">Questionnaire received</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Thank you, {data.clientName}. Your advisor has your answers and will follow up shortly.
        </p>
      </Shell>
    );
  }

  const missingRequired = data.questions.some(
    (question) => question.is_required && !(values[question.id] ?? "").trim(),
  );

  return (
    <Shell>
      <header className="space-y-2 border-b border-brand-border pb-6">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
          <ShieldCheck className="size-4" /> Confidential
        </p>
        <h1 className="font-display text-3xl">{data.templateName}</h1>
        <p className="text-sm text-brand-muted">
          Prepared for {data.clientName}. This link expires {new Date(data.expiresAt).toLocaleString()}.
        </p>
        {data.templateDescription && (
          <p className="text-sm text-brand-muted">{data.templateDescription}</p>
        )}
      </header>

      <div className="space-y-6 py-6">
        {groupBySection(data.questions).map(([section, items]) => (
          <section key={section} className="space-y-4">
            {section && (
              <h2 className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 text-xs font-semibold uppercase tracking-wide text-brand-accent backdrop-blur">
                {section}
              </h2>
            )}
            {items.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                hideHelpText={Boolean(section)}
                value={values[question.id] ?? ""}
                onChange={(value) => setValues((prev) => ({ ...prev, [question.id]: value }))}
              />
            ))}
          </section>
        ))}
        {data.questions.length === 0 && (
          <p className="text-sm text-brand-muted">This questionnaire has no questions yet.</p>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-brand-border bg-background/95 py-4 backdrop-blur">
        <Button
          className="w-full"
          disabled={submitMutation.isPending || data.questions.length === 0 || missingRequired}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? "Submitting…" : "Submit questionnaire"}
        </Button>
        {missingRequired && (
          <p className="mt-2 text-center text-[11px] text-brand-muted">
            Please answer all required questions marked with *.
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-10">{children}</main>
  );
}

function groupBySection(questions: PublicQuestion[]): [string, PublicQuestion[]][] {
  const groups = new Map<string, PublicQuestion[]>();
  for (const question of questions) {
    const key = question.help_text?.trim() ?? "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(question);
    else groups.set(key, [question]);
  }
  return [...groups.entries()];
}

function QuestionField({
  question,
  value,
  onChange,
  hideHelpText,
}: {
  question: PublicQuestion;
  value: string;
  onChange: (value: string) => void;
  hideHelpText?: boolean;
}) {
  const id = `q-${question.id}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {question.prompt}
        {question.is_required && <span className="ml-1 text-brand-accent">*</span>}
      </Label>
      {!hideHelpText && question.help_text && (
        <p className="text-[11px] text-brand-muted">{question.help_text}</p>
      )}
      {question.input_type === "long_text" ? (
        <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : question.input_type === "yes_no" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Yes">Yes</SelectItem>
            <SelectItem value="No">No</SelectItem>
          </SelectContent>
        </Select>
      ) : question.input_type === "single_select" || question.input_type === "multi_select" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {question.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={
            question.input_type === "date"
              ? "date"
              : question.input_type === "number" || question.input_type === "currency"
                ? "number"
                : "text"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
