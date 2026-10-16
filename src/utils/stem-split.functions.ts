import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const errOf = (e: unknown) => (e instanceof Error ? e.message : "Stem separation failed.");

export const startStemSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ audio: z.string().min(16).max(60_000_000), name: z.string().max(200), mime: z.string().max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { startStemSplit } = await import("@/lib/stem-split.server");
    try {
      const bin = atob(data.audio);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { ok: true as const, id: await startStemSplit(bytes, data.name, data.mime) };
    } catch (e) {
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
