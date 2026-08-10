import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, ClipboardList, Sparkles, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatDate,
  initialsOf,
  policyStatusLabel,
  policyStatusStyle,
  useClients,
  usePolicies,
  useTasks,
  useToggleTask,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Executive Desk | Aegis Prime Producer CRM" },
      {
        name: "description",
        content:
          "Track premium in force, pending applications, and daily follow-ups across your life insurance book of business.",
      },
      { property: "og:title", content: "Executive Desk | Aegis Prime Producer CRM" },
      {
        property: "og:description",
        content:
          "Track premium in force, pending applications, and daily follow-ups across your life insurance book of business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProducerDesk,
});

const IN_FLIGHT = ["submitted", "underwriting", "medical_scheduled", "approved"] as const;

function ProducerDesk() {
  const { data: policies = [], isLoading: policiesLoading } = usePolicies();
  const { data: clients = [] } = useClients();
  const { data: tasks = [] } = useTasks();
  const toggleTask = useToggleTask();

  const metrics = useMemo(() => {
    const issued = policies.filter((p) => p.status === "issued");
    const pending = policies.filter((p) => IN_FLIGHT.includes(p.status as (typeof IN_FLIGHT)[number]));
    const decided = policies.filter((p) => p.status === "issued" || p.status === "declined");
    const premiumInForce = issued.reduce((sum, p) => sum + Number(p.annual_premium ?? 0), 0);
    const commissions = issued.reduce((sum, p) => sum + Number(p.target_commission ?? 0), 0);
    const ratio = decided.length ? Math.round((issued.length / decided.length) * 100) : 0;
    return { premiumInForce, pending: pending.length, ratio, commissions, decided: decided.length };
  }, [policies]);

  const activePipeline = policies
    .filter((p) => p.status !== "issued" && p.status !== "declined")
    .slice(0, 6);

  const openTasks = tasks.filter((t) => !t.completed).slice(0, 6);
  const isEmpty = !policiesLoading && policies.length === 0 && clients.length === 0;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell
      title="Morning Briefing"
      eyebrow={today}
      actions={
        <Button asChild className="gap-2 bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-strong">
          <Link to="/pipeline">
            <ClipboardList />
            <span className="hidden sm:inline">New Application</span>
          </Link>
        </Button>
      }
    >
      {isEmpty && (
        <section className="flex flex-col gap-4 rounded-xl border border-brand-accent/30 bg-brand-accent-soft p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Your book is empty</p>
            <p className="mt-1 text-sm text-brand-muted">
              Add your first client, then log the application to start tracking underwriting.
            </p>
          </div>
          <Button asChild className="bg-brand-sidebar text-brand-sidebar-foreground hover:bg-brand-sidebar-hover">
            <Link to="/clients">
              <Users /> Add a client
            </Link>
          </Button>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Production metrics">
        <MetricCard label="Premium in Force" value={formatCurrency(metrics.premiumInForce, true)} detail="Annualized, issued policies" />
        <MetricCard label="Pending Apps" value={String(metrics.pending)} detail="In submission or underwriting" />
        <MetricCard
          label="Closing Ratio"
          value={metrics.decided ? `${metrics.ratio}%` : "—"}
          detail={metrics.decided ? `${metrics.decided} decided applications` : "No decisions yet"}
        />
        <MetricCard label="Target Commissions" value={formatCurrency(metrics.commissions, true)} detail="From issued business" />
      </section>

      <section className="grid gap-8 xl:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-brand-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-brand-border px-5 py-5 sm:px-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">Production in motion</p>
              <h2 className="mt-1 font-semibold">Active Policy Pipeline</h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-brand-accent">
              <Link to="/pipeline">
                View all <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-brand-border">
            {activePipeline.map((policy) => (
              <div key={policy.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-surface text-xs font-bold text-brand-muted ring-1 ring-brand-border">
                    {policy.clients ? initialsOf(policy.clients.first_name, policy.clients.last_name) : "—"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {policy.clients ? `${policy.clients.first_name} ${policy.clients.last_name}` : "Unassigned"}
                    </p>
                    <p className="mt-1 truncate text-[10px] italic text-brand-muted">
                      {policy.product_type} • {formatCurrency(policy.face_amount ? Number(policy.face_amount) : null, true)} face
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide",
                      policyStatusStyle[policy.status],
                    )}
                  >
                    {policyStatusLabel[policy.status]}
                  </span>
                  <p className="mt-1 text-[10px] text-brand-muted">{policy.carrier}</p>
                </div>
              </div>
            ))}
            {activePipeline.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-brand-muted">
                {policiesLoading ? "Loading pipeline…" : "No applications in flight."}
              </div>
            )}
          </div>
        </div>

        <section className="relative overflow-hidden rounded-xl bg-brand-sidebar p-7 text-brand-sidebar-foreground shadow-brand-deep">
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              <Sparkles className="size-3.5" /> Today&apos;s follow-ups
            </div>
            <div className="mt-6 flex-1 space-y-4">
              {openTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggleTask.mutate({ id: task.id, completed: true })}
                  className="flex w-full items-start gap-3 border-b border-brand-sidebar-border pb-3 text-left"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-sidebar-muted" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{task.title}</span>
                    <span className="mt-0.5 block text-[10px] text-brand-sidebar-muted">
                      {task.due_at ? formatDate(task.due_at) : "No due date"}
                    </span>
                  </span>
                </button>
              ))}
              {openTasks.length === 0 && (
                <p className="text-sm text-brand-sidebar-soft">Nothing outstanding. Add a follow-up to stay ahead.</p>
              )}
            </div>
            <Button
              asChild
              className="mt-6 w-full bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-strong"
            >
              <Link to="/tasks">Manage follow-ups</Link>
            </Button>
          </div>
          <div className="pointer-events-none absolute -bottom-24 -right-20 size-64 rounded-full border border-brand-sidebar-ring" />
        </section>
      </section>
    </AppShell>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl border border-brand-border bg-brand-card p-5 shadow-brand-card sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted">{label}</p>
      <p className="mt-3 font-serif text-3xl text-brand-ink">{value}</p>
      <p className="mt-3 text-[10px] text-brand-muted">{detail}</p>
    </article>
  );
}
