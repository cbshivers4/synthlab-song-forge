import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reads the caller's account details from the verified token. */
function accountFrom(claims: Record<string, unknown>, userId: string) {
  const email =
    typeof claims["email"] === "string" ? (claims["email"] as string).toLowerCase() : "";
  const meta =
    claims["user_metadata"] && typeof claims["user_metadata"] === "object"
      ? (claims["user_metadata"] as Record<string, unknown>)
      : null;
  const sessionId =
    typeof claims["session_id"] === "string" ? (claims["session_id"] as string) : "";
  return { id: userId, email, meta, sessionId };
}

/**
 * Records a sign-in (new session) or an app opening (same session after 6 hours) with
 * the place Cloudflare reports for the request. Location comes from the server, never
 * from the browser; the browser only adds its time zone as a fallback hint.
 */
export const recordSignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        timezone: z.string().max(64).default(""),
        marketingOptIn: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = accountFrom(context.claims as Record<string, unknown>, context.userId);
    const { getRequest } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The account record has the full name even when the token doesn't carry it.
    const { data: account } = await supabaseAdmin.auth.admin.getUserById(me.id);
    if (account.user) {
      me.meta = account.user.user_metadata ?? me.meta;
      me.email = account.user.email?.toLowerCase() ?? me.email;
    }
    const { loginKind, describeDevice, displayName } = await import("@/lib/founder/insights");
    const { planForUser, upsertContact, syncContactToLoops } =
      await import("@/lib/founder/loops.server");

    const request = getRequest();
    const cf = (request as unknown as { cf?: Record<string, unknown> }).cf ?? {};
    const header = (n: string) => request.headers.get(n) ?? "";
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const city = str(cf["city"]) || decodeURIComponent(header("cf-ipcity"));
    const region = str(cf["region"]) || header("cf-region");
    const country = str(cf["country"]) || header("cf-ipcountry");
    const timezone = str(cf["timezone"]) || data.timezone;
    const { device, browser } = describeDevice(header("user-agent"));

    // Same login (session) seen recently = same visit. Tokens without a session id fall
    // back to the account's latest entry.
    let lastQuery = supabaseAdmin
      .from("login_events")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    lastQuery = me.sessionId
      ? lastQuery.eq("session_id", me.sessionId)
      : lastQuery.eq("user_id", me.id);
    const { data: last } = await lastQuery.maybeSingle();
    const kind = loginKind(last?.created_at ?? null);

    const plan = await planForUser(supabaseAdmin, me.id, me.email);
    if (kind) {
      const { error } = await supabaseAdmin.from("login_events").insert({
        user_id: me.id,
        session_id: me.sessionId,
        kind,
        name: displayName(me.meta, me.email),
        email: me.email,
        city: city.slice(0, 120),
        region: region.slice(0, 120),
        country: country.slice(0, 8),
        timezone: timezone.slice(0, 64),
        device,
        browser,
        plan,
      });
      if (error) console.error("login history insert failed", error);
    }

    // Keep the email-campaign contact current; only a fresh yes from the sign-up box opts in.
    if (kind || data.marketingOptIn) {
      const row = await upsertContact(
        supabaseAdmin,
        me,
        plan,
        data.marketingOptIn ? { optedIn: true, source: "sign_up" } : undefined,
      );
      if (row) await syncContactToLoops(supabaseAdmin, row);
    }
    return { recorded: kind };
  });

/** The signed-in person's own "tips and offers by email" choice. */
export const setMarketingConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ optedIn: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const me = accountFrom(context.claims as Record<string, unknown>, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { planForUser, upsertContact, syncContactToLoops } =
      await import("@/lib/founder/loops.server");
    const plan = await planForUser(supabaseAdmin, me.id, me.email);
    const row = await upsertContact(supabaseAdmin, me, plan, {
      optedIn: data.optedIn,
      source: "settings",
    });
    if (!row) throw new Error("Could not save your email choice. Please try again.");
    await syncContactToLoops(supabaseAdmin, row);
    return { optedIn: row.opted_in };
  });

async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export interface FounderAccount {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  provider: string;
  plan: string;
  optedIn: boolean;
  campaignStartedAt: string | null;
  loopsSyncedAt: string | null;
  loopsError: string;
  lastPlace: { city: string; region: string; country: string; timezone: string } | null;
  signIns30d: number;
}

/** Everything the founder dashboard shows about accounts. Admins only. */
export const getFounderOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { accountPlan, displayName } = await import("@/lib/founder/insights");
    const { bestSubscription, loopsConfigured } = await import("@/lib/founder/loops.server");

    const users: {
      id: string;
      email?: string;
      created_at: string;
      last_sign_in_at?: string | null;
      app_metadata: Record<string, unknown>;
      user_metadata: Record<string, unknown>;
    }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not read accounts");
      users.push(...(data.users as never[]));
      if (data.users.length < 1000) break;
    }
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [subs, contacts, events] = await Promise.all([
      supabaseAdmin.from("subscriptions").select("user_id,status,current_period_end,environment"),
      supabaseAdmin.from("marketing_contacts").select("*"),
      supabaseAdmin
        .from("login_events")
        .select("user_id,created_at,city,region,country,timezone")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000),
    ]);
    const subsBy = new Map<string, { status: string; current_period_end: string | null }[]>();
    for (const s of subs.data ?? []) subsBy.set(s.user_id, [...(subsBy.get(s.user_id) ?? []), s]);
    const contactBy = new Map((contacts.data ?? []).map((c) => [c.user_id, c]));
    const lastPlace = new Map<string, FounderAccount["lastPlace"]>();
    const count30 = new Map<string, number>();
    for (const e of events.data ?? []) {
      if (!lastPlace.has(e.user_id))
        lastPlace.set(e.user_id, {
          city: e.city,
          region: e.region,
          country: e.country,
          timezone: e.timezone,
        });
      count30.set(e.user_id, (count30.get(e.user_id) ?? 0) + 1);
    }

    const accounts: FounderAccount[] = users.map((u) => {
      const email = (u.email ?? "").toLowerCase();
      const c = contactBy.get(u.id);
      return {
        id: u.id,
        email,
        name: displayName(u.user_metadata, email),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        provider:
          typeof u.app_metadata["provider"] === "string"
            ? (u.app_metadata["provider"] as string)
            : "email",
        plan: accountPlan(email, bestSubscription(email, subsBy.get(u.id) ?? [])),
        optedIn: c?.opted_in ?? false,
        campaignStartedAt: c?.campaign_started_at ?? null,
        loopsSyncedAt: c?.loops_synced_at ?? null,
        loopsError: c?.loops_error ?? "",
        lastPlace: lastPlace.get(u.id) ?? null,
        signIns30d: count30.get(u.id) ?? 0,
      };
    });
    accounts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { accounts, loopsConnected: loopsConfigured() };
  });

/** Sends every opted-in account to Loops and starts the campaign where it qualifies. Admins only. */
export const syncAllToLoops = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loopsConfigured, syncContactToLoops } = await import("@/lib/founder/loops.server");
    if (!loopsConfigured()) return { synced: 0, started: 0, failed: 0, connected: false };
    const { data: rows } = await supabaseAdmin
      .from("marketing_contacts")
      .select("*")
      .or("opted_in.eq.true,loops_synced_at.not.is.null");
    let synced = 0;
    let started = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      const r = await syncContactToLoops(supabaseAdmin, row);
      if (r.synced) synced++;
      if (r.started) started++;
      if (r.error) failed++;
      // Loops allows 10 requests a second; each contact can use up to 2.
      await new Promise((res) => setTimeout(res, 250));
    }
    return { synced, started, failed, connected: true };
  });
