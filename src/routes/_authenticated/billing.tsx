import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Copy, CreditCard, ExternalLink, Receipt, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import {
  effectivePriceCents,
  formatMoney,
  useAccessState,
  useBillingSettings,
  useBillingTransactions,
} from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Subscription & Billing | Aegis Prime CRM" },
      {
        name: "description",
        content:
          "Manage your Aegis Prime producer subscription, view your monthly rate, discounts and referral code.",
      },
      { property: "og:title", content: "Subscription & Billing | Aegis Prime CRM" },
      {
        property: "og:description",
        content: "Manage your Aegis Prime producer subscription, discounts and referral code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { account, subscription, comped, trialing, paid, daysLeft, loading, pastDue, cancelAtPeriodEnd } =
    useAccessState();
  const { data: settings } = useBillingSettings();
  const { data: transactions = [] } = useBillingTransactions();
  const { openCheckout, openPortal, loading: checkoutLoading } = usePaddleCheckout();
  const [starting, setStarting] = useState(false);

  const price = effectivePriceCents(account, settings);
  const base = settings?.base_price_cents ?? 2000;
  const discounted = price < base;

  async function handleSubscribe() {
    setStarting(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Not signed in");
      await openCheckout({
        userId: data.user.id,
        ...(data.user.email ? { customerEmail: data.user.email } : {}),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open checkout");
    } finally {
      setStarting(false);
    }
  }

  async function handlePortal() {
    try {
      await openPortal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the billing portal");
    }
  }

  const referralLink =
    typeof window !== "undefined" && account
      ? `${window.location.origin}/auth?ref=${account.referral_code}`
      : "";

  return (
    <AppShell title="Subscription" eyebrow="Billing & plan">
      <PaymentTestModeBanner />

      {pastDue && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="size-4 text-amber-500" />
          <span>
            Your last payment failed. Update your card to keep your account from being suspended.
          </span>
          <Button size="sm" variant="outline" onClick={handlePortal}>
            Update payment method
          </Button>
        </div>
      )}

      {cancelAtPeriodEnd && subscription?.current_period_end && (
        <div className="rounded-xl border border-brand-border bg-brand-card p-4 text-sm text-brand-muted">
          Your subscription is set to cancel. You keep full access until{" "}
          {new Date(subscription.current_period_end).toLocaleDateString()}.
        </div>
      )}

      <section className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">
              Current status
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {loading
                ? "Loading…"
                : comped
                  ? "Complimentary access"
                  : paid
                    ? "Active subscription"
                    : trialing
                      ? `Free trial — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                      : "No active plan"}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-brand-muted">
              {comped
                ? "Your account has been granted free access by an administrator."
                : paid
                  ? `Renews ${subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "monthly"}.`
                  : "Aegis Prime is billed monthly per producer seat. Cancel anytime."}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">
              Your rate
            </p>
            <p className="mt-1 text-3xl font-semibold text-brand-accent">
              {comped ? "Free" : `${formatMoney(price)}/mo`}
            </p>
            {discounted && !comped && (
              <p className="mt-1 text-xs text-brand-muted line-through">{formatMoney(base)}/mo</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {!comped && !paid && (
            <Button onClick={handleSubscribe} disabled={starting || checkoutLoading}>
              <CreditCard className="mr-2 size-4" />
              {starting || checkoutLoading ? "Opening checkout…" : "Subscribe now"}
            </Button>
          )}
          {paid && (
            <Button variant="outline" onClick={handlePortal} disabled={checkoutLoading}>
              <ExternalLink className="mr-2 size-4" />
              Manage subscription
            </Button>
          )}
          {comped && (
            <p className="text-sm text-brand-muted">
              No payment method is needed while your access is complimentary.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-brand-accent" /> Discounts applied
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-brand-muted">
            <li>Standard price: {formatMoney(base)}/month</li>
            {account?.custom_price_cents != null && (
              <li>Custom rate set by admin: {formatMoney(account.custom_price_cents)}/month</li>
            )}
            {(account?.discount_percent ?? 0) > 0 && (
              <li>Account discount: {account?.discount_percent}% off</li>
            )}
            {account?.referred_by && (
              <li>Referral discount: {settings?.referral_discount_percent ?? 0}% off</li>
            )}
            {!account?.referred_by &&
              (account?.discount_percent ?? 0) === 0 &&
              account?.custom_price_cents == null && <li>No discounts on this account.</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-brand-accent" /> Your referral code
          </h3>
          <p className="mt-2 text-sm text-brand-muted">
            Producers who sign up with your code get{" "}
            {settings?.referral_discount_percent ?? 0}% off their monthly rate.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <code className="rounded-md border border-brand-border px-3 py-2 text-sm font-semibold tracking-widest">
              {account?.referral_code ?? "—"}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy referral link"
              onClick={() => {
                void navigator.clipboard.writeText(referralLink);
                toast.success("Referral link copied");
              }}
            >
              <Copy />
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-brand-border bg-brand-card p-6 shadow-brand-card">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Receipt className="size-4 text-brand-accent" /> Payment history
        </h3>
        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-brand-muted">No payments recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-brand-border text-sm">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-2">
                <span className="text-brand-muted">
                  {tx.occurred_at ? new Date(tx.occurred_at).toLocaleDateString() : "—"}
                </span>
                <span className="capitalize text-brand-muted">{tx.status.replace("_", " ")}</span>
                <span className="font-semibold">
                  {tx.amount_cents != null ? formatMoney(tx.amount_cents) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
