import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { refundAiUse, reserveAiUse } from "@/lib/ai-quota";

const errOf = (e: unknown) => (e instanceof Error ? e.message : "Stem separation failed.");
const NOT_YOURS = "That stem separation job was not found for your account.";

/** True only when the signed-in caller started this job (RLS limits rows to the caller's own). */
async function ownsJob(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase
    .from("stem_split_jobs")
    .select("prediction_id")
    .eq("prediction_id", id)
    .maybeSingle();
  return !error && !!data;
}

export const startStemSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        audio: z.string().min(16).max(60_000_000),
        name: z.string().max(200),
        mime: z.string().max(100),
        quality: z.enum(["standard", "clean", "six"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { startStemSplit } = await import("@/lib/stem-split.server");
    const use = await reserveAiUse(context.supabase, "stems");
    if (!use.ok) return { ok: false as const, error: use.error };
    try {
      const bin = atob(data.audio);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const id = await startStemSplit(bytes, data.name, data.mime, data.quality ?? "standard");
      // Bind the job to this account (service role only, so nobody can claim someone else's job ID).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("stem_split_jobs")
        .insert({ prediction_id: id, user_id: context.userId });
      if (error) {
        console.error("stem split: could not record job owner", error);
        const { cancelStemSplit } = await import("@/lib/stem-split.server");
        await cancelStemSplit(id).catch(() => undefined);
        throw new Error("Stem separation could not be started. Please try again.");
      }
      return { ok: true as const, id, remaining: use.remaining };
    } catch (e) {
      await refundAiUse(context.supabase, use.id);
      return { ok: false as const, error: errOf(e) };
    }
  });

const DRUM_PROMPTS: Record<string, string> = {
  kick: "kick drum",
  snare: "snare drum",
  hihat: "hi-hat cymbal",
  toms: "tom-tom drums",
  crash: "crash cymbal",
  ride: "ride cymbal",
  percussion: "hand percussion and shaker",
};

/**
 * Splits a drums-only recording into pieces (kick, snare, hi-hat…), one AI job per piece.
 * Counts as one AI use for the whole kit; the use is given back if nothing could start.
 */
export const startDrumSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        url: z.string().url().max(2000).optional(),
        audio: z.string().min(16).max(60_000_000).optional(),
        name: z.string().max(200).optional(),
        mime: z.string().max(100).optional(),
        pieces: z
          .array(z.enum(["kick", "snare", "hihat", "toms", "crash", "ride", "percussion"]))
          .min(1)
          .max(7),
      })
      .refine((v) => !!v.url !== !!v.audio, "Send either a drums link or a drums file.")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { startDrumSplit, cancelStemSplit } = await import("@/lib/stem-split.server");
    const use = await reserveAiUse(context.supabase, "stems");
    if (!use.ok) return { ok: false as const, error: use.error };
    try {
      let source: Parameters<typeof startDrumSplit>[0];
      if (data.url) source = { url: data.url };
      else {
        const bin = atob(data.audio!);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        source = { bytes, fileName: data.name || "drums.mp3", mime: data.mime || "audio/mpeg" };
      }
      const pieces = [...new Set(data.pieces)];
      const jobs = await startDrumSplit(
        source,
        pieces.map((id) => ({ id, prompt: DRUM_PROMPTS[id]! })),
      );
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("stem_split_jobs")
        .insert(jobs.map((j) => ({ prediction_id: j.id, user_id: context.userId })));
      if (error) {
        console.error("drum split: could not record job owner", error);
        await Promise.all(jobs.map((j) => cancelStemSplit(j.id).catch(() => undefined)));
        throw new Error("The drum split could not be started. Please try again.");
      }
      return { ok: true as const, jobs, remaining: use.remaining };
    } catch (e) {
      await refundAiUse(context.supabase, use.id);
      return { ok: false as const, error: errOf(e) };
    }
  });

export const checkStemSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        id: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9]+$/i),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { checkStemSplit } = await import("@/lib/stem-split.server");
    if (!(await ownsJob(context.supabase, data.id)))
      return { ok: false as const, error: NOT_YOURS };
    try {
      return { ok: true as const, status: await checkStemSplit(data.id) };
    } catch (e) {
      return { ok: false as const, error: errOf(e) };
    }
  });

export const fetchStemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ url: z.string().url().max(2000) }).parse(d))
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
  .validator((d) =>
    z
      .object({
        id: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9]+$/i),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { cancelStemSplit } = await import("@/lib/stem-split.server");
    if (!(await ownsJob(context.supabase, data.id)))
      return { ok: false as const, error: NOT_YOURS };
    try {
      await cancelStemSplit(data.id);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: errOf(e) };
    }
  });

/** How many AI uses the signed-in person has left today. */
export const aiUsesLeftFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { AI_DAILY_LIMIT } = await import("@/lib/ai-quota");
    const { data, error } = await (
      context.supabase as unknown as {
        rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      }
    ).rpc("ai_uses_left", { _daily_limit: AI_DAILY_LIMIT });
    return error
      ? { ok: false as const }
      : { ok: true as const, left: Number(data), limit: AI_DAILY_LIMIT };
  });
