import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { clampBeat, resumesVisit } from "./visits";
import { describeDevice, displayName } from "./insights";

type Admin = SupabaseClient<Database>;

/**
 * Adds on-screen seconds to a visit (starting or resuming one when no visit id is given) and
 * optionally marks it as ended. Only touches the caller's own visits.
 */
export async function recordVisitBeat(
  admin: Admin,
  me: { id: string; email: string; meta: Record<string, unknown> | null },
  opts: { visitId?: string | undefined; seconds: number; ended?: boolean; userAgent?: string },
): Promise<{ visitId: string | null }> {
  const add = clampBeat(opts.seconds);
  const now = new Date().toISOString();
  if (opts.visitId) {
    const { data: row } = await admin
      .from("app_visits")
      .select("id,active_seconds")
      .eq("id", opts.visitId)
      .eq("user_id", me.id)
      .maybeSingle();
    if (row) {
      await admin
        .from("app_visits")
        .update({
          active_seconds: row.active_seconds + add,
          last_seen_at: now,
          ended_at: opts.ended ? now : null,
        })
        .eq("id", row.id);
      return { visitId: row.id };
    }
  }
  if (opts.ended) return { visitId: null };
  const { data: latest } = await admin
    .from("app_visits")
    .select("id,active_seconds,ended_at,last_seen_at")
    .eq("user_id", me.id)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && resumesVisit(latest)) {
    await admin
      .from("app_visits")
      .update({ active_seconds: latest.active_seconds + add, last_seen_at: now, ended_at: null })
      .eq("id", latest.id);
    return { visitId: latest.id };
  }
  const { data: created, error } = await admin
    .from("app_visits")
    .insert({
      user_id: me.id,
      name: displayName(me.meta, me.email),
      email: me.email,
      device: describeDevice(opts.userAgent ?? "").device,
      active_seconds: add,
    })
    .select("id")
    .single();
  if (error) console.error("visit insert failed", error);
  return { visitId: created?.id ?? null };
}
