import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "@/lib/ai-gateway.server";

export const coProducerSchema = z.object({
  reply: z.string(),
  kind: z.enum(["none", "chords", "melody", "bass", "drums"]),
  trackName: z.string(),
  lyrics: z.string(),
  notes: z.array(z.object({ step: z.number(), length: z.number(), pitch: z.number(), velocity: z.number() })),
  drumHits: z.array(z.object({
    kind: z.enum(["kick", "snare", "hat", "openhat", "clap", "rim", "tom", "perc", "ride", "crash", "fx"]),
    step: z.number(),
    velocity: z.number(),
  })),
});
export type CoProducerResult = z.infer<typeof coProducerSchema>;

const INSTRUCTIONS = `You are the SYNCLAB co-producer, a friendly expert music producer and songwriter inside a DAW.
Answer the producer's question in plain, encouraging language (under 120 words, no jargon walls).
When they ask for musical material (chords, melody, bassline, drum pattern), also return it:
- Time is in sixteenth-note steps from 0. One bar = beatsPerBar*4 steps. Keep material within the requested bars (default 4 bars, max 8).
- notes: MIDI pitches (chords 48-72, melody 60-84, bass 28-52), velocity 0-1, length in steps >= 1. Chords = several notes sharing a step.
- drumHits: one entry per hit, velocity 0-1.
- Set kind to the material type and give a short UPPERCASE trackName. Otherwise kind "none", empty arrays and trackName "".
When they ask for lyrics (a verse, hook, chorus, full song, or help finishing lines), write original lyrics in the lyrics field:
- Structure them with section labels like [Verse 1], [Hook], [Chorus], [Bridge] on their own lines.
- Match the mood, genre and tempo of the song when described. Keep it original — never copy existing songs.
- Put only a one-line summary in reply (e.g. "Wrote you a verse and hook — full lyrics below."). Otherwise lyrics is "".
Respect the song's key and tempo when given.`;

export async function askCoProducer(question: string, song: string): Promise<CoProducerResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this app.");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: INSTRUCTIONS,
    messages: [{ role: "user", content: `Song:\n${song}\n\nQuestion: ${question}` }],
    output: Output.object({ schema: coProducerSchema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
        strictJsonSchema: true,
      },
    },
  });
  return (await result.output) as CoProducerResult;
}
