import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useAccessState } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { loading, hasAccess } = useAccessState();

  const exempt = pathname.startsWith("/billing") || pathname.startsWith("/profile");

  if (!loading && !hasAccess && !exempt) {
    return (
      <AppShell title="Subscription required" eyebrow="Billing">
        <section className="max-w-xl rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
          <h2 className="text-lg font-semibold">Your free trial has ended</h2>
          <p className="mt-2 text-sm text-brand-muted">
            Subscribe to keep using your client registry, pipeline, needs analysis and booking
            tools. Your data is safe and returns the moment your plan is active.
          </p>
          <Button asChild className="mt-5">
            <Link to="/billing">View plans</Link>
          </Button>
        </section>
      </AppShell>
    );
  }

  return <Outlet />;
}
