/** What the AI stem separator can pull out of a song, and which model each choice needs. */
export type AiStemId = "vocals" | "drums" | "bass" | "guitar" | "piano" | "other" | "instrumental";
export type DrumPieceId = "kick" | "snare" | "hihat" | "toms" | "crash" | "ride" | "percussion";
export type AiQuality = "clean" | "six";

export const AI_STEMS: { id: AiStemId; label: string; hint: string }[] = [
  { id: "vocals", label: "Vocals", hint: "Lead and backing voices." },
  { id: "drums", label: "Drums", hint: "The whole drum kit and percussion." },
  { id: "bass", label: "Bass", hint: "Bass guitar, synth bass and 808 notes." },
  { id: "guitar", label: "Guitar", hint: "Electric and acoustic guitars." },
  {
    id: "piano",
    label: "Piano & keys",
    hint: "Piano, organ and keys. The weakest part — expect some bleed.",
  },
  {
    id: "other",
    label: "Other instruments",
    hint: "Strings, synths, pads, horns — everything not listed.",
  },
  { id: "instrumental", label: "Instrumental (no vocals)", hint: "Everything except the vocals." },
];

export const DRUM_PIECES: { id: DrumPieceId; label: string }[] = [
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare" },
  { id: "hihat", label: "Hi-hat" },
  { id: "toms", label: "Toms" },
  { id: "crash", label: "Crash" },
  { id: "ride", label: "Ride" },
  { id: "percussion", label: "Percussion" },
];

/**
 * Guitar or piano need the 6-instrument model. Otherwise the fine-tuned 4-part model is used,
 * because it leaves the least bleed between vocals, drums, bass and the rest.
 */
export function qualityFor(picked: readonly AiStemId[]): AiQuality {
  return picked.includes("guitar") || picked.includes("piano") ? "six" : "clean";
}

/** Separator part names summed for each choice. In the 4-part model "other" also holds guitar and piano. */
export function partsFor(id: AiStemId, quality: AiQuality): string[] {
  if (id === "instrumental")
    return quality === "six"
      ? ["drums", "bass", "guitar", "piano", "other"]
      : ["drums", "bass", "other"];
  return [id];
}
