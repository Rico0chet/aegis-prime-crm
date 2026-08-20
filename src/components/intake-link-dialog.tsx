import { useState } from "react";
import { Check, Copy, Link2, Power, Trash2 } from "lucide-react";
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
import { formatDate } from "@/lib/crm";
import {
  intakeUrl,
  useCreateIntakeLink,
  useDeleteIntakeLink,
  useIntakeLinks,
  useSetIntakeLinkActive,
} from "@/lib/intake";

export function IntakeLinkDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: links = [], isLoading } = useIntakeLinks(open);
  const createLink = useCreateIntakeLink();
  const setActive = useSetIntakeLinkActive();
  const deleteLink = useDeleteIntakeLink();

  async function copy(id: string, token: string) {
    try {
      await navigator.clipboard.writeText(intakeUrl(token));
      setCopiedId(id);
      toast.success("Intake link copied");
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast.error("Copy failed — select and copy the link manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Client intake links</DialogTitle>
          <DialogDescription>
            Share a link with a prospect — anyone who opens it can submit their details and they arrive in your
            registry as a new prospect.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="intake-label">Label (optional)</Label>
            <Input
              id="intake-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Website, referral card, seminar…"
            />
          </div>
          <Button
            className="gap-2"
            disabled={createLink.isPending}
            onClick={() =>
              createLink.mutate(label.trim() || null, {
                onSuccess: () => {
                  setLabel("");
                  toast.success("Intake link created");
                },
                onError: (error) => toast.error(error.message),
              })
            }
          >
            <Link2 className="size-4" />
            Create link
          </Button>
        </div>

        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{link.label ?? "Intake link"}</p>
                  <p className="mt-1 truncate text-[11px] text-brand-muted">
                    {link.is_active ? "Active" : "Disabled"} • {link.submission_count} submission
                    {link.submission_count === 1 ? "" : "s"} • Created {formatDate(link.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => copy(link.id, link.token)}>
                    {copiedId === link.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={link.is_active ? "Disable link" : "Enable link"}
                    onClick={() =>
                      setActive.mutate(
                        { id: link.id, isActive: !link.is_active },
                        { onError: (error) => toast.error(error.message) },
                      )
                    }
                  >
                    <Power className="size-4 text-brand-muted" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete link"
                    onClick={() =>
                      deleteLink.mutate(link.id, { onError: (error) => toast.error(error.message) })
                    }
                  >
                    <Trash2 className="size-4 text-brand-muted" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 truncate rounded bg-brand-card px-2 py-1 text-[11px] text-brand-muted">
                {intakeUrl(link.token)}
              </p>
            </div>
          ))}
          {links.length === 0 && (
            <p className="py-6 text-center text-sm text-brand-muted">
              {isLoading ? "Loading links…" : "No intake links yet. Create one to start collecting prospects."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
