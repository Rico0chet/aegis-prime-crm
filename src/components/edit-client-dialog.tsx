import { useState, type ReactNode } from "react";
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
  CLIENT_STATUSES,
  clientStatusLabel,
  useUpdateClient,
  type ClientRow,
  type ClientStatus,
} from "@/lib/crm";

export function EditClientDialog({
  client,
  trigger,
}: {
  client: ClientRow;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ClientStatus>(client.status);
  const updateClient = useUpdateClient();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setStatus(client.status);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const first_name = String(form.get("first_name") ?? "").trim();
    const last_name = String(form.get("last_name") ?? "").trim();
    if (!first_name || !last_name) return;

    updateClient.mutate(
      {
        id: client.id,
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
          toast.success("Client updated");
          setOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Edit {client.first_name} {client.last_name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <EditField label="First name" name="first_name" defaultValue={client.first_name} required />
            <EditField label="Last name" name="last_name" defaultValue={client.last_name} required />
            <EditField label="Email" name="email" type="email" defaultValue={client.email ?? ""} />
            <EditField label="Phone" name="phone" defaultValue={client.phone ?? ""} />
            <EditField
              label="Date of birth"
              name="date_of_birth"
              type="date"
              defaultValue={client.date_of_birth ?? ""}
            />
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
            <Label htmlFor={`notes-${client.id}`}>Notes</Label>
            <Textarea
              id={`notes-${client.id}`}
              name="notes"
              rows={3}
              defaultValue={client.notes ?? ""}
              placeholder="Coverage goals, family situation, referrals…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateClient.isPending}>
              {updateClient.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditField({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${name}-edit`}>{label}</Label>
      <Input id={`${name}-edit`} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}
