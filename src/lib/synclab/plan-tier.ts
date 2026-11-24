/**
 * Plan rules (no React, so they can be tested):
 * - Founder accounts: everything, free forever.
 * - Free Access: 14 days, no card. Save, export and master — no AI tools. Once per account,
 *   started on the server (free_access_trials), so the device clock can't extend it.
 * - Premium trial: 14 days with a card on file (Paddle price trial); everything, AI included.
 *   Nothing is charged before the trial end date; cancel before then and pay nothing.
 * - Pro: paid monthly or yearly; everything.
 * - Free: the studio works, but projects can't be saved (and no export / mastered files / AI).
 */
/**
 * The one founder list in app code. The database keeps its own copy inside
 * public.has_premium_access (migrations); if this list ever changes, add a new
 * migration that updates that function too — never edit an old migration.
 */
export const FOUNDER_EMAILS = ["christophershivers@synclabsapp.com", "cbshivers@gmail.com"];

/** True for a founder login, ignoring letter case. */
export const isFounderEmail = (email: string | null | undefined) =>
  !!email && FOUNDER_EMAILS.includes(email.toLowerCase());

export const TRIAL_DAYS = 14;
export const FREE_ACCESS_DAYS = 14;

export const PLAN_PRICES = {
  monthly: { id: "synclab_monthly", label: "$9.95", cents: 995, per: "month" },
  yearly: { id: "synclab_yearly", label: "$119.40", cents: 11940, per: "year" },
} as const;

export type PlanId = keyof typeof PLAN_PRICES;

export type Tier = "founder" | "pro" | "trial" | "free_access" | "free";

export interface SubscriptionRow {
  paddle_subscription_id: string;
  price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/** The account's no-card Free Access record (one per account, dates set by the server). */
export interface FreeAccessRow {
  started_at: string;
  ends_at: string;
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

/** Free Access is running right now. */
export function freeAccessIsActive(fa: FreeAccessRow | null, now = Date.now()): boolean {
  return !!fa && new Date(fa.ends_at).getTime() > now;
}

/** Whole calendar days (in the viewer's time zone) from `now` until `end`. */
export function calendarDaysUntil(end: number, now = Date.now()): number {
  const a = new Date(now);
  const b = new Date(end);
  const startA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const startB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((startB - startA) / DAY);
}

export interface PlanResult {
  tier: Tier;
  /** Days left in the Premium trial or Free Access (0 otherwise). */
  trialDaysLeft: number;
  /** When the running trial / Free Access ends (ms), or null. */
  trialEndsAt: number | null;
}

export function planTier(
  email: string | null,
  sub: SubscriptionRow | null,
  /** Checkout just finished on this device; the payment record hasn't arrived yet. */
  justCheckedOut: boolean,
  now = Date.now(),
  freeAccess: FreeAccessRow | null = null,
): PlanResult {
  if (isFounderEmail(email)) return { tier: "founder", trialDaysLeft: 0, trialEndsAt: null };
  if (subscriptionIsActive(sub, now)) {
    if (sub!.status === "trialing") {
      const end = sub!.current_period_end
        ? new Date(sub!.current_period_end).getTime()
        : now + TRIAL_DAYS * DAY;
      return {
        tier: "trial",
        trialDaysLeft: Math.max(0, calendarDaysUntil(end, now)),
        trialEndsAt: end,
      };
    }
    return { tier: "pro", trialDaysLeft: 0, trialEndsAt: null };
  }
  if (justCheckedOut)
    return { tier: "trial", trialDaysLeft: TRIAL_DAYS, trialEndsAt: now + TRIAL_DAYS * DAY };
  if (freeAccess && freeAccessIsActive(freeAccess, now)) {
    const end = new Date(freeAccess.ends_at).getTime();
    return {
      tier: "free_access",
      trialDaysLeft: Math.max(0, calendarDaysUntil(end, now)),
      trialEndsAt: end,
    };
  }
  return { tier: "free", trialDaysLeft: 0, trialEndsAt: null };
}

/** Saving projects (and export / mastered files): everyone except the free version. */
export function canSave(tier: Tier): boolean {
  return tier !== "free";
}

/** AI tools are Premium: founder, Premium trial or a paid plan. */
export function canUseAi(tier: Tier): boolean {
  return tier === "founder" || tier === "pro" || tier === "trial";
}

/** Brand-new accounts that have never started either option get the choice screen. */
export function needsStartChoice(
  tier: Tier,
  sub: SubscriptionRow | null,
  freeAccess: FreeAccessRow | null,
): boolean {
  return tier === "free" && !sub && !freeAccess;
}

/** Plain countdown wording; no urgency beyond the real date. */
export function trialStatusLabel(endsAt: number, now = Date.now()): string {
  if (endsAt <= now) return "Trial expired";
  const days = calendarDaysUntil(endsAt, now);
  if (days <= 0) return "Trial ends today";
  if (days === 1) return "Trial expires tomorrow";
  return `${days} days remaining`;
}

/** e.g. "Mon, Dec 7, 2026" in the viewer's language. */
export function formatPlanDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Which plan a subscription row is on. */
export function planIdOf(sub: SubscriptionRow | null): PlanId | null {
  if (!sub) return null;
  if (sub.price_id === PLAN_PRICES.yearly.id) return "yearly";
  if (sub.price_id === PLAN_PRICES.monthly.id) return "monthly";
  return null;
}
