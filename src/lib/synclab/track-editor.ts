import type { Track } from "./types";

/** A sampler channel made by (or for) the Pad Sampler: it opens the Pad Sampler, never the one-shot Sampler. */
export const isPadSamplerTrack = (t: Pick<Track, "kind" | "name" | "padSampler">) =>
  t.kind === "sampler" && (t.padSampler === true || /\bpad sampler\b/i.test(t.name));

/** Which editor a channel opens: drums → drum machine, pad-sampler channel → pad sampler, sampler → sampler, synths → synth. */
export function editorPanelFor(
  t: Pick<Track, "kind" | "name" | "padSampler">,
): "drums" | "pads" | "sampler" | "synth" | null {
  if (t.kind === "drum") return "drums";
  if (t.kind === "sampler") return isPadSamplerTrack(t) ? "pads" : "sampler";
  if (t.kind === "instrument" || t.kind === "midi") return "synth";
  return null;
}
