import { describe, expect, it } from "vitest";
import {
  OPEN_GAP_MS,
  accountPlan,
  campaignDay,
  describeDevice,
  displayName,
  formatPlace,
  inCampaignAudience,
  loginKind,
} from "./insights";
import { CAMPAIGN_DAYS, CAMPAIGN_EMAILS, emailForDay } from "./email-campaign";

const NOW = Date.parse("2026-11-22T12:00:00Z");

describe("sign-in history", () => {
  it("records a new session as a sign-in", () => {
    expect(loginKind(null, NOW)).toBe("sign_in");
  });
  it("does not record the same visit twice within six hours", () => {
    expect(loginKind(new Date(NOW - OPEN_GAP_MS + 60_000).toISOString(), NOW)).toBeNull();
  });
  it("records a return to the same session after six hours as an app opening", () => {
    expect(loginKind(new Date(NOW - OPEN_GAP_MS).toISOString(), NOW)).toBe("open");
  });
  it("shows city, region and country, skipping unknown countries", () => {
    expect(
      formatPlace({ city: "Detroit", region: "Michigan", country: "US" }, () => "United States"),
    ).toBe("Detroit, Michigan, United States");
    expect(formatPlace({ country: "XX", timezone: "America/New_York" })).toBe(
      "Time zone America/New York",
    );
    expect(formatPlace({})).toBe("Unknown location");
  });
  it("names the account from its full name, else the email", () => {
    expect(displayName({ full_name: "Ann Lee" }, "ann@x.com")).toBe("Ann Lee");
    expect(displayName({}, "beatmaker@x.com")).toBe("beatmaker");
  });
  it("names phones and browsers", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ device: "iPhone", browser: "Safari" });
  });
});

describe("30-day campaign", () => {
  it("runs from day 0 to day 30 in order", () => {
    const days = CAMPAIGN_EMAILS.map((e) => e.day);
    expect(days[0]).toBe(0);
    expect(days[days.length - 1]).toBe(CAMPAIGN_DAYS);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });
  it("only goes to unpaid accounts that said yes", () => {
    expect(inCampaignAudience({ email: "a@x.com", plan: "free", optedIn: true })).toBe(true);
    expect(inCampaignAudience({ email: "a@x.com", plan: "free", optedIn: false })).toBe(false);
    expect(inCampaignAudience({ email: "a@x.com", plan: "pro", optedIn: true })).toBe(false);
    expect(inCampaignAudience({ email: "a@x.com", plan: "trial", optedIn: true })).toBe(false);
    expect(inCampaignAudience({ email: "cbshivers@gmail.com", plan: "free", optedIn: true })).toBe(
      false,
    );
  });
  it("treats an expired subscription as unpaid", () => {
    expect(
      accountPlan("a@x.com", { status: "active", current_period_end: "2026-11-01T00:00:00Z" }, NOW),
    ).toBe("free");
    expect(
      accountPlan(
        "a@x.com",
        { status: "trialing", current_period_end: "2026-12-01T00:00:00Z" },
        NOW,
      ),
    ).toBe("trial");
    expect(accountPlan("a@x.com", null, NOW)).toBe("free");
  });
  it("knows which email is due on each day", () => {
    const start = new Date(NOW - 8 * 86_400_000).toISOString();
    expect(campaignDay(start, NOW)).toBe(8);
    expect(emailForDay(8)?.day).toBe(7);
    expect(emailForDay(null)).toBeNull();
  });
});
