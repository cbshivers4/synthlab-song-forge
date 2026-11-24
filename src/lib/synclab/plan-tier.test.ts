import { describe, expect, it } from "vitest";
import {
  FREE_ACCESS_DAYS,
  PLAN_PRICES,
  TRIAL_DAYS,
  canSave,
  canUseAi,
  needsStartChoice,
  planTier,
  trialStatusLabel,
  type FreeAccessRow,
  type SubscriptionRow,
} from "./plan-tier";

const DAY = 86_400_000;
const now = new Date(2026, 10, 6, 12, 0, 0).getTime(); // local noon, Nov 6 2026
const sub = (status: string, endsInDays: number): SubscriptionRow => ({
  paddle_subscription_id: "sub_1",
  price_id: "synclab_monthly",
  status,
  current_period_end: new Date(now + endsInDays * DAY).toISOString(),
  cancel_at_period_end: false,
});
const freeAccess = (endsInDays: number): FreeAccessRow => ({
  started_at: new Date(now - (FREE_ACCESS_DAYS - endsInDays) * DAY).toISOString(),
  ends_at: new Date(now + endsInDays * DAY).toISOString(),
});

describe("SYNCLAB plan", () => {
  it("prices are $9.95 a month and $119.40 a year", () => {
    expect(PLAN_PRICES.monthly.cents).toBe(995);
    expect(PLAN_PRICES.yearly.cents).toBe(11940);
  });

  it("the Premium trial and Free Access both last 14 days", () => {
    expect(TRIAL_DAYS).toBe(14);
    expect(FREE_ACCESS_DAYS).toBe(14);
  });

  it("without a trial or plan the account is free and cannot save or use AI", () => {
    const { tier } = planTier("someone@example.com", null, false, now);
    expect(tier).toBe("free");
    expect(canSave(tier)).toBe(false);
    expect(canUseAi(tier)).toBe(false);
  });

  it("Premium trial (card on file) can save, use AI and shows the days left", () => {
    const r = planTier("someone@example.com", sub("trialing", 10), false, now);
    expect(r.tier).toBe("trial");
    expect(r.trialDaysLeft).toBe(10);
    expect(canSave(r.tier)).toBe(true);
    expect(canUseAi(r.tier)).toBe(true);
  });

  it("Free Access (no card) can save, export and master but not use AI", () => {
    const r = planTier("a@b.com", null, false, now, freeAccess(10));
    expect(r.tier).toBe("free_access");
    expect(r.trialDaysLeft).toBe(10);
    expect(canSave(r.tier)).toBe(true);
    expect(canUseAi(r.tier)).toBe(false);
  });

  it("Free Access ends after its 14 days and the account becomes free", () => {
    expect(planTier("a@b.com", null, false, now, freeAccess(-1)).tier).toBe("free");
  });

  it("a paid plan beats Free Access", () => {
    expect(planTier("a@b.com", sub("active", 20), false, now, freeAccess(5)).tier).toBe("pro");
  });

  it("a trial cancelled before day 14 keeps access until the trial ends, then becomes free", () => {
    expect(planTier("a@b.com", sub("canceled", 3), false, now).tier).not.toBe("free");
    expect(planTier("a@b.com", sub("canceled", -1), false, now).tier).toBe("free");
  });

  it("a paid plan is Pro with AI", () => {
    const { tier } = planTier("a@b.com", sub("active", 20), false, now);
    expect(tier).toBe("pro");
    expect(canUseAi(tier)).toBe(true);
  });

  it("a paused subscription gives no access", () => {
    expect(planTier("a@b.com", sub("paused", 20), false, now).tier).toBe("free");
  });

  it("the founder account is never locked", () => {
    const { tier } = planTier("CBShivers@gmail.com", null, false, now);
    expect(tier).toBe("founder");
    expect(canUseAi(tier)).toBe(true);
  });

  it("only brand-new accounts get the start choice", () => {
    expect(needsStartChoice("free", null, null)).toBe(true);
    expect(needsStartChoice("free", null, freeAccess(-3))).toBe(false);
    expect(needsStartChoice("free", sub("canceled", -1), null)).toBe(false);
  });
});

describe("trial countdown wording", () => {
  it("counts real calendar days", () => {
    expect(trialStatusLabel(now + 14 * DAY, now)).toBe("14 days remaining");
    expect(trialStatusLabel(now + 10 * DAY, now)).toBe("10 days remaining");
    expect(trialStatusLabel(now + 3 * DAY, now)).toBe("3 days remaining");
  });
  it("says tomorrow, today and expired honestly", () => {
    expect(trialStatusLabel(now + DAY, now)).toBe("Trial expires tomorrow");
    expect(trialStatusLabel(now + 2 * 3_600_000, now)).toBe("Trial ends today");
    expect(trialStatusLabel(now - 1, now)).toBe("Trial expired");
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
