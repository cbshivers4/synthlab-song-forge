import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { paddleFetch, resolveInternalPriceId, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const envSchema = z.enum(["sandbox", "live"]);

/** Resolve a human-readable price id to the provider-internal id for checkout. */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .validator((data) => z.object({ priceId: z.string(), environment: envSchema }).parse(data))
  .handler(async ({ data }) => {
    return resolveInternalPriceId(data.environment as PaddleEnv, data.priceId);
  });

/**
 * Switch the signed-in user's active subscription to another plan
 * (monthly <-> yearly), prorated immediately per the product's policy.
 */
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ priceId: z.string(), environment: envSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, price_id, status, current_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.paddle_subscription_id) throw new Error("No active subscription to change");
    if (sub.price_id === data.priceId) return { changed: false };

    const newPriceId = await resolveInternalPriceId(data.environment as PaddleEnv, data.priceId);
    const res = await paddleFetch(data.environment as PaddleEnv, `/subscriptions/${sub.paddle_subscription_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        items: [{ price_id: newPriceId, quantity: 1 }],
        // Nothing has been charged during the free trial, so the new plan simply starts when it ends.
        proration_billing_mode: sub.status === "trialing" ? "do_not_bill" : "prorated_immediately",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Plan change failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return { changed: true };
  });

/** Create a customer-portal session so the user can cancel or update billing. */
export const createPortalLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ environment: envSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, paddle_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.paddle_customer_id) throw new Error("No billing account found");

    const res = await paddleFetch(data.environment as PaddleEnv, `/customers/${sub.paddle_customer_id}/portal-sessions`, {
      method: "POST",
      body: JSON.stringify({ subscription_ids: [sub.paddle_subscription_id] }),
    });
    if (!res.ok) throw new Error(`Could not open the billing portal (${res.status})`);
    const json = (await res.json()) as { data?: { urls?: { general?: { overview?: string } } } };
    const url = json.data?.urls?.general?.overview;
    if (!url) throw new Error("Billing portal is unavailable");
    return { url };
  });

/** Statuses that mean the account already has a live subscription (no second checkout). */
const LIVE_STATUSES = ["active", "trialing", "past_due"];

/**
 * Server-side duplicate check before checkout opens: an account with a running
 * subscription switches plans instead of buying a second one.
 */
export const checkoutAllowed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ environment: envSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    const { data: rows, error } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .in("status", LIVE_STATUSES);
    if (error) throw new Error("Could not check your plan. Please try again.");
    const now = Date.now();
    const running = (rows ?? []).some(
      (r: { current_period_end: string | null }) =>
        !r.current_period_end || new Date(r.current_period_end).getTime() > now,
    );
    return { allowed: !running };
  });

async function ownSubscription(supabase: any, userId: string, environment: string) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("paddle_subscription_id, status")
    .eq("user_id", userId)
    .eq("environment", environment)
    .in("status", LIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub?.paddle_subscription_id) throw new Error("No running plan to change");
  return sub as { paddle_subscription_id: string; status: string };
}

async function markCancelScheduled(paddleSubscriptionId: string, on: boolean) {
  // The webhook writes the same value; this just makes the screen update straight away.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("subscriptions")
    .update({ cancel_at_period_end: on, updated_at: new Date().toISOString() } as never)
    .eq("paddle_subscription_id", paddleSubscriptionId);
}

/**
 * Cancel at the end of the current period. During the Premium trial that is the trial
 * end date, so nothing is ever charged; on a paid plan access lasts until the paid period ends.
 */
export const cancelMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ environment: envSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    const sub = await ownSubscription(supabase, userId, data.environment);
    const res = await paddleFetch(data.environment as PaddleEnv, `/subscriptions/${encodeURIComponent(sub.paddle_subscription_id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ effective_from: "next_billing_period" }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`cancel plan failed [${res.status}]`, text.slice(0, 300));
      throw new Error("Could not cancel right now. Please try again, or use Manage billing.");
    }
    await markCancelScheduled(sub.paddle_subscription_id, true);
    return { cancelled: true };
  });

/** Undo a scheduled cancellation so the plan keeps going. */
export const keepMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ environment: envSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as unknown as { supabase: any; userId: string };
    const sub = await ownSubscription(supabase, userId, data.environment);
    const res = await paddleFetch(data.environment as PaddleEnv, `/subscriptions/${encodeURIComponent(sub.paddle_subscription_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ scheduled_change: null }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`keep plan failed [${res.status}]`, text.slice(0, 300));
      throw new Error("Could not undo the cancellation. Please try again.");
    }
    await markCancelScheduled(sub.paddle_subscription_id, false);
    return { kept: true };
  });
