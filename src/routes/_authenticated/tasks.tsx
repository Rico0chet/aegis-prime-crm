import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  formatDate,
  useClients,
  useCreateTask,
  useDeleteTask,
  useTasks,
  useToggleTask,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Follow-ups | Aegis Prime Producer CRM" },
      {
        name: "description",
        content: "Keep every client follow-up, underwriting requirement, and delivery appointment on schedule.",
      },
      { property: "og:title", content: "Follow-ups | Aegis Prime Producer CRM" },
      {
        property: "og:description",
        content: "Keep every client follow-up, underwriting requirement, and delivery appointment on schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: clients = [] } = useClients();
  const createTask = useCreateTask();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [clientId, setClientId] = useState<string>("none");

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    createTask.mutate(
      {
        title: title.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        client_id: clientId === "none" ? null : clientId,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDueAt("");
          setClientId("none");
          toast.success("Follow-up added");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function clientName(id: string | null) {
    if (!id) return null;
    const client = clients.find((c) => c.id === id);
    return client ? `${client.first_name} ${client.last_name}` : null;
  }

  return (
    <AppShell title="Follow-ups" eyebrow={`${open.length} open`}>
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-brand-border bg-brand-card p-5 shadow-brand-card sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end sm:p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="title">Follow-up</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Call about medical exam results"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due">Due</Label>
          <Input id="due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.first_name} {client.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          disabled={createTask.isPending}
          className="gap-2 bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-strong"
        >
          <Plus /> Add
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-brand-card">
        <div className="divide-y divide-brand-border">
          {[...open, ...done].map((task) => (
            <div key={task.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
              <Checkbox
                checked={task.completed}
                aria-label={`Mark ${task.title} complete`}
                onCheckedChange={(checked) =>
                  toggleTask.mutate({ id: task.id, completed: checked === true })
                }
              />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", task.completed && "text-brand-muted line-through")}>
                  {task.title}
                </p>
                <p className="mt-1 truncate text-[11px] text-brand-muted">
                  {task.due_at ? `Due ${formatDate(task.due_at)}` : "No due date"}
                  {clientName(task.client_id) ? ` • ${clientName(task.client_id)}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete follow-up"
                onClick={() => deleteTask.mutate(task.id)}
              >
                <Trash2 className="size-4 text-brand-muted" />
              </Button>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="px-6 py-14 text-center text-sm text-brand-muted">
              {isLoading ? "Loading follow-ups…" : "Nothing scheduled yet."}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
