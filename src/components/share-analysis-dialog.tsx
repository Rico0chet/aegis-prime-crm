import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Link2, Mail, Ban } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useTemplates } from "@/lib/admin";
import { emailInviteLink } from "@/lib/invites.functions";
import {
  INVITE_DURATIONS,
  inviteState,
  inviteUrl,
  useClientInvites,
  useCreateInvite,
  useRevokeInvite,
  type InviteDuration,
} from "@/lib/invites";
import { formatDate } from "@/lib/crm";

export function ShareAnalysisDialog({
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
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [hours, setHours] = useState<InviteDuration>(48);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: invites = [] } = useClientInvites(open ? clientId : undefined);
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const sendEmail = useServerFn(emailInviteLink);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const currentTemplateId = templateId ?? activeTemplates[0]?.id;

  async function handleCreate() {
    if (!currentTemplateId) return;
    try {
      await createInvite.mutateAsync({ clientId, templateId: currentTemplateId, hours });
      toast.success(`Link created — active for ${hours} hours`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create link");
    }
  }

  async function handleCopy(id: string, token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function handleEmail(id: string, token: string) {
    setSendingId(id);
    try {
      await sendEmail({ data: { inviteId: id, link: inviteUrl(token) } });
      toast.success("Questionnaire emailed to the client");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the email");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send questionnaire — {clientName}</DialogTitle>
          <DialogDescription>
            Create a secure link the client can use to complete their own needs analysis. Answers save
            straight to their record.
          </DialogDescription>
        </DialogHeader>

        {activeTemplates.length === 0 ? (
          <p className="text-sm text-brand-muted">
            No active needs-analysis templates. An admin can create one in the Admin Portal.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={currentTemplateId ?? ""} onValueChange={setTemplateId}>
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
              <div className="space-y-2">
                <Label>Link active for</Label>
                <Select
                  value={String(hours)}
                  onValueChange={(value) => setHours(Number(value) as InviteDuration)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_DURATIONS.map((duration) => (
                      <SelectItem key={duration} value={String(duration)}>
                        {duration} hours
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleCreate} disabled={createInvite.isPending} className="w-full gap-2">
              <Link2 className="size-4" />
              {createInvite.isPending ? "Creating…" : "Create secure link"}
            </Button>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Links</p>
              {invites.length === 0 && (
                <p className="text-sm text-brand-muted">No links yet for this client.</p>
              )}
              {invites.map((invite) => {
                const state = inviteState(invite);
                return (
                  <div
                    key={invite.id}
                    className="space-y-2 rounded-lg border border-brand-border bg-brand-surface/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-brand-muted">
                      <span className="font-semibold uppercase tracking-wide">
                        {state === "active"
                          ? `Active until ${formatDate(invite.expires_at)}`
                          : state === "submitted"
                            ? `Submitted ${formatDate(invite.submitted_at!)}`
                            : state === "revoked"
                              ? "Cancelled"
                              : "Expired"}
                      </span>
                      {state === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => revokeInvite.mutate(invite)}
                        >
                          <Ban className="size-3" /> Cancel
                        </Button>
                      )}
                    </div>
                    <Input readOnly value={inviteUrl(invite.token)} className="text-xs" />
                    {state === "active" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => handleCopy(invite.id, invite.token)}
                        >
                          {copiedId === invite.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          disabled={sendingId === invite.id}
                          onClick={() => handleEmail(invite.id, invite.token)}
                        >
                          <Mail className="size-4" />
                          {sendingId === invite.id ? "Sending…" : "Email client"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
