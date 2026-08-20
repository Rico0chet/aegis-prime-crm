import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getIntakeForm, submitIntakeForm } from "@/lib/intake.functions";

export const Route = createFileRoute("/intake/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New Client Intake | Aegis Prime" },
      {
        name: "description",
        content: "Share your contact details securely with your life insurance advisor to get started.",
      },
      { property: "og:title", content: "New Client Intake | Aegis Prime" },
      {
        property: "og:description",
        content: "Share your contact details securely with your life insurance advisor to get started.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntakePage,
});

function IntakePage() {
  const { token } = Route.useParams();
  const loadForm = useServerFn(getIntakeForm);
  const submit = useServerFn(submitIntakeForm);
  const [done, setDone] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["intake", token],
    queryFn: () => loadForm({ data: { token } }),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: (values: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      date_of_birth: string;
      notes: string;
    }) => submit({ data: { token, ...values } }),
    onSuccess: () => setDone(true),
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submitMutation.mutate({
      first_name: String(form.get("first_name") ?? ""),
      last_name: String(form.get("last_name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      date_of_birth: String(form.get("date_of_birth") ?? ""),
      notes: String(form.get("notes") ?? ""),
    });
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <div className="mb-8 flex items-center gap-3 text-brand-muted">
        <ShieldCheck className="size-5" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Secure client intake</span>
      </div>

      {isLoading && <p className="text-sm text-brand-muted">Loading form…</p>}

      {error && (
        <div className="rounded-xl border border-brand-border bg-brand-card p-8 text-center shadow-brand-card">
          <h1 className="text-lg font-semibold">This link isn't available</h1>
          <p className="mt-2 text-sm text-brand-muted">{(error as Error).message}</p>
        </div>
      )}

      {data && done && (
        <div className="rounded-xl border border-brand-border bg-brand-card p-10 text-center shadow-brand-card">
          <h1 className="text-xl font-semibold">Thank you — we've got your details</h1>
          <p className="mt-3 text-sm text-brand-muted">
            {data.advisorName} will be in touch with you shortly.
          </p>
        </div>
      )}

      {data && !done && (
        <div className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card sm:p-8">
          <h1 className="text-2xl font-semibold">Let's get you started</h1>
          <p className="mt-2 text-sm text-brand-muted">
            Share your details with {data.advisorName}
            {data.agency ? ` at ${data.agency}` : ""}. It only takes a minute.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" name="first_name" required />
              <Field label="Last name" name="last_name" required />
              <Field label="Email" name="email" type="email" />
              <Field label="Phone" name="phone" type="tel" />
              <Field label="Date of birth" name="date_of_birth" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">What are you looking for?</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                placeholder="Coverage goals, family situation, best time to reach you…"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Submitting…" : "Submit my details"}
            </Button>
          </form>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}
