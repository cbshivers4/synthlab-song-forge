import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { refundAiUse, reserveAiUse } from "@/lib/ai-quota";

const errOf = (e: unknown) => (e instanceof Error ? e.message : "Stem separation failed.");

export const startStemSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ audio: z.string().min(16).max(60_000_000), name: z.string().max(200), mime: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { startStemSplit } = await import("@/lib/stem-split.server");
    const use = await reserveAiUse(context.supabase, "stems");
    if (!use.ok) return { ok: false as const, error: use.error };
    try {
      const bin = atob(data.audio);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { ok: true as const, id: await startStemSplit(bytes, data.name, data.mime), remaining: use.remaining };
    } catch (e) {
      await refundAiUse(context.supabase, use.id);
      return { ok: false as const, error: errOf(e) };
    }
  });

export const checkStemSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1).max(100).regex(/^[a-z0-9]+$/i) }).parse(d))
  .handler(async ({ data }) => {
    const { checkStemSplit } = await import("@/lib/stem-split.server");
    try {
      return { ok: true as const, status: await checkStemSplit(data.id) };
    } catch (e) {
      return { ok: false as const, error: errOf(e) };
    }
  });

export const fetchStemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const { fetchStem } = await import("@/lib/stem-split.server");
    try {
      return { ok: true as const, mp3: await fetchStem(data.url) };
    } catch (e) {
      return { ok: false as const, error: errOf(e) };
    }
  });

/** Stops a running separation on the AI service so it doesn't keep working after you press Stop. */
export const cancelStemSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1).max(100).regex(/^[a-z0-9]+$/i) }).parse(d))
  .handler(async ({ data }) => {
    const { cancelStemSplit } = await import("@/lib/stem-split.server");
    try { await cancelStemSplit(data.id); return { ok: true as const }; }
    catch (e) { return { ok: false as const, error: errOf(e) }; }
  });

/** How many AI uses the signed-in person has left today. */
export const aiUsesLeftFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { AI_DAILY_LIMIT } = await import("@/lib/ai-quota");
    const { data, error } = await (context.supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }).rpc("ai_uses_left", { _daily_limit: AI_DAILY_LIMIT });
    return error ? { ok: false as const } : { ok: true as const, left: Number(data), limit: AI_DAILY_LIMIT };
  });
