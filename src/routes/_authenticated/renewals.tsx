import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import {
  formatCurrency,
  formatDate,
  policyStatusLabel,
  policyStatusStyle,
  usePolicies,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/renewals")({
  head: () => ({
    meta: [
      { title: "Renewals Desk | Aegis Prime Producer CRM" },
      {
        name: "description",
        content: "See which life policies renew next so conversion and retention conversations happen on time.",
      },
      { property: "og:title", content: "Renewals Desk | Aegis Prime Producer CRM" },
      {
        property: "og:description",
        content: "See which life policies renew next so conversion and retention conversations happen on time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RenewalsPage,
});

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function RenewalsPage() {
  const { data: policies = [], isLoading } = usePolicies();

  const renewals = policies
    .filter((policy) => policy.renewal_date)
    .sort((a, b) => (a.renewal_date! < b.renewal_date! ? -1 : 1));

  return (
    <AppShell title="Renewals Desk" eyebrow={`${renewals.length} scheduled`}>
      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-brand-card">
        <div className="divide-y divide-brand-border">
          {renewals.map((policy) => {
            const days = daysUntil(policy.renewal_date!);
            return (
              <div key={policy.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="min-w-16 rounded-lg bg-brand-surface px-3 py-2 text-center ring-1 ring-brand-border">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-brand-muted">
                      {new Date(policy.renewal_date!).toLocaleDateString("en-US", { month: "short" })}
                    </p>
                    <p className="mt-1 font-serif text-xl leading-none text-brand-ink">
                      {new Date(policy.renewal_date!).getUTCDate()}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {policy.clients ? `${policy.clients.first_name} ${policy.clients.last_name}` : "Unassigned"}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-brand-muted">
                      {policy.carrier} • {policy.product_type} •{" "}
                      {formatCurrency(policy.annual_premium ? Number(policy.annual_premium) : null)}/yr
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
                  <p className="mt-1 text-[10px] text-brand-muted">
                    {days < 0 ? `Lapsed ${formatDate(policy.renewal_date)}` : `In ${days} day${days === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>
            );
          })}
          {renewals.length === 0 && (
            <div className="px-6 py-14 text-center text-sm text-brand-muted">
              {isLoading ? "Loading renewals…" : "No renewal dates on file. Add one when logging a policy."}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
