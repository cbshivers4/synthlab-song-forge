import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USER_TABLES = [
  "cloud_projects",
  "library_items",
  "subscriptions",
  "support_tickets",
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
