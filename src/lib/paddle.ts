import { resolvePaddlePrice } from "@/utils/payments.functions";

const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] as string | undefined;

declare global {
  interface Window {
    Paddle?: any;
  }
}

export type PaddleEnv = "sandbox" | "live";

/** Test vs live, derived from the client token prefix (build-time swap). */
export function getPaddleEnvironment(): PaddleEnv {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let paddleInitialized = false;
let completedHandler: (() => void) | null = null;

/** Register a callback fired when a checkout completes (overlay stays open). */
export function onPaddleCheckoutCompleted(cb: () => void) {
  completedHandler = cb;
}

export async function initializePaddle(): Promise<void> {
  if (paddleInitialized) return;
  if (!clientToken) throw new Error("Payments client token is not configured");

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment script"));
    document.head.appendChild(script);
  });

  window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
  window.Paddle.Initialize({
    token: clientToken,
    eventCallback: (event: { name?: string }) => {
      if (event?.name === "checkout.completed") completedHandler?.();
    },
  });
  paddleInitialized = true;
}

/** Resolve a human-readable price id (e.g. "synclab_monthly") to the provider's internal id. */
export async function getPaddlePriceId(priceId: string): Promise<string> {
  return resolvePaddlePrice({ data: { priceId, environment: getPaddleEnvironment() } });
}
