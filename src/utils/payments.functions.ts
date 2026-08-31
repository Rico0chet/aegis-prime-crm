import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";

export const PRODUCER_PRICE_ID = "producer_monthly";
export const PRODUCER_PRODUCT_ID = "producer_seat";

async function paddlePriceId(env: PaddleEnv): Promise<string> {
  const response = await gatewayFetch(
    env,
    `/prices?external_id=${encodeURIComponent(PRODUCER_PRICE_ID)}`,
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Could not load the plan price [${response.status}]: ${body}`);
  }
  const result = (await response.json()) as { data?: { id: string }[] };
  const id = result.data?.[0]?.id;
  if (!id) throw new Error("Producer price not found in the payment provider.");
  return id;
}

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { environment: PaddleEnv }) => data)
  .handler(async ({ data }) => paddlePriceId(data.environment));

export type CheckoutOffer =
  | { blocked: "comped" | "active"; reason: string }
  | {
      blocked: null;
      paddlePriceId: string;
      discountId: string | null;
      basePriceCents: number;
      effectiveCents: number;
    };

/**
 * Resolves the signed-in producer's exact monthly charge and, when it is below
 * the standard price, a PRIVATE Paddle discount pinned to this producer.
 * Private discounts have no public code and cannot be typed in at checkout.
 */
export const resolveCheckoutOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: PaddleEnv }) => data)
  .handler(async ({ data, context }): Promise<CheckoutOffer> => {
    const { supabase, userId } = context;
    const env = data.environment;

    const [{ data: account }, { data: settings }] = await Promise.all([
      supabase
        .from("billing_accounts")
        .select(
          "access_mode, discount_percent, custom_price_cents, referred_by, paddle_discount_id, paddle_discount_env, paddle_discount_key",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("billing_settings")
        .select("base_price_cents, referral_discount_percent")
        .maybeSingle(),
    ]);

    if (account?.access_mode === "free") {
      return {
        blocked: "comped",
        reason: "Your account has complimentary access — there is nothing to pay.",
      };
    }

    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .eq("environment", env)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1)
      .maybeSingle();
    if (existingSub) {
      return {
        blocked: "active",
        reason: "You already have an active subscription. Use Manage subscription instead.",
      };
    }

    const basePriceCents = settings?.base_price_cents ?? 2000;
    const referralPercent = account?.referred_by ? (settings?.referral_discount_percent ?? 0) : 0;
    const percent = Math.max(0, Math.min(100, (account?.discount_percent ?? 0) + referralPercent));

    const effectiveCents =
      account?.custom_price_cents != null
        ? Math.min(account.custom_price_cents, basePriceCents)
        : Math.round(basePriceCents * (1 - percent / 100));

    const priceId = await paddlePriceId(env);
    const amountOff = Math.max(0, basePriceCents - effectiveCents);

    if (amountOff <= 0) {
      return { blocked: null, paddlePriceId: priceId, discountId: null, basePriceCents, effectiveCents };
    }

    // Reuse the producer's stored private discount when the terms are unchanged.
    const key = `${env}:${priceId}:${amountOff}`;
    if (account?.paddle_discount_id && account.paddle_discount_key === key) {
      return {
        blocked: null,
        paddlePriceId: priceId,
        discountId: account.paddle_discount_id,
        basePriceCents,
        effectiveCents,
      };
    }

    const created = await gatewayFetch(env, "/discounts", {
      method: "POST",
      body: JSON.stringify({
        description: `Aegis Prime private rate for producer ${userId}`,
        type: "flat",
        amount: String(amountOff),
        currency_code: "USD",
        enabled_for_checkout: false,
        recur: true,
        restrict_to: [priceId],
        custom_data: { userId },
      }),
    });

    if (!created.ok) {
      const body = await created.text();
      console.error(`Paddle discount creation failed [${created.status}]: ${body}`);
      throw new Error(
        "Your discounted rate could not be prepared. Please try again or contact your administrator.",
      );
    }

    const createdResult = (await created.json()) as { data?: { id: string } };
    const discountId = createdResult.data?.id ?? null;

    if (discountId) {
      await supabase
        .from("billing_accounts")
        .update({ paddle_discount_id: discountId, paddle_discount_env: env, paddle_discount_key: key })
        .eq("user_id", userId);
    }

    return { blocked: null, paddlePriceId: priceId, discountId, basePriceCents, effectiveCents };
  });

/** Opens the payment provider's hosted portal so a producer can update their card, view invoices or cancel. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: PaddleEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.paddle_customer_id) throw new Error("No subscription found for your account yet.");

    const response = await gatewayFetch(
      data.environment,
      `/customers/${sub.paddle_customer_id}/portal-sessions`,
      {
        method: "POST",
        body: JSON.stringify({ subscription_ids: [sub.paddle_subscription_id] }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      console.error(`Portal session failed [${response.status}]: ${body}`);
      throw new Error("Could not open the billing portal. Please try again.");
    }
    const result = (await response.json()) as {
      data?: { urls?: { general?: { overview?: string } } };
    };
    const url = result.data?.urls?.general?.overview;
    if (!url) throw new Error("The billing portal did not return a link.");
    return { url };
  });

/** Admin only: pushes a new standard monthly price to the payment provider. */
export const syncBasePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: PaddleEnv; amountCents: number }) => ({
    environment: data.environment,
    amountCents: Math.max(70, Math.round(data.amountCents)),
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const priceId = await paddlePriceId(data.environment);
    const response = await gatewayFetch(data.environment, `/prices/${priceId}`, {
      method: "PATCH",
      body: JSON.stringify({
        unit_price: { amount: String(data.amountCents), currency_code: "USD" },
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Paddle price update failed [${response.status}]: ${body}`);
      throw new Error(`The payment provider rejected the new price [${response.status}].`);
    }
    return { ok: true as const, amountCents: data.amountCents };
  });
