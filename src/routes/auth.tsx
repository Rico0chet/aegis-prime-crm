import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Producer Sign In | Aegis Prime CRM" },
      {
        name: "description",
        content:
          "Sign in to your Aegis Prime producer desk to manage clients, policies, underwriting and follow-ups.",
      },
      { property: "og:title", content: "Producer Sign In | Aegis Prime CRM" },
      {
        property: "og:description",
        content: "Secure sign in for life insurance producers using Aegis Prime.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName.trim(), agency: agency.trim() },
        },
      });
      setBusy(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleGoogle() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-surface px-5 py-12 text-brand-ink">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 block text-center">
          <p className="font-serif text-3xl italic tracking-tight text-brand-accent">Aegis Prime</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-brand-muted">
            Producer intelligence
          </p>
        </Link>

        <div className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in to your desk" : "Create your producer desk"}
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            {mode === "signin"
              ? "Your book of business, pipeline and follow-ups."
              : "Set up your profile to start tracking clients and policies."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agency">Agency</Label>
                  <Input
                    id="agency"
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    maxLength={120}
                    autoComplete="organization"
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-brand-muted">{message}</p>}

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent-strong"
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">
            <span className="h-px flex-1 bg-brand-border" />
            or
            <span className="h-px flex-1 bg-brand-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle} type="button">
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-sm text-brand-muted">
            {mode === "signin" ? "New to Aegis Prime?" : "Already have a desk?"}{" "}
            <button
              type="button"
              className="font-semibold text-brand-ink underline underline-offset-4"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setMessage(null);
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-brand-muted">
          <ShieldCheck className="size-3.5" />
          Client data is private to your account.
        </p>
      </div>
    </main>
  );
}
