import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const askCoProducerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().min(1).max(1000), song: z.string().max(4000) }).parse(d))
  .handler(async ({ data }) => {
    const { askCoProducer } = await import("@/lib/co-producer.server");
    try {
      return { ok: true as const, result: await askCoProducer(data.question, data.song) };
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      const message =
        status === 402 ? "Out of AI credits — add credits to keep using the co-producer."
        : status === 429 ? "The co-producer is busy. Wait a moment, then ask again."
        : e instanceof Error ? e.message : "The co-producer couldn't answer.";
      return { ok: false as const, error: message };
    }
  });
