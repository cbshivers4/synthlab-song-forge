import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { paddleFetch, resolveInternalPriceId, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const envSchema = z.enum(["sandbox", "live"]);

/** Resolve a human-readable price id to the provider-internal id for checkout. */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ priceId: z.string(), environment: envSchema }).parse(data))
  .handler(async ({ data }) => {
    return resolveInternalPriceId(data.environment as PaddleEnv, data.priceId);
  });

/**
 * Switch the signed-in user's active subscription to another plan
 * (monthly <-> yearly), prorated immediately per the product's policy.
 */
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ priceId: z.string(), environment: envSchema }).parse(data))
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
  .inputValidator((data) => z.object({ environment: envSchema }).parse(data))
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
