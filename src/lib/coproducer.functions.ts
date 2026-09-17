import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
  session: z.string(),
});

const SYSTEM = `You are the SYNCLAB AI Co-Producer, a seasoned Detroit electronic music producer and mix engineer.
You help inside SYNCLAB, a browser DAW with: a 4-oscillator synth (67 presets), a drum machine (24 kits: 909, 808, 707, LinnDrum, and more), a 64-pad sampler with slicing, a sampler, a bass generator, a piano roll, a vocoder, a mixing console with buses, sends and 16 built-in effects, and WAV/MP3 export.
Give concrete, actionable production advice: exact BPM, keys, note patterns, kit and preset names, effect settings, arrangement moves.
Keep answers tight — short paragraphs or bullets, no filler. Never claim to change the session yourself; tell the user which SYNCLAB control to use.`;

export const askCoProducer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project yet.");

    const { streamText } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai-gateway.server");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: {
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      fetch: runIdFetch.fetch,
    });

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: `${SYSTEM}\n\nCurrent session:\n${data.session}`,
        messages: data.messages,
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
      const text = await result.text;
      return { text: text.trim() || "I could not produce an answer for that — try rephrasing." };
    } catch (error) {
      const status = (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { status?: number })?.status;
      if (status === 429) throw new Error("The AI is busy right now — wait a moment and ask again.");
      if (status === 402) throw new Error("This workspace is out of AI credits. Add credits in Lovable to keep using the Co-Producer.");
      if (status === 403) throw new Error("AI access is blocked for this workspace by an admin setting.");
      throw new Error((error as Error)?.message || "The Co-Producer could not be reached.");
    }
  });
