import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  optionsOf,
  useAnswers,
  useClientAnalyses,
  useCreateAnalysis,
  useQuestions,
  useSaveAnswers,
  useTemplates,
  type QuestionRow,
} from "@/lib/admin";

export function NeedsAnalysisDialog({
  clientId,
  clientName,
  trigger,
}: {
  clientId: string;
  clientName: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data: templates = [] } = useTemplates();
  const activeTemplates = useMemo(() => templates.filter((t) => t.is_active), [templates]);
  const { data: analyses = [] } = useClientAnalyses(open ? clientId : undefined);
  const existing = analyses[0];
  const [templateId, setTemplateId] = useState<string | undefined>();
  const currentTemplateId = existing?.template_id ?? templateId ?? activeTemplates[0]?.id;
  const { data: questions = [] } = useQuestions(open ? currentTemplateId : undefined);
  const { data: savedAnswers = [] } = useAnswers(existing?.id);
  const createAnalysis = useCreateAnalysis();
  const saveAnswers = useSaveAnswers();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(Object.fromEntries(savedAnswers.map((a) => [a.question_id, a.value ?? ""])));
  }, [savedAnswers]);

  async function handleSave() {
    if (!currentTemplateId) return;
    try {
      const analysisId =
        existing?.id ??
        (await createAnalysis.mutateAsync({ client_id: clientId, template_id: currentTemplateId })).id;
      await saveAnswers.mutateAsync({ analysisId, answers: values, complete: true });
      toast.success("Needs analysis saved");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save analysis");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Needs analysis — {clientName}</DialogTitle>
        </DialogHeader>

        {activeTemplates.length === 0 ? (
          <p className="text-sm text-brand-muted">
            No active needs-analysis templates. An admin can create one in the Admin Portal.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={currentTemplateId ?? ""}
                onValueChange={(value) => setTemplateId(value)}
                disabled={Boolean(existing)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {groupBySection(questions).map(([section, items]) => (
              <section key={section} className="space-y-4">
                {section && (
                  <h3 className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 text-xs font-semibold uppercase tracking-wide text-brand-accent backdrop-blur">
                    {section}
                  </h3>
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
            {questions.length === 0 && (
              <p className="text-sm text-brand-muted">This template has no questions yet.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={questions.length === 0 || saveAnswers.isPending || createAnalysis.isPending}
          >
            {saveAnswers.isPending || createAnalysis.isPending ? "Saving…" : "Save analysis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function groupBySection(questions: QuestionRow[]): [string, QuestionRow[]][] {
  const groups = new Map<string, QuestionRow[]>();
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
  question: QuestionRow;
  value: string;
  onChange: (value: string) => void;
  hideHelpText?: boolean;
}) {
  const options = optionsOf(question);
  const id = `q-${question.id}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {question.prompt}
        {question.is_required && <span className="ml-1 text-brand-accent">*</span>}
      </Label>
      {!hideHelpText && question.help_text && <p className="text-[11px] text-brand-muted">{question.help_text}</p>}

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
            {options.map((option) => (
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
