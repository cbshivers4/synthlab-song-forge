/**
 * Stable MIDI notes for drum pads.
 *
 * Every pad kind owns one General-MIDI drum note, so a pad always speaks the
 * same note to the drum roll, to MIDI export and to external gear. When a kit
 * has two pads of the same kind the second one steps one note up, which keeps
 * every pad on its own note without inventing a mapping the user cannot see.
 */
import type { DrumPad } from "./types";

export type DrumKind = DrumPad["kind"];

/** General MIDI drum notes, the same ones hardware drum machines send. */
export const GM_DRUM_NOTE: Record<DrumKind, number> = {
  kick: 36,
  rim: 37,
  snare: 38,
  clap: 39,
  hat: 42,
  openhat: 46,
  tom: 45,
  perc: 64,
  crash: 49,
  ride: 51,
  fx: 56,
};

/** Display names used on the pads and on the drum roll rows. */
export const DRUM_KIND_LABEL: Record<DrumKind, string> = {
  kick: "KICK",
  snare: "SNARE",
  clap: "CLAP",
  rim: "RIM",
  hat: "CLOSED HAT",
  openhat: "OPEN HAT",
  tom: "TOM",
  perc: "PERC",
  crash: "CRASH",
  ride: "RIDE",
  fx: "FX",
};

/** Shared display order, independent of each pad's MIDI assignment. */
export const DRUM_KIND_ORDER: DrumKind[] = [
  "kick",
  "snare",
  "hat",
  "openhat",
  "clap",
  "rim",
  "tom",
  "perc",
  "ride",
  "crash",
  "fx",
];

/** Note name for a MIDI number, e.g. 36 -> "C1". */
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = (note: number) => `${NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;

/**
 * The MIDI note a pad sends. An explicit `pad.note` always wins so a producer
 * can remap a pad to match their own gear; otherwise the GM note for its kind
 * is used, offset when the kit repeats a kind.
 */
export function padNote(pad: DrumPad, pads: DrumPad[]): number {
  if (typeof pad.note === "number") return pad.note;
  const base = GM_DRUM_NOTE[pad.kind] ?? 60;
  const sameKind = pads.filter((p) => p.kind === pad.kind);
  const dup = Math.max(0, sameKind.findIndex((p) => p.id === pad.id));
  return Math.min(127, base + dup);
}

/** Display rows retain their resolved MIDI note and original index. */
export function drumRows(pads: DrumPad[]) {
  return pads
    .map((pad, index) => ({ pad, index, note: padNote(pad, pads) }))
    .sort((a, b) => {
      const ai = DRUM_KIND_ORDER.indexOf(a.pad.kind);
      const bi = DRUM_KIND_ORDER.indexOf(b.pad.kind);
      if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return a.index - b.index;
    });
}
