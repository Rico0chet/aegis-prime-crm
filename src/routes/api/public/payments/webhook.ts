import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveUserId(data: any, env: PaddleEnv): Promise<string | null> {
  if (data?.customData?.userId) return String(data.customData.userId);
  const subscriptionId = data?.subscriptionId ?? data?.id;
  if (subscriptionId) {
    const { data: row } = await getSupabase()
      .from("subscriptions")
      .select("user_id")
      .eq("paddle_subscription_id", subscriptionId)
      .eq("environment", env)
      .maybeSingle();
    if (row?.user_id) return row.user_id;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;

  const userId = customData?.userId;
  if (!userId) {
    console.error("No userId in customData");
    return;
  }

  const item = items[0];
  const priceId = item.price.importMeta?.externalId;
  const productId = item.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item.price.id,
      rawProductId: item.product?.id,
    });
    return;
  }

  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        paddle_subscription_id: id,
        paddle_customer_id: customerId,
        product_id: productId,
        price_id: priceId,
        status,
        current_period_start: currentBillingPeriod?.startsAt,
        current_period_end: currentBillingPeriod?.endsAt,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );

  // Only flip a trialing account to paid — never downgrade a comped account.
  await getSupabase()
    .from("billing_accounts")
    .update({ access_mode: "paid" })
    .eq("user_id", userId)
    .neq("access_mode", "free");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange } = data;

  await getSupabase()
    .from("subscriptions")
    .update({
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  // Access is kept until current_period_end (handled by the access check),
  // so we only record the cancellation here.
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);

  const userId = await resolveUserId(data, env);
  if (userId) {
    // Return the account to the standard (unpaid) state so admin views and the
    // paywall reflect reality once the paid period runs out.
    await getSupabase()
      .from("billing_accounts")
      .update({ access_mode: "trial" })
      .eq("user_id", userId)
      .eq("access_mode", "paid");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recordTransaction(data: any, env: PaddleEnv, status: string) {
  const userId = await resolveUserId(data, env);
  const total = data?.details?.totals?.total ?? data?.details?.totals?.grandTotal;

  await getSupabase()
    .from("billing_transactions")
    .upsert(
      {
        user_id: userId,
        paddle_transaction_id: data.id,
        paddle_subscription_id: data.subscriptionId ?? null,
        status,
        amount_cents: total != null ? Number(total) : null,
        currency_code: data?.currencyCode ?? null,
        occurred_at: data?.billedAt ?? data?.updatedAt ?? new Date().toISOString(),
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_transaction_id,environment" },
    );
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    case EventName.TransactionCompleted:
      await recordTransaction(event.data, env, "completed");
      break;
    case EventName.TransactionPaymentFailed:
      await recordTransaction(event.data, env, "payment_failed");
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
