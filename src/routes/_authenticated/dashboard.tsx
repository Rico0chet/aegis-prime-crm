import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  FileBarChart,
  FilePlus2,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import marcusPortrait from "@/assets/marcus-thorne.jpg";
import productionTrend from "@/assets/production-trend.jpg";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Aegis Prime | Life Insurance Producer CRM" },
      {
        name: "description",
        content: "A focused CRM workspace for life insurance producers to manage clients, policies, underwriting, and follow-ups.",
      },
      { property: "og:title", content: "Aegis Prime | Life Insurance Producer CRM" },
      {
        property: "og:description",
        content: "A focused CRM workspace for life insurance producers to manage clients, policies, underwriting, and follow-ups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProducerDesk,
});

type PipelineStatus = "All" | "Underwriting" | "Medical Scheduled" | "Policy Issued";

type PipelineRow = {
  initials: string;
  name: string;
  detail: string;
  status: Exclude<PipelineStatus, "All">;
  timestamp: string;
};

const navigation = [
  { label: "Executive Desk", icon: LayoutDashboard },
  { label: "Policy Pipeline", icon: ClipboardList },
  { label: "Client Registry", icon: Users },
  { label: "Commission Ledger", icon: BarChart3 },
  { label: "Renewals Desk", icon: CalendarDays },
];

const pipelineRows: PipelineRow[] = [
  {
    initials: "JM",
    name: "Jonathan Miller",
    detail: "Whole Life • $500k Face Value",
    status: "Underwriting",
    timestamp: "Updated 2h ago",
  },
  {
    initials: "SK",
    name: "Sarah Kincaid",
    detail: "Term 20 • $1.2M Face Value",
    status: "Medical Scheduled",
    timestamp: "Oct 18, 9:00 AM",
  },
  {
    initials: "RP",
    name: "Robert P. Vance",
    detail: "IUL • $250k Face Value",
    status: "Policy Issued",
    timestamp: "Ready for delivery",
  },
];

const statusStyles: Record<Exclude<PipelineStatus, "All">, string> = {
  Underwriting: "bg-brand-warning-surface text-brand-warning-foreground",
  "Medical Scheduled": "bg-brand-info-surface text-brand-info-foreground",
  "Policy Issued": "bg-brand-positive-surface text-brand-positive-foreground",
};

function ProducerDesk() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<{ full_name: string | null; agency: string | null } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, agency")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (!cancelled) {
        setProfile(
          data ?? { full_name: (userData.user.email ?? "Producer").split("@")[0] ?? null, agency: null },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const producerName = profile?.full_name ?? "Producer";
  const producerAgency = profile?.agency ?? null;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const [activeNav, setActiveNav] = useState("Executive Desk");

  const [pipelineFilter, setPipelineFilter] = useState<PipelineStatus>("All");
  const [contacted, setContacted] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [showApplication, setShowApplication] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredPipeline = useMemo(
    () =>
      pipelineFilter === "All"
        ? pipelineRows
        : pipelineRows.filter((row) => row.status === pipelineFilter),
    [pipelineFilter],
  );

  return (
    <div className="min-h-screen bg-brand-surface text-brand-ink lg:flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-brand-sidebar text-brand-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-8 pb-8 pt-9">
          <div>
            <p className="font-serif text-2xl italic tracking-tight text-brand-accent">Aegis Prime</p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-brand-sidebar-muted">
              Producer intelligence
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-brand-sidebar-muted hover:bg-brand-sidebar-hover hover:text-brand-sidebar-foreground lg:hidden"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 px-4" aria-label="Primary navigation">
          {navigation.map(({ label, icon: Icon }) => {
            const isActive = label === activeNav;
            return (
              <Button
                key={label}
                variant="ghost"
                className={cn(
                  "h-11 w-full justify-start gap-3 rounded-lg px-4 text-sm font-medium text-brand-sidebar-muted hover:bg-brand-sidebar-hover hover:text-brand-sidebar-foreground",
                  isActive && "bg-brand-sidebar-hover text-brand-sidebar-foreground shadow-inner",
                )}
                onClick={() => {
                  setActiveNav(label);
                  setSidebarOpen(false);
                }}
              >
                <Icon className={cn("size-4", isActive && "text-brand-accent")} />
                {label}
              </Button>
            );
          })}
        </nav>

        <div className="border-t border-brand-sidebar-border px-6 py-6">
          <div className="flex items-center gap-3">
            <img
              src={marcusPortrait}
              alt="Producer portrait"
              width={816}
              height={816}
              loading="lazy"
              className="size-10 rounded-full object-cover object-top ring-1 ring-brand-sidebar-ring"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{producerName}</p>
              <p className="mt-0.5 truncate text-[10px] text-brand-sidebar-muted">
                {producerAgency ?? "Producer"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-8 text-brand-sidebar-muted hover:bg-brand-sidebar-hover hover:text-brand-sidebar-foreground"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              <LogOut />
            </Button>
          </div>

        </div>
      </aside>

      {sidebarOpen && (
        <Button
          variant="ghost"
          className="fixed inset-0 z-30 h-full w-full cursor-default rounded-none bg-brand-overlay p-0 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="min-w-0 flex-1">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-brand-border bg-brand-card px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Morning Briefing</h1>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">
                Monday, October 14
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="hidden gap-2 sm:inline-flex"
              onClick={() => setShowApplication((current) => !current)}
            >
              <FilePlus2 />
              New Application
            </Button>
            <Button
              className="gap-2 bg-brand-accent text-brand-accent-foreground shadow-sm shadow-brand-accent/20 hover:bg-brand-accent-strong"
              onClick={() => setReportReady(true)}
            >
              <FileBarChart />
              <span>{reportReady ? "Report Ready" : "Generate Report"}</span>
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="Notifications" className="hidden sm:inline-flex">
              <Bell />
            </Button>

          </div>
        </header>

        <div className="mx-auto w-full max-w-[1440px] space-y-8 p-5 sm:p-8">
          {showApplication && (
            <section className="flex flex-col gap-4 rounded-xl border border-brand-accent/30 bg-brand-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-accent text-brand-accent-foreground">
                  <Plus className="size-4" />
                </div>
                <div>
                  <p className="font-semibold">Start a new application</p>
                  <p className="mt-1 text-sm text-brand-muted">Capture a prospect, select a product, and begin the underwriting checklist.</p>
                </div>
              </div>
              <div className="flex gap-2 sm:shrink-0">
                <Button variant="outline" onClick={() => setShowApplication(false)}>Not now</Button>
                <Button className="bg-brand-sidebar text-brand-sidebar-foreground hover:bg-brand-sidebar-hover">Open intake</Button>
              </div>
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Production metrics">
            <MetricCard label="Premium in Force" value="$2.48M" trend="+12.4%" detail="vs last month" positive />
            <MetricCard label="Pending Apps" value="18" trend="Critical" detail="3 requiring medicals" warning />
            <MetricCard label="Closing Ratio" value="64%" trend="Optimal" detail="Top 5% of firm" positive />
            <MetricCard label="YTD Commissions" value="$142,900" detail="Goal: $200,000" />
          </section>

          <section className="grid gap-8 xl:grid-cols-3">
            <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-brand-card xl:col-span-2">
              <div className="flex flex-col gap-4 border-b border-brand-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">Production in motion</p>
                  <h2 className="mt-1 font-semibold">Active Policy Pipeline</h2>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-brand-surface p-1">
                  {(["All", "Underwriting", "Medical Scheduled", "Policy Issued"] as PipelineStatus[]).map((filter) => (
                    <Button
                      key={filter}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 shrink-0 px-2.5 text-[10px] text-brand-muted hover:bg-brand-card hover:text-brand-ink",
                        pipelineFilter === filter && "bg-brand-card font-semibold text-brand-ink shadow-sm",
                      )}
                      onClick={() => setPipelineFilter(filter)}
                    >
                      {filter === "Medical Scheduled" ? "Medicals" : filter}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-brand-border">
                {filteredPipeline.map((row) => (
                  <button
                    type="button"
                    key={row.name}
                    className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-brand-surface sm:px-6"
                    onClick={() => setActiveNav("Policy Pipeline")}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-surface text-xs font-bold text-brand-muted ring-1 ring-brand-border">
                        {row.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{row.name}</p>
                        <p className="mt-1 truncate text-[10px] italic text-brand-muted">{row.detail}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-right">
                      <div>
                        <span className={cn("inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide", statusStyles[row.status])}>
                          {row.status}
                        </span>
                        <p className="mt-1 text-[10px] text-brand-muted">{row.timestamp}</p>
                      </div>
                      <ChevronRight className="hidden size-4 text-brand-muted transition-transform group-hover:translate-x-0.5 sm:block" />
                    </div>
                  </button>
                ))}
                {filteredPipeline.length === 0 && (
                  <div className="px-6 py-10 text-center text-sm text-brand-muted">No policies in this stage.</div>
                )}
              </div>
            </div>

            <section className="relative overflow-hidden rounded-xl bg-brand-sidebar p-7 text-brand-sidebar-foreground shadow-brand-deep">
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                  <Sparkles className="size-3.5" /> Next best action
                </div>
                <h2 className="mt-5 font-serif text-3xl leading-tight">Eleanor Rigby</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-brand-sidebar-soft">
                  Policy renewal due in 14 days. Suggest conversion to Permanent Life based on recent financial update.
                </p>
                <div className="mt-7 space-y-3">
                  <div className="flex items-center justify-between border-b border-brand-sidebar-border pb-3 text-sm">
                    <span className="text-brand-sidebar-muted">Current Premium</span>
                    <span>$420 / mo</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-brand-sidebar-border pb-3 text-sm">
                    <span className="text-brand-sidebar-muted">Family Status</span>
                    <span>Married, 2 dependents</span>
                  </div>
                </div>
                <Button
                  className="mt-auto w-full bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-strong"
                  onClick={() => setContacted(true)}
                >
                  {contacted ? <Check /> : <Phone />}
                  {contacted ? "Contact logged" : "Initiate contact"}
                </Button>
              </div>
              <div className="pointer-events-none absolute -bottom-24 -right-20 size-64 rounded-full border border-brand-sidebar-ring" />
            </section>
          </section>

          <section className="grid gap-8 xl:grid-cols-2">
            <section className="rounded-xl border border-brand-border bg-brand-card p-5 shadow-brand-card sm:p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">Stay ahead</p>
                  <h2 className="mt-1 font-semibold">Upcoming Calendar</h2>
                </div>
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-brand-accent hover:text-brand-accent-strong" onClick={() => setActiveNav("Renewals Desk")}>
                  View all <ChevronRight />
                </Button>
              </div>
              <div className="space-y-5">
                <CalendarItem month="Oct" day="15" title="Medical Exam — David Chen" detail="Home visit scheduled by Labcorp" />
                <CalendarItem month="Oct" day="17" title="Annual Review — The Millers" detail="Zoom call regarding college fund IULs" />
                <CalendarItem month="Oct" day="21" title="Policy Delivery — Robert Vance" detail="In-office signing and beneficiary review" />
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-brand-card">
              <div className="flex items-center justify-between border-b border-brand-border px-5 py-5 sm:px-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">Production trend</p>
                  <h2 className="mt-1 font-semibold">Your book is moving up</h2>
                </div>
                <Button variant="ghost" size="icon" aria-label="More chart options">
                  <MoreHorizontal />
                </Button>
              </div>
              <div className="p-4 sm:p-6">
                <img
                  src={productionTrend}
                  alt="Upward production trend chart"
                  width={1200}
                  height={608}
                  loading="lazy"
                  className="h-44 w-full rounded-lg object-cover object-center sm:h-48"
                />
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-medium text-brand-muted">
                  <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-brand-chart-primary" /> Premium in force</span>
                  <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-brand-accent" /> New premium</span>
                  <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-brand-chart-secondary" /> Commissions</span>
                </div>
              </div>
            </section>
          </section>

          <section className="flex flex-col gap-4 border-t border-brand-border pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-brand-muted">
              <ShieldCheck className="size-4 text-brand-positive" />
              <span>Secure producer workspace</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-brand-muted">
              <Search className="size-3.5" /> Last synced 2 minutes ago
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  trend,
  detail,
  positive,
  warning,
}: {
  label: string;
  value: string;
  trend?: string;
  detail: string;
  positive?: boolean;
  warning?: boolean;
}) {
  return (
    <article className="rounded-xl border border-brand-border bg-brand-card p-5 shadow-brand-card sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted">{label}</p>
      <p className="mt-3 font-serif text-3xl text-brand-ink">{value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {trend && (
          <span className={cn(
            "rounded px-1.5 py-1 text-[9px] font-bold",
            positive && "bg-brand-positive-surface text-brand-positive-foreground",
            warning && "bg-brand-warning-surface text-brand-warning-foreground",
          )}>
            {trend}
          </span>
        )}
        <span className="text-[10px] text-brand-muted">{detail}</span>
      </div>
    </article>
  );
}

function CalendarItem({ month, day, title, detail }: { month: string; day: string; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-14 rounded-lg bg-brand-surface px-3 py-2 text-center ring-1 ring-brand-border">
        <p className="text-[9px] font-bold uppercase tracking-wide text-brand-muted">{month}</p>
        <p className="mt-1 font-serif text-xl leading-none text-brand-ink">{day}</p>
      </div>
      <div className="pt-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-brand-muted">{detail}</p>
      </div>
    </div>
  );
}
