import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Paddle webhook receiver (canonical path: /api/public/payments/webhook).
 * The ?env= query param selects the signing secret and which subscription
 * rows to write (test and live share one database).
 *
 * Business rules implemented here:
 * - Purchase / renewal  -> subscription row active -> Pro unlocks immediately.
 * - Cancel              -> status 'canceled'; access continues until
 *                          current_period_end (enforced by the client check).
 * - Plan switch         -> subscription.updated rewrites price_id (prorated).
 */

type Env = "sandbox" | "live";

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(";").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  );
  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;
  // Reject events older than 5 minutes.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(h1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env: Env = new URL(request.url).searchParams.get("env") === "live" ? "live" : "sandbox";
        const secret =
          env === "live" ? process.env.PAYMENTS_LIVE_WEBHOOK_SECRET : process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET;
        if (!secret) return new Response("webhook not configured", { status: 500 });

        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers.get("paddle-signature"), secret)) {
          return new Response("invalid signature", { status: 401 });
        }

        const event = JSON.parse(rawBody) as {
          event_type?: string;
          data?: Record<string, any>;
        };
        const type = event.event_type ?? "";
        const d = event.data ?? {};

        if (type.startsWith("subscription.")) {
          const userId = d.custom_data?.userId as string | undefined;
          if (!userId) {
            // Cannot attribute this subscription to an account; acknowledge and skip.
            return new Response("ok (no user)", { status: 200 });
          }
          const item = Array.isArray(d.items) ? d.items[0] : undefined;
          const priceId =
            item?.price?.import_meta?.externalId ??
            item?.price?.importMeta?.externalId ??
            (d.custom_data?.priceId as string | undefined) ??
            "synclab_monthly";
          const productId =
            item?.product?.import_meta?.externalId ??
            item?.product?.importMeta?.externalId ??
            "synclab_pro";
          const period = d.current_billing_period ?? {};
          const row = {
            user_id: userId,
            paddle_subscription_id: String(d.id),
            paddle_customer_id: String(d.customer_id ?? ""),
            product_id: productId,
            price_id: priceId,
            status: String(d.status ?? "active"),
            current_period_start: period.starts_at ?? null,
            current_period_end: period.ends_at ?? null,
            cancel_at_period_end: d.scheduled_change?.action === "cancel",
            environment: env,
            updated_at: new Date().toISOString(),
          };
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("subscriptions")
            .upsert(row, { onConflict: "paddle_subscription_id" });
          if (error) return new Response(`db error: ${error.message}`, { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
