import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import marcusPortrait from "@/assets/marcus-thorne.jpg";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/crm";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Executive Desk", to: "/dashboard", icon: LayoutDashboard },
  { label: "Policy Pipeline", to: "/pipeline", icon: ClipboardList },
  { label: "Client Registry", to: "/clients", icon: Users },
  { label: "Follow-ups", to: "/tasks", icon: BarChart3 },
  { label: "Renewals Desk", to: "/renewals", icon: CalendarDays },
] as const;

export function AppShell({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  eyebrow: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: profile } = useProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

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
          {navigation.map(({ label, to, icon: Icon }) => {
            const isActive = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-lg px-4 text-sm font-medium text-brand-sidebar-muted transition-colors hover:bg-brand-sidebar-hover hover:text-brand-sidebar-foreground",
                  isActive && "bg-brand-sidebar-hover text-brand-sidebar-foreground shadow-inner",
                )}
              >
                <Icon className={cn("size-4", isActive && "text-brand-accent")} />
                {label}
              </Link>
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
              <p className="truncate text-xs font-semibold">{profile?.full_name ?? "Producer"}</p>
              <p className="mt-0.5 truncate text-[10px] text-brand-sidebar-muted">
                {profile?.agency ?? "Producer"}
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
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">
                {eyebrow}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1440px] space-y-8 p-5 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
