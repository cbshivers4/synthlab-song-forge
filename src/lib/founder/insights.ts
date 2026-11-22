/**
 * Pure rules for the founder dashboard (no React, no network) so they can be tested:
 * when a visit counts as a sign-in, how devices and places are named, and who is
 * in the 30-day upgrade campaign.
 */
import { isFounderEmail } from "@/lib/synclab/plan-tier";

/** Set by the sign-in screen when the person ticks "Email me tips and offers"; read once after sign-in. */
export const MARKETING_OPT_IN_KEY = "synclab.marketingOptIn";

/** An app opening on an already signed-in session is recorded again only after this gap. */
export const OPEN_GAP_MS = 6 * 60 * 60 * 1000;

export type LoginKind = "sign_in" | "open";

/**
 * A new session is a sign-in. The same session coming back after OPEN_GAP_MS is an
 * app opening. Anything sooner is the same visit and is not recorded again.
 */
export function loginKind(lastForSession: string | null, now = Date.now()): LoginKind | null {
  if (!lastForSession) return "sign_in";
  const at = new Date(lastForSession).getTime();
  if (!Number.isFinite(at)) return "sign_in";
  return now - at >= OPEN_GAP_MS ? "open" : null;
}

/** Short device + browser names from a user-agent string. */
export function describeDevice(ua: string): { device: string; browser: string } {
  const os = /iPhone/i.test(ua)
    ? "iPhone"
    : /iPad/i.test(ua)
      ? "iPad"
      : /Android/i.test(ua)
        ? /Mobile/i.test(ua)
          ? "Android phone"
          : "Android tablet"
        : /Electron/i.test(ua)
          ? "SYNCLAB Desktop"
          : /Mac OS X|Macintosh/i.test(ua)
            ? "Mac"
            : /Windows/i.test(ua)
              ? "Windows PC"
              : /CrOS/i.test(ua)
                ? "Chromebook"
                : /Linux/i.test(ua)
                  ? "Linux PC"
                  : "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Other";
  return { device: os, browser };
}

/** Country codes Cloudflare uses when it can't name a country. */
const NO_COUNTRY = new Set(["", "XX", "T1"]);

/** "Detroit, Michigan, United States" — or the time zone when no place is known. */
export function formatPlace(
  p: { city?: string; region?: string; country?: string; timezone?: string },
  countryName: (code: string) => string = (c) => c,
): string {
  const country = p.country && !NO_COUNTRY.has(p.country) ? countryName(p.country) : "";
  const parts = [p.city, p.region, country].filter((s): s is string => !!s && s.trim() !== "");
  if (parts.length) return parts.join(", ");
  if (p.timezone) return `Time zone ${p.timezone.replace(/_/g, " ")}`;
  return "Unknown location";
}

/** The name to show: the account's full name, otherwise the part of the email before @. */
export function displayName(meta: Record<string, unknown> | null | undefined, email: string): string {
  const pick = (k: string) => (typeof meta?.[k] === "string" ? (meta[k] as string).trim() : "");
  return pick("full_name") || pick("name") || pick("user_name") || email.split("@")[0] || "Unknown";
}

export type AccountPlan = "founder" | "pro" | "trial" | "past_due" | "free";

/** Plan for the dashboard from a subscription status (null = never subscribed). */
export function accountPlan(
  email: string,
  sub: { status: string; current_period_end: string | null } | null,
  now = Date.now(),
): AccountPlan {
  if (isFounderEmail(email)) return "founder";
  if (!sub) return "free";
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const current = end === null || end > now;
  if (!current) return "free";
  if (sub.status === "trialing") return "trial";
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "active" || sub.status === "canceled") return "pro";
  return "free";
}

/** Paying (or trialing with a card) accounts never receive the upgrade campaign. */
export const isPaidPlan = (plan: AccountPlan) => plan === "pro" || plan === "trial" || plan === "founder";

/**
 * Who the 30-day campaign is for: unpaid accounts that said yes to marketing email.
 * Founder accounts and paying customers are always left out.
 */
export function inCampaignAudience(c: { email: string; plan: AccountPlan; optedIn: boolean }): boolean {
  if (!c.email || isFounderEmail(c.email)) return false;
  if (isPaidPlan(c.plan)) return false;
  return c.optedIn;
}

/** Day of the campaign (0 = the day it started), or null before it started. */
export function campaignDay(startedAt: string | null, now = Date.now()): number | null {
  if (!startedAt) return null;
  const t = new Date(startedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}
