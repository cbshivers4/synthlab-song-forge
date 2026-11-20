/** Server-only Paddle API access via the connector gateway. Never import from client components. */
import { Environment, Paddle, EventName } from "@paddle/paddle-node-sdk";

export type PaddleEnv = "sandbox" | "live";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/paddle";

function keys(env: PaddleEnv): { lovableKey: string; connectionKey: string } {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey =
    env === "sandbox" ? process.env["PADDLE_SANDBOX_API_KEY"] : process.env["PADDLE_LIVE_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!connectionKey) throw new Error(`Paddle connection key for ${env} is not configured`);
  return { lovableKey, connectionKey };
}

export async function paddleFetch(env: PaddleEnv, path: string, init: RequestInit = {}): Promise<Response> {
  const { lovableKey, connectionKey } = keys(env);
  return fetch(`${GATEWAY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/**
 * Catalog of human-readable price ids. Used to resolve provider-internal
 * price ids, which differ between the test and live environments.
 */
export const PRICE_CATALOG: Record<string, { interval: "month" | "year"; amount: string; currency: string }> = {
  synclab_monthly: { interval: "month", amount: "995", currency: "USD" },
  synclab_yearly: { interval: "year", amount: "11940", currency: "USD" },
};

/** Resolve a human-readable price id to the environment-specific internal price id. */
export async function resolveInternalPriceId(env: PaddleEnv, priceId: string): Promise<string> {
  const expected = PRICE_CATALOG[priceId];
  if (!expected) throw new Error(`Unknown price: ${priceId}`);
  const res = await paddleFetch(env, "/prices?status=active&per_page=50");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Could not list prices [${res.status}]: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      billing_cycle?: { interval?: string } | null;
      unit_price?: { amount?: string; currency_code?: string };
      import_meta?: { external_id?: string };
    }>;
  };
  const prices = json.data ?? [];
  // Older prices can still be active under the same id (they keep billing existing customers),
  // so new checkouts pick the one with the current amount (and its 14-day trial) first.
  const sameAmount = (p: (typeof prices)[number]) =>
    p.billing_cycle?.interval === expected.interval &&
    p.unit_price?.amount === expected.amount &&
    p.unit_price?.currency_code === expected.currency;
  const current = prices.find((p) => p.import_meta?.external_id === priceId && sameAmount(p));
  const byExternalId = prices.find((p) => p.import_meta?.external_id === priceId);
  const match =
    current ??
    byExternalId ??
    prices.find(
      (p) =>
        p.billing_cycle?.interval === expected.interval &&
        p.unit_price?.amount === expected.amount &&
        p.unit_price?.currency_code === expected.currency
    );
  if (!match) throw new Error(`Price ${priceId} not found in ${env} catalog`);
  return match.id;
}

// ---- Webhook verification (official Paddle SDK) ----

export { EventName };

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

export function getPaddleClient(env: PaddleEnv): Paddle {
  const { lovableKey, connectionKey } = keys(env);
  return new Paddle(connectionKey, {
    environment: GATEWAY_BASE as unknown as Environment,
    customHeaders: {
      "X-Connection-Api-Key": connectionKey,
      "Lovable-API-Key": lovableKey,
    },
  });
}

export function getWebhookSecret(env: PaddleEnv): string {
  return env === "sandbox"
    ? getEnvVar("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : getEnvVar("PAYMENTS_LIVE_WEBHOOK_SECRET");
}

/** Verifies the Paddle signature over the raw body and returns the parsed event. */
export async function verifyWebhook(req: Request, env: PaddleEnv) {
  const signature = req.headers.get("paddle-signature");
  const body = await req.text();
  const secret = getWebhookSecret(env);
  if (!signature || !body) throw new Error("Missing signature or body");
  return await getPaddleClient(env).webhooks.unmarshal(body, secret, signature);
}
