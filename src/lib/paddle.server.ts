/** Server-only Paddle API access. Never import from client components. */

export type PaddleEnv = "sandbox" | "live";

const BASE_URL: Record<PaddleEnv, string> = {
  sandbox: "https://sandbox-api.paddle.com",
  live: "https://api.paddle.com",
};

function apiKey(env: PaddleEnv): string {
  const key = env === "sandbox" ? process.env.PADDLE_SANDBOX_API_KEY : process.env.PADDLE_LIVE_API_KEY;
  if (!key) throw new Error(`Paddle API key for ${env} is not configured`);
  return key;
}

export async function paddleFetch(env: PaddleEnv, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE_URL[env]}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey(env)}`,
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
  if (!res.ok) throw new Error(`Could not list prices (${res.status})`);
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      billing_cycle?: { interval?: string } | null;
      unit_price?: { amount?: string; currency_code?: string };
    }>;
  };
  const match = (json.data ?? []).find(
    (p) =>
      p.billing_cycle?.interval === expected.interval &&
      p.unit_price?.amount === expected.amount &&
      p.unit_price?.currency_code === expected.currency
  );
  if (!match) throw new Error(`Price ${priceId} not found in ${env} catalog`);
  return match.id;
}
