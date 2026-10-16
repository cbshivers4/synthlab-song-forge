import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateStemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ prompt: z.string().min(3).max(800), instrument: z.string().max(60), bpm: z.number().min(40).max(240), key: z.string().max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "AI is not configured for this app." };
    const inst = data.instrument || "instrument";
    const drumWords = /drum|percussion/i.test(inst)
      ? "No melodic or harmonic instruments at all."
      : "Absolutely no drums, no percussion, no kick, no snare, no hi-hats, no drum machine, no beat.";
    const vocalWords = /vocal|voice/i.test(inst) ? "" : " No vocals, no singing, no spoken word, no vocal samples.";
    const text = [
      `SOLO ${inst} stem only — a single unaccompanied ${inst} recorded on its own, as an isolated multitrack stem.`,
      `Only the ${inst} is audible for the entire clip. ${drumWords}${vocalWords} No backing track, no accompaniment, no other instruments, no bass unless the instrument is bass, no pads, no atmosphere or background music.`,
      `Tempo ${data.bpm} BPM.${data.key ? ` Key ${data.key}.` : ""} Loop-friendly, clean, dry mono-to-stereo studio recording with no reverb tail and no mix bus processing.`,
      `Style reference only (do not add the other instruments this style normally has, even if the genre usually has a beat): ${data.prompt}`,
    ].join(" ");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/music", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/lyria-3-clip-preview", input: [{ type: "user_input", content: [{ type: "text", text }] }] }),
    });
    if (!res.ok) {
      let msg = "";
      try { const j = (await res.json()) as { message?: string; error?: { message?: string } }; msg = j.message ?? j.error?.message ?? ""; } catch { /* not json */ }
      const error =
        res.status === 402 ? msg || "Out of AI credits — add credits to keep generating."
        : res.status === 429 ? "The music generator is busy. Wait a minute, then try again."
        : res.status === 403 ? msg || "Music generation isn't available for this workspace."
        : msg || `Generation failed (${res.status}).`;
      return { ok: false as const, error, status: res.status };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { ok: true as const, mp3: btoa(bin) };
  });
