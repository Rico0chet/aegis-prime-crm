import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import {
  CLIENT_STATUSES,
  clientStatusLabel,
  formatDate,
  initialsOf,
  useClients,
  useCreateClient,
  useDeleteClient,
  type ClientStatus,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Client Registry | Aegis Prime Producer CRM" },
      {
        name: "description",
        content: "Maintain prospect and policyholder records with contact details, status, and producer notes.",
      },
      { property: "og:title", content: "Client Registry | Aegis Prime Producer CRM" },
      {
        property: "og:description",
        content: "Maintain prospect and policyholder records with contact details, status, and producer notes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ClientStatus>("prospect");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const first_name = String(form.get("first_name") ?? "").trim();
    const last_name = String(form.get("last_name") ?? "").trim();
    if (!first_name || !last_name) return;
    createClient.mutate(
      {
        first_name,
        last_name,
        email: String(form.get("email") ?? "").trim() || null,
        phone: String(form.get("phone") ?? "").trim() || null,
        date_of_birth: String(form.get("date_of_birth") ?? "") || null,
        notes: String(form.get("notes") ?? "").trim() || null,
        status,
      },
      {
        onSuccess: () => {
          toast.success("Client added");
          setOpen(false);
          setStatus("prospect");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <AppShell
      title="Client Registry"
      eyebrow={`${clients.length} record${clients.length === 1 ? "" : "s"}`}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-strong">
              <Plus />
              <span className="hidden sm:inline">Add Client</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" name="first_name" required />
                <Field label="Last name" name="last_name" required />
                <Field label="Email" name="email" type="email" />
                <Field label="Phone" name="phone" />
                <Field label="Date of birth" name="date_of_birth" type="date" />
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as ClientStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_STATUSES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {clientStatusLabel[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} placeholder="Coverage goals, family situation, referrals…" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createClient.isPending}>
                  {createClient.isPending ? "Saving…" : "Save client"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-brand-card">
        <div className="divide-y divide-brand-border">
          {clients.map((client) => (
            <div key={client.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-surface text-xs font-bold text-brand-muted ring-1 ring-brand-border">
                  {initialsOf(client.first_name, client.last_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {client.first_name} {client.last_name}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-brand-muted">
                    {client.email ?? "No email"} • {client.phone ?? "No phone"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <span className="inline-flex rounded-full bg-brand-surface px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-brand-muted ring-1 ring-brand-border">
                    {clientStatusLabel[client.status]}
                  </span>
                  <p className="mt-1 text-[10px] text-brand-muted">Added {formatDate(client.created_at)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${client.first_name} ${client.last_name}`}
                  onClick={() =>
                    deleteClient.mutate(client.id, {
                      onSuccess: () => toast.success("Client removed"),
                      onError: (error) => toast.error(error.message),
                    })
                  }
                >
                  <Trash2 className="size-4 text-brand-muted" />
                </Button>
              </div>
            </div>
          ))}
          {clients.length === 0 && (
            <div className="px-6 py-14 text-center text-sm text-brand-muted">
              {isLoading ? "Loading clients…" : "No clients yet. Add your first prospect to get started."}
            </div>
          )}
        </div>
      </div>
    </AppShell>
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
