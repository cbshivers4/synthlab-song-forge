/**
 * Plan rules (no React, so they can be tested):
 * - Founder accounts: everything, free forever.
 * - 14-day free trial: started at checkout with a card on file; nothing is charged before day 14.
 * - Pro: paid monthly or yearly.
 * - Free: the studio works, but projects can't be saved (and no export / mastered files).
 */
export const FOUNDER_EMAILS = ["christophershivers@synclabsapp.com", "cbshivers@gmail.com"];

export const TRIAL_DAYS = 14;

export const PLAN_PRICES = {
  monthly: { id: "synclab_monthly", label: "$9.95", cents: 995 },
  yearly: { id: "synclab_yearly", label: "$119.40", cents: 11940 },
} as const;

export type Tier = "founder" | "pro" | "trial" | "free";

export interface SubscriptionRow {
  paddle_subscription_id: string;
  price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

const DAY = 86_400_000;

/** Active means usable now: trialing/paid and current, or canceled but still inside the period. */
export function subscriptionIsActive(sub: SubscriptionRow | null, now = Date.now()): boolean {
  if (!sub) return false;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const inPeriod = periodEnd === null || periodEnd > now;
  if (["active", "trialing", "past_due", "canceled"].includes(sub.status)) return inPeriod;
  return false;
}

export function planTier(
  email: string | null,
  sub: SubscriptionRow | null,
  /** Checkout just finished on this device; the payment record hasn't arrived yet. */
  justCheckedOut: boolean,
  now = Date.now(),
): { tier: Tier; trialDaysLeft: number } {
  if (email && FOUNDER_EMAILS.includes(email.toLowerCase())) return { tier: "founder", trialDaysLeft: 0 };
  if (subscriptionIsActive(sub, now)) {
    if (sub!.status === "trialing") {
      const end = sub!.current_period_end ? new Date(sub!.current_period_end).getTime() : now + TRIAL_DAYS * DAY;
      return { tier: "trial", trialDaysLeft: Math.max(1, Math.ceil((end - now) / DAY)) };
    }
    return { tier: "pro", trialDaysLeft: 0 };
  }
  if (justCheckedOut) return { tier: "trial", trialDaysLeft: TRIAL_DAYS };
  return { tier: "free", trialDaysLeft: 0 };
}

/** Saving projects (and export / mastered files) needs the trial, a paid plan or a founder account. */
export function canSave(tier: Tier): boolean {
  return tier !== "free";
}
