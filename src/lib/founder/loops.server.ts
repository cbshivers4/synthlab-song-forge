/**
 * Loops (email marketing) through the connector gateway. Server-only.
 * Every call is best-effort: a Loops problem is recorded on the contact row and
 * never blocks sign-in, payments or the dashboard.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CAMPAIGN_EVENT, PAID_EVENT } from "./email-campaign";
import { accountPlan, displayName, inCampaignAudience, isPaidPlan, type AccountPlan } from "./insights";
import { isFounderEmail } from "@/lib/synclab/plan-tier";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/loops";
type Admin = SupabaseClient<Database>;

export function loopsConfigured(): boolean {
  return !!process.env["LOVABLE_API_KEY"] && !!process.env["LOOPS_API_KEY"];
}

async function loops(path: string, method: string, body: unknown, idempotencyKey?: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const loopsKey = process.env["LOOPS_API_KEY"];
  if (!lovableKey || !loopsKey) throw new Error("Loops is not connected");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": loopsKey,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 100);
  const res = await fetch(`${GATEWAY_URL}${path}`, { method, headers, body: JSON.stringify(body) });
  const text = await res.text();
  // A reused idempotency key means Loops already has this event.
  if (res.status === 409 && idempotencyKey) return;
  if (!res.ok) {
    console.error(`Loops ${method} ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Loops ${res.status}: ${text.slice(0, 200)}`);
  }
}

/** Newest subscription that gives the best plan for this account. */
export function bestSubscription(
  email: string,
  rows: { status: string; current_period_end: string | null }[],
  now = Date.now(),
): { status: string; current_period_end: string | null } | null {
  const rank: Record<AccountPlan, number> = { founder: 5, pro: 4, trial: 3, past_due: 2, free: 1 };
  let best: (typeof rows)[number] | null = null;
  for (const r of rows) {
    if (!best || rank[accountPlan(email, r, now)] > rank[accountPlan(email, best, now)]) best = r;
  }
  return best;
}

export async function planForUser(admin: Admin, userId: string, email: string): Promise<AccountPlan> {
  const { data } = await admin
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", userId);
  return accountPlan(email, bestSubscription(email, data ?? []));
}

type ContactRow = Database["public"]["Tables"]["marketing_contacts"]["Row"];

/**
 * Sends one account's current state to Loops and starts the 30-day campaign when it
 * qualifies (opted in, unpaid, not started). Only opted-in accounts are added; an
 * opt-out unsubscribes the existing Loops contact. Updates the row with the result.
 */
export async function syncContactToLoops(
  admin: Admin,
  row: ContactRow,
  opts: { justPaid?: boolean } = {},
): Promise<{ synced: boolean; started: boolean; error?: string }> {
  if (!loopsConfigured() || !row.email || isFounderEmail(row.email)) return { synced: false, started: false };
  // Never put someone into Loops who hasn't said yes; only tell Loops about an opt-out
  // when we sent them there before.
  if (!row.opted_in && !row.loops_synced_at) return { synced: false, started: false };
  const plan = row.plan as AccountPlan;
  const paid = isPaidPlan(plan);
  try {
    await loops("/contacts/update", "PUT", {
      email: row.email,
      userId: row.user_id,
      firstName: row.name.split(" ")[0] ?? "",
      subscribed: row.opted_in,
      source: "SYNCLAB app",
      plan,
      isPaid: paid,
    });
    let started = false;
    if (!row.campaign_started_at && inCampaignAudience({ email: row.email, plan, optedIn: row.opted_in })) {
      await loops(
        "/events/send",
        "POST",
        { email: row.email, userId: row.user_id, eventName: CAMPAIGN_EVENT },
        `${CAMPAIGN_EVENT}-${row.user_id}`,
      );
      started = true;
    }
    if (opts.justPaid && paid && row.opted_in) {
      await loops("/events/send", "POST", {
        email: row.email,
        userId: row.user_id,
        eventName: PAID_EVENT,
        eventProperties: { plan },
      });
    }
    const now = new Date().toISOString();
    await admin
      .from("marketing_contacts")
      .update({
        loops_synced_at: now,
        loops_error: "",
        ...(started ? { campaign_started_at: now } : {}),
        updated_at: now,
      })
      .eq("user_id", row.user_id);
    return { synced: true, started };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("marketing_contacts")
      .update({ loops_error: message.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("user_id", row.user_id);
    return { synced: false, started: false, error: message };
  }
}

/** Upserts the contact row (keeping consent) and returns it. */
export async function upsertContact(
  admin: Admin,
  u: { id: string; email: string; meta: Record<string, unknown> | null },
  plan: AccountPlan,
  optIn?: { optedIn: boolean; source: string },
): Promise<ContactRow | null> {
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from("marketing_contacts")
    .select("*")
    .eq("user_id", u.id)
    .maybeSingle();
  const consentChange =
    optIn && optIn.optedIn !== (existing?.opted_in ?? false)
      ? {
          opted_in: optIn.optedIn,
          opted_in_at: optIn.optedIn ? now : null,
          opt_in_source: optIn.optedIn ? optIn.source : existing?.opt_in_source ?? "",
        }
      : {};
  const { data, error } = await admin
    .from("marketing_contacts")
    .upsert(
      {
        user_id: u.id,
        email: u.email,
        name: displayName(u.meta, u.email),
        plan,
        updated_at: now,
        ...consentChange,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) {
    console.error("marketing contact upsert failed", error);
    return null;
  }
  return data;
}

/** After a payment change: record the new plan and stop/notify the campaign in Loops. */
export async function syncAccountPlan(admin: Admin, userId: string): Promise<void> {
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const email = u.user?.email?.toLowerCase();
  if (!email) return;
  const plan = await planForUser(admin, userId, email);
  const row = await upsertContact(admin, { id: userId, email, meta: u.user?.user_metadata ?? null }, plan);
  if (row) await syncContactToLoops(admin, row, { justPaid: isPaidPlan(plan) });
}

/** Account deletion: remove the person from Loops too. Best-effort. */
export async function deleteLoopsContact(admin: Admin, userId: string): Promise<void> {
  if (!loopsConfigured()) return;
  const { data: row } = await admin
    .from("marketing_contacts")
    .select("email,loops_synced_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row?.loops_synced_at || !row.email) return;
  try {
    await loops("/contacts/delete", "POST", { email: row.email });
  } catch (e) {
    console.error("Loops contact delete failed", e);
  }
}
