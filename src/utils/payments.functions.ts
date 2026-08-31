import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";

export const PRODUCER_PRICE_ID = "producer_monthly";
export const PRODUCER_PRODUCT_ID = "producer_seat";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = (await response.json()) as { data?: { id: string }[] };
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0]!.id;
  });

/**
 * Resolves the signed-in producer's effective monthly price and, when a
 * discount applies (admin percent, referral bonus or a custom price), a
 * matching recurring Paddle discount to attach to checkout.
 */
export const resolveCheckoutOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: PaddleEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const env = data.environment;

    const [{ data: account }, { data: settings }] = await Promise.all([
      supabase
        .from("billing_accounts")
        .select("access_mode, discount_percent, custom_price_cents, referred_by")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("billing_settings")
        .select("base_price_cents, referral_discount_percent")
        .maybeSingle(),
    ]);

    const basePrice = settings?.base_price_cents ?? 2000;
    const referralPercent = account?.referred_by ? (settings?.referral_discount_percent ?? 0) : 0;

    let percent = 0;
    if (account?.access_mode === "free") {
      percent = 100;
    } else if (account?.custom_price_cents != null && basePrice > 0) {
      percent = Math.round(((basePrice - account.custom_price_cents) / basePrice) * 100);
    } else {
      percent = (account?.discount_percent ?? 0) + referralPercent;
    }
    percent = Math.max(0, Math.min(100, percent));

    const priceResponse = await gatewayFetch(
      env,
      `/prices?external_id=${encodeURIComponent(PRODUCER_PRICE_ID)}`,
    );
    const priceResult = (await priceResponse.json()) as { data?: { id: string }[] };
    const paddlePriceId = priceResult.data?.[0]?.id;
    if (!paddlePriceId) throw new Error("Producer price not found");

    const effectiveCents = Math.round(basePrice * (1 - percent / 100));

    if (percent <= 0 || percent >= 100) {
      return { paddlePriceId, discountId: null as string | null, percent, effectiveCents };
    }

    const code = `AEGIS${percent}`;
    const existing = await gatewayFetch(env, `/discounts?code=${encodeURIComponent(code)}`);
    const existingResult = (await existing.json()) as {
      data?: { id: string; status: string }[];
    };
    const found = existingResult.data?.find((d) => d.status === "active");
    if (found) {
      return { paddlePriceId, discountId: found.id, percent, effectiveCents };
    }

    const created = await gatewayFetch(env, "/discounts", {
      method: "POST",
      body: JSON.stringify({
        description: `Aegis Prime ${percent}% producer discount`,
        type: "percentage",
        amount: String(percent),
        code,
        enabled_for_checkout: true,
        recur: true,
      }),
    });
    if (!created.ok) {
      const body = await created.text();
      console.error(`Paddle discount creation failed [${created.status}]: ${body}`);
      return { paddlePriceId, discountId: null as string | null, percent: 0, effectiveCents: basePrice };
    }
    const createdResult = (await created.json()) as { data?: { id: string } };
    return {
      paddlePriceId,
      discountId: createdResult.data?.id ?? null,
      percent,
      effectiveCents,
    };
  });
