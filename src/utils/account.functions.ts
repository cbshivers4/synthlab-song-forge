import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USER_TABLES = [
  "stem_split_jobs",
  "cloud_projects",
  "library_items",
  "login_events",
  "marketing_contacts",
  "app_visits",
  "founder_notification_prefs",
  "free_access_trials",
  "subscriptions",
  "support_tickets",
  "tape_shelf_items",
  "user_roles",
  "user_visual_settings",
] as const;

const BUCKET = "synclab-cloud";

/** Recursively collect every storage object path under a folder prefix. */
async function listAllPaths(
  bucket: { list: (path: string, opts?: { limit?: number; offset?: number }) => Promise<{ data: { name: string; id: string | null }[] | null; error: unknown }> },
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
    if (error || !data || data.length === 0) break;
    for (const entry of data) {
      const full = `${prefix}/${entry.name}`;
      // Storage folders have no id; files do.
      if (entry.id === null) paths.push(...(await listAllPaths(bucket, full)));
      else paths.push(full);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return paths;
}

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { paddleFetch } = await import("@/lib/paddle.server");

    // Stop billing first: deleting our rows does not cancel the subscription at Paddle.
    const { data: subs, error: subsError } = await supabaseAdmin
      .from("subscriptions")
      .select("paddle_subscription_id, environment, status")
      .eq("user_id", userId)
      .neq("status", "canceled");
    if (subsError) {
      console.error("account deletion: could not read subscriptions", subsError);
      throw new Error("Could not check your subscription. Please try again.");
    }
    for (const sub of subs ?? []) {
      const env = sub.environment === "live" ? "live" : "sandbox";
      const res = await paddleFetch(env, `/subscriptions/${encodeURIComponent(sub.paddle_subscription_id)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ effective_from: "immediately" }),
      });
      // 404 / already-canceled means there is nothing left to stop.
      if (!res.ok && res.status !== 404 && res.status !== 409) {
        console.error(`account deletion: Paddle cancel failed [${res.status}]`, await res.text().catch(() => ""));
        throw new Error("Could not cancel your subscription, so your account was not deleted. Please try again.");
      }
    }

    // Remove them from the email service before their contact record is deleted.
    const { deleteLoopsContact } = await import("@/lib/founder/loops.server");
    await deleteLoopsContact(supabaseAdmin, userId);

    for (const table of USER_TABLES) {
      const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
      if (error) {
        console.error(`account deletion: failed on ${table}`, error);
        throw new Error("Could not remove all of your data. Please try again.");
      }
    }

    // Remove every stored file under the user's prefix. Storage cleanup
    // failures are logged but must not block account removal.
    try {
      const bucket = supabaseAdmin.storage.from(BUCKET);
      const paths = await listAllPaths(bucket, userId);
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await bucket.remove(paths.slice(i, i + 100));
        if (error) console.error("account deletion: storage remove failed", error);
      }
    } catch (err) {
      console.error("account deletion: storage cleanup failed", err);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("account deletion: auth delete failed", error);
      throw new Error("Could not delete the account. Please try again.");
    }
    return { ok: true };
  });
