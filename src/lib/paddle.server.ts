/** Server-only Paddle API access via the connector gateway. Never import from client components. */

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
  synclab_monthly: { interval: "month", amount: "1995", currency: "USD" },
  synclab_yearly: { interval: "year", amount: "14900", currency: "USD" },
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
  // Prefer the catalog external id when present; fall back to interval+amount match.
  const byExternalId = prices.find((p) => p.import_meta?.external_id === priceId);
  const match =
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
