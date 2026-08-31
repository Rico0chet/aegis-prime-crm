import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, CalendarDays, ClipboardList, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aegis Prime | Life Insurance Producer CRM" },
      {
        name: "description",
        content:
          "A focused CRM for life insurance producers: track clients, policies, underwriting status, commissions and follow-ups in one desk.",
      },
      { property: "og:title", content: "Aegis Prime | Life Insurance Producer CRM" },
      {
        property: "og:description",
        content:
          "Track clients, policies, underwriting status, commissions and follow-ups in one producer desk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: ClipboardList,
    title: "Policy pipeline",
    body: "See every application from quote to issue, with underwriting and medical status at a glance.",
  },
  {
    icon: Users,
    title: "Client registry",
    body: "One record per household: contact details, coverage history, and every conversation logged.",
  },
  {
    icon: BarChart3,
    title: "Commission ledger",
    body: "Track target commissions against issued premium so you always know where the year stands.",
  },
  {
    icon: CalendarDays,
    title: "Renewals desk",
    body: "Follow-ups and renewal dates surface before they slip, not after the policy lapses.",
  },
];

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-brand-surface text-brand-ink">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div>
          <p className="font-serif text-2xl italic tracking-tight text-brand-accent">Aegis Prime</p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-brand-muted">
            Producer intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-strong">
            <Link to={signedIn ? "/dashboard" : "/auth"}>
              {signedIn ? "Open my desk" : "Sign in"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <section className="py-16 sm:py-24">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-muted">
            Built for life insurance producers
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
            Your book of business, finally in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-brand-muted sm:text-lg">
            Aegis Prime keeps applications moving through underwriting, keeps clients warm, and keeps
            your commission targets honest — without the spreadsheet sprawl.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-strong"
            >
              <Link to={signedIn ? "/dashboard" : "/auth"}>
                {signedIn ? "Open my desk" : "Create your desk"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/book">Book an appointment</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2" aria-label="Product capabilities">
          {features.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card"
            >
              <div className="grid size-9 place-items-center rounded-lg bg-brand-accent-soft text-brand-accent">
                <Icon className="size-4" />
              </div>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-brand-muted">{body}</p>
            </article>
          ))}
        </section>

        <p className="mt-12 flex items-center gap-2 text-xs text-brand-muted">
          <ShieldCheck className="size-3.5" />
          Every client record is private to the producer who owns it.
        </p>
      </main>
    </div>
  );
}
