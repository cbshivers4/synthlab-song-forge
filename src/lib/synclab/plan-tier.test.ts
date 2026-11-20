import { describe, expect, it } from "vitest";
import { PLAN_PRICES, TRIAL_DAYS, canSave, planTier, type SubscriptionRow } from "./plan-tier";

const now = Date.parse("2026-11-06T12:00:00Z");
const sub = (status: string, endsInDays: number): SubscriptionRow => ({
  paddle_subscription_id: "sub_1",
  price_id: "synclab_monthly",
  status,
  current_period_end: new Date(now + endsInDays * 86_400_000).toISOString(),
  cancel_at_period_end: false,
});

describe("SYNCLAB plan", () => {
  it("prices are $9.95 a month and $119.40 a year", () => {
    expect(PLAN_PRICES.monthly.cents).toBe(995);
    expect(PLAN_PRICES.yearly.cents).toBe(11940);
  });

  it("the free trial lasts 14 days", () => {
    expect(TRIAL_DAYS).toBe(14);
  });

  it("without a trial or plan the account is free and cannot save projects", () => {
    const { tier } = planTier("someone@example.com", null, false, now);
    expect(tier).toBe("free");
    expect(canSave(tier)).toBe(false);
  });

  it("a trial (card on file) can save and shows the days left", () => {
    const r = planTier("someone@example.com", sub("trialing", 10), false, now);
    expect(r).toEqual({ tier: "trial", trialDaysLeft: 10 });
    expect(canSave(r.tier)).toBe(true);
  });

  it("a trial cancelled before day 14 keeps access until the trial ends, then becomes free", () => {
    expect(planTier("a@b.com", sub("canceled", 3), false, now).tier).not.toBe("free");
    expect(planTier("a@b.com", sub("canceled", -1), false, now).tier).toBe("free");
  });

  it("a paid plan is Pro", () => {
    expect(planTier("a@b.com", sub("active", 20), false, now).tier).toBe("pro");
  });

  it("the founder account is never locked", () => {
    expect(planTier("CBShivers@gmail.com", null, false, now).tier).toBe("founder");
  });
});

describe("founder email list", () => {
  it("recognises both founder logins in any letter case and nobody else", async () => {
    const { isFounderEmail } = await import("./plan-tier");
    expect(isFounderEmail("CBShivers@gmail.com")).toBe(true);
    expect(isFounderEmail("christophershivers@synclabsapp.com")).toBe(true);
    expect(isFounderEmail("someone@gmail.com")).toBe(false);
    expect(isFounderEmail(null)).toBe(false);
  });
});
