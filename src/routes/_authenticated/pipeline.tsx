import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
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
import {
  POLICY_STATUSES,
  formatCurrency,
  formatDate,
  policyStatusLabel,
  policyStatusStyle,
  useClients,
  useCreatePolicy,
  useDeletePolicy,
  usePolicies,
  useUpdatePolicyStatus,
  type PolicyStatus,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Policy Pipeline | Aegis Prime Producer CRM" },
      {
        name: "description",
        content: "Track every life insurance application from quote through underwriting to issue, with carrier and premium detail.",
      },
      { property: "og:title", content: "Policy Pipeline | Aegis Prime Producer CRM" },
      {
        property: "og:description",
        content: "Track every life insurance application from quote through underwriting to issue, with carrier and premium detail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const { data: policies = [], isLoading } = usePolicies();
  const { data: clients = [] } = useClients();
  const createPolicy = useCreatePolicy();
  const updateStatus = useUpdatePolicyStatus();
  const deletePolicy = useDeletePolicy();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<PolicyStatus | "all">("all");
  const [clientId, setClientId] = useState<string>("");
  const [status, setStatus] = useState<PolicyStatus>("quoted");

  const visible = filter === "all" ? policies : policies.filter((p) => p.status === filter);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId) {
      toast.error("Select a client first");
      return;
    }
    const form = new FormData(event.currentTarget);
    const num = (key: string) => {
      const raw = String(form.get(key) ?? "").trim();
      return raw ? Number(raw) : null;
    };
    createPolicy.mutate(
      {
        client_id: clientId,
        carrier: String(form.get("carrier") ?? "").trim(),
        product_type: String(form.get("product_type") ?? "").trim(),
        policy_number: String(form.get("policy_number") ?? "").trim() || null,
        face_amount: num("face_amount"),
        annual_premium: num("annual_premium"),
        target_commission: num("target_commission"),
        renewal_date: String(form.get("renewal_date") ?? "") || null,
        status,
      },
      {
        onSuccess: () => {
          toast.success("Application logged");
          setOpen(false);
          setClientId("");
          setStatus("quoted");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <AppShell
      title="Policy Pipeline"
      eyebrow={`${policies.length} application${policies.length === 1 ? "" : "s"}`}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-strong">
              <Plus />
              <span className="hidden sm:inline">New Application</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New application</DialogTitle>
            </DialogHeader>
            {clients.length === 0 ? (
              <div className="space-y-4 py-4 text-sm text-brand-muted">
                <p>Add a client before logging an application.</p>
                <Button asChild>
                  <Link to="/clients">Go to Client Registry</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.first_name} {client.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Carrier" name="carrier" required />
                  <Field label="Product type" name="product_type" required placeholder="Term 20, IUL, Whole Life" />
                  <Field label="Face amount" name="face_amount" type="number" />
                  <Field label="Annual premium" name="annual_premium" type="number" />
                  <Field label="Target commission" name="target_commission" type="number" />
                  <Field label="Renewal date" name="renewal_date" type="date" />
                  <Field label="Policy number" name="policy_number" />
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as PolicyStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLICY_STATUSES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {policyStatusLabel[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createPolicy.isPending}>
                    {createPolicy.isPending ? "Saving…" : "Log application"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-brand-card p-1 ring-1 ring-brand-border">
        {(["all", ...POLICY_STATUSES] as const).map((option) => (
          <Button
            key={option}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2.5 text-[10px] text-brand-muted hover:text-brand-ink",
              filter === option && "bg-brand-surface font-semibold text-brand-ink",
            )}
            onClick={() => setFilter(option)}
          >
            {option === "all" ? "All" : policyStatusLabel[option]}
          </Button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-brand-card">
        <div className="divide-y divide-brand-border">
          {visible.map((policy) => (
            <div key={policy.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {policy.clients ? `${policy.clients.first_name} ${policy.clients.last_name}` : "Unassigned"}
                </p>
                <p className="mt-1 truncate text-[11px] text-brand-muted">
                  {policy.carrier} • {policy.product_type} • {formatCurrency(policy.face_amount ? Number(policy.face_amount) : null, true)} face •{" "}
                  {formatCurrency(policy.annual_premium ? Number(policy.annual_premium) : null)}/yr
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={cn(
                    "hidden rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide sm:inline-flex",
                    policyStatusStyle[policy.status],
                  )}
                >
                  {policyStatusLabel[policy.status]}
                </span>
                <Select
                  value={policy.status}
                  onValueChange={(value) =>
                    updateStatus.mutate(
                      { id: policy.id, status: value as PolicyStatus },
                      {
                        onSuccess: () => toast.success("Stage updated"),
                        onError: (error) => toast.error(error.message),
                      },
                    )
                  }
                >
                  <SelectTrigger className="h-9 w-[170px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_STATUSES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {policyStatusLabel[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete application"
                  onClick={() =>
                    deletePolicy.mutate(policy.id, {
                      onSuccess: () => toast.success("Application removed"),
                      onError: (error) => toast.error(error.message),
                    })
                  }
                >
                  <Trash2 className="size-4 text-brand-muted" />
                </Button>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <div className="px-6 py-14 text-center text-sm text-brand-muted">
              {isLoading ? "Loading pipeline…" : "No applications in this stage."}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-brand-muted">
        Last updated {policies[0] ? formatDate(policies[0].updated_at) : "—"}
      </p>
    </AppShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} />
    </div>
  );
}
