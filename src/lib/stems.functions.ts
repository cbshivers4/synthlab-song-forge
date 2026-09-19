import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  genre: z.string().min(1).max(60),
  bpm: z.number().min(40).max(220),
  key: z.string().min(1).max(20),
  bars: z.number().min(1).max(8),
  brief: z.string().max(500),
  /** plain-text description of what is already in the song */
  context: z.string().max(4000),
  /** how many parts to write */
  count: z.number().min(1).max(5),
});

const Note = z.object({
  step: z.number(),
  length: z.number(),
  pitch: z.number(),
  velocity: z.number(),
});

const Part = z.object({
  name: z.string(),
  role: z.enum(["drums", "bass", "lead", "pad", "arp", "perc", "chords"]),
  why: z.string(),
  /** synth preset name for melodic parts, drum kit id for drum parts */
  sound: z.string(),
  notes: z.array(Note),
  /** drum grid: one row per voice, 0..1 per step */
  drums: z.array(z.object({ voice: z.enum(["kick", "snare", "clap", "hat", "openhat", "tom", "perc", "rim"]), steps: z.array(z.number()) })),
});

const Result = z.object({
  advice: z.string(),
  parts: z.array(Part),
});

const SYSTEM = `You write complementary musical parts for SYNCLAB, a browser DAW built in Detroit.
The DAW plays your output with built-in instruments: a 4-oscillator synth and a drum machine. You write note patterns, not audio.

Grid: 1 step = a 1/16 note. Bar = 16 steps. Write patterns that loop cleanly over the requested number of bars.
Melodic parts: notes[] with step (0-based), length in steps, pitch as a MIDI note number (bass 28-48, lead 60-84, pads 48-72), velocity 0.3-1.
Drum parts: drums[] rows, one per voice, steps[] of 0..1 values (0 = silent), exactly bars*16 entries per row, and notes must be [].
Melodic parts must leave drums as [].

Pick "sound" from these synth presets for melodic parts:
Cybotron Lead, Night Arp, Metro Pluck, Supersaw Anthem, Hoover Rave, Detroit Stab, Sub Bass, Ghetto Tech Bass, 303 Acid, Reese Bass, Moog Mono, 808 Sub Glide, Deep Keys, Belleville Strings, Rhodes Soul, FM Bell, Warehouse Pad, Void Ambient, Glass Pad, Dub Chord, Assembly Line, Vocoder Bot, Sci-Fi Sweep.
For drum parts pick one kit id: 909, 808, 707, 606, cr78, linn, dmx, mpc60, detroit, techno, house, ghettotech, lofi, boombap, trap, jungle, industrial.

Respect the genre's real conventions: Detroit techno (sparse 909, minor 7th stabs, Reese bass), trance (rolling 16th bass, supersaw, long builds), italo disco (octave bass arpeggios, bright bell melodies, gated claps), ghetto tech (fast 140-160 broken kicks, chopped hats, booty bass), electro (808 kick/snare, syncopated funk bass, vocoder), house (4/4, off-beat open hats, chords on the &).
Stay in the given key. Make every part sit with what is already in the song — no clashing with an existing bassline or lead.
"why" is one short sentence for the producer. "advice" is one or two sentences on arranging the new parts.`;

export const generateParts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not set up for this project yet.");

    const { streamText, Output } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai-gateway.server");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const prompt = `Genre: ${data.genre}
Tempo: ${data.bpm} BPM
Key: ${data.key}
Length: ${data.bars} bar(s) = ${data.bars * 16} steps
Write ${data.count} new part(s) that go with what is already there.
Producer's brief: ${data.brief || "(none — use your judgement for the genre)"}

Already in the song:
${data.context || "(empty session — write the foundation parts)"}`;

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: SYSTEM,
        prompt,
        output: Output.object({ schema: Result }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      return await result.output;
    } catch (error) {
      const status =
        (error as { statusCode?: number })?.statusCode ?? (error as { status?: number })?.status;
      if (status === 429) throw new Error("The AI is busy right now — wait a moment and try again.");
      if (status === 402) throw new Error("This workspace is out of AI credits. Add credits in Lovable to keep generating parts.");
      if (status === 403) throw new Error("AI access is blocked for this workspace by an admin setting.");
      throw new Error((error as Error)?.message || "The parts could not be generated.");
    }
  });
