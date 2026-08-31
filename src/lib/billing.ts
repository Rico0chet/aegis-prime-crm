import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import type { Database } from "@/integrations/supabase/types";

export type BillingAccount = Database["public"]["Tables"]["billing_accounts"]["Row"];
export type BillingSettings = Database["public"]["Tables"]["billing_settings"]["Row"];
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type BillingTransaction = Database["public"]["Tables"]["billing_transactions"]["Row"];

export type AccessMode = "trial" | "paid" | "free";

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function effectivePriceCents(
  account: Pick<BillingAccount, "access_mode" | "discount_percent" | "custom_price_cents" | "referred_by"> | null | undefined,
  settings: Pick<BillingSettings, "base_price_cents" | "referral_discount_percent"> | null | undefined,
) {
  const base = settings?.base_price_cents ?? 2000;
  if (!account) return base;
  if (account.access_mode === "free") return 0;
  if (account.custom_price_cents != null) return account.custom_price_cents;
  const referral = account.referred_by ? (settings?.referral_discount_percent ?? 0) : 0;
  const percent = Math.max(0, Math.min(100, account.discount_percent + referral));
  return Math.round(base * (1 - percent / 100));
}

export function useBillingSettings() {
  return useQuery({
    queryKey: ["billing-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_settings").select("*").maybeSingle();
      if (error) throw error;
      return data as BillingSettings | null;
    },
  });
}

export function useUpdateBillingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { base_price_cents?: number; referral_discount_percent?: number; trial_days?: number }) => {
      const { error } = await supabase.from("billing_settings").update(patch).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["billing-settings"] }),
  });
}

export function useBillingAccount() {
  return useQuery({
    queryKey: ["billing-account"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from("billing_accounts")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as BillingAccount | null;
    },
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("environment", getPaddleEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SubscriptionRow | null;
    },
    refetchInterval: 15_000,
  });
}

export function useBillingTransactions() {
  return useQuery({
    queryKey: ["billing-transactions"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const { data, error } = await supabase
        .from("billing_transactions")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("environment", getPaddleEnvironment())
        .order("occurred_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as BillingTransaction[];
    },
  });
}

export function subscriptionIsActive(sub: SubscriptionRow | null | undefined) {
  if (!sub) return false;
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const future = end == null || end > Date.now();
  if (["active", "trialing", "past_due"].includes(sub.status) && future) return true;
  return sub.status === "canceled" && end != null && end > Date.now();
}

export function trialDaysLeft(account: BillingAccount | null | undefined) {
  if (!account) return 0;
  const ms = new Date(account.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Combined access state used to gate the app. */
export function useAccessState() {
  const account = useBillingAccount();
  const subscription = useSubscription();
  const loading = account.isLoading || subscription.isLoading;
  const comped = account.data?.access_mode === "free";
  const trialing = account.data?.access_mode === "trial" && trialDaysLeft(account.data) > 0;
  const paid = subscriptionIsActive(subscription.data);
  return {
    loading,
    hasAccess: comped || trialing || paid,
    pastDue: subscription.data?.status === "past_due",
    cancelAtPeriodEnd: Boolean(subscription.data?.cancel_at_period_end),
    comped,
    trialing,
    paid,
    daysLeft: trialDaysLeft(account.data),
    account: account.data ?? null,
    subscription: subscription.data ?? null,
  };
}

/* ---------------------------------- admin ---------------------------------- */

export type BillingProducer = BillingAccount & {
  full_name: string | null;
  agency: string | null;
  subscription_status: string | null;
  referred_by_code: string | null;
  referral_count: number;
};

export function useBillingProducers() {
  return useQuery({
    queryKey: ["admin", "billing-producers"],
    queryFn: async (): Promise<BillingProducer[]> => {
      const [{ data: accounts, error }, { data: profiles }, { data: subs }] = await Promise.all([
        supabase.from("billing_accounts").select("*").order("created_at", { ascending: true }),
        supabase.from("profiles").select("id, full_name, agency"),
        supabase
          .from("subscriptions")
          .select("user_id, status, environment, created_at")
          .eq("environment", getPaddleEnvironment())
          .order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      const rows = (accounts ?? []) as BillingAccount[];
      return rows.map((a) => {
        const profile = (profiles ?? []).find((p) => p.id === a.user_id);
        const sub = (subs ?? []).find((s) => s.user_id === a.user_id);
        return {
          ...a,
          full_name: profile?.full_name ?? null,
          agency: profile?.agency ?? null,
          subscription_status: sub?.status ?? null,
          referred_by_code: a.referred_by
            ? (rows.find((r) => r.user_id === a.referred_by)?.referral_code ?? null)
            : null,
          referral_count: rows.filter((r) => r.referred_by === a.user_id).length,
        };
      });
    },
  });
}

export function useUpdateBillingAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      ...patch
    }: {
      userId: string;
      access_mode?: AccessMode;
      discount_percent?: number;
      custom_price_cents?: number | null;
      trial_ends_at?: string;
      referred_by?: string | null;
      notes?: string | null;
    }) => {
      const { error } = await supabase.from("billing_accounts").update(patch).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "billing-producers"] });
      void qc.invalidateQueries({ queryKey: ["billing-account"] });
    },
  });
}
