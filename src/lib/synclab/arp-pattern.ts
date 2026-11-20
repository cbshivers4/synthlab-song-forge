/**
 * Arpeggiator rhythms and note patterns, shared by the live arp (hand-played notes) and song
 * playback/export, so a preset's groove sounds the same everywhere.
 *
 * RHYTHM is a step string: X = accented note, x = note, - = hold the previous note one more step,
 * . = rest. NOTES are semitone offsets laid over the arp's walk through the held keys, so holding a
 * single key plays a whole riff and holding a chord weaves the riff through it.
 */
import type { SynthPatch } from "./types";

export const ARP_RHYTHMS: { id: string; label: string; steps: string }[] = [
  { id: "straight", label: "Straight", steps: "" },
  { id: "accent4", label: "Accent on 1", steps: "Xxxx" },
  { id: "gallop", label: "Gallop", steps: "X.xx" },
  { id: "reverse-gallop", label: "Reverse gallop", steps: "Xx.x" },
  { id: "offbeat", label: "Offbeat", steps: "..X." },
  { id: "tresillo", label: "Tresillo 3-3-2", steps: "X..x..x." },
  { id: "clave", label: "Son clave", steps: "X..x..x...x.x..." },
  { id: "trance-gate", label: "Trance gate", steps: "X.xx.xx.x.xx.x.x" },
  { id: "pulse-hold", label: "Pulse & hold", steps: "X-x-X-xx" },
  { id: "half-time", label: "Half-time", steps: "X---x---" },
  { id: "rolling", label: "Rolling", steps: "Xxx.Xxx.Xxx.Xx.x" },
  { id: "sparse", label: "Sparse", steps: "X.....x...x....." },
  { id: "skip", label: "Skip", steps: "Xx.xXx.x" },
  { id: "dotted", label: "Dotted", steps: "X..X..X..X..X.X." },
  { id: "morse", label: "Morse", steps: "Xx.Xx.x.Xx.x.xx." },
  { id: "stutter", label: "Stutter", steps: "XXx.XXx.x.XXx..." },
  { id: "funk", label: "Funk", steps: "X.xX.x.xX.x..xX." },
  { id: "dembow", label: "Dembow", steps: "X..x..X.X..x..X." },
  { id: "push", label: "Push", steps: ".xX..xX..xX..xXx" },
  { id: "long-short", label: "Long-short", steps: "X--xX--xX-xxX--x" },
];

export const ARP_NOTE_PATTERNS: { id: string; label: string; notes: number[] }[] = [
  { id: "chord", label: "Held keys only", notes: [] },
  { id: "octave", label: "Octave jump", notes: [0, 12] },
  { id: "octave-drop", label: "Octave drop", notes: [0, -12, 0, 12] },
  { id: "fifths", label: "Fifths", notes: [0, 7] },
  { id: "root-fifth-oct", label: "Root-fifth-octave", notes: [0, 7, 12, 7] },
  { id: "berlin", label: "Berlin run", notes: [0, 12, 7, 0, 12, 7, 5, 7] },
  { id: "acid", label: "Acid line", notes: [0, 0, 12, 0, -12, 0, 7, 10] },
  { id: "pedal", label: "Pedal point", notes: [0, 0, 0, 12, 0, 0, 7, 0] },
  { id: "climb", label: "Climb", notes: [0, 5, 7, 12, 17, 19, 24] },
  { id: "fall", label: "Fall", notes: [24, 19, 12, 7, 0] },
  { id: "minor-pent", label: "Minor pentatonic", notes: [0, 3, 5, 7, 10, 12, 10, 7] },
  { id: "major-pent", label: "Major pentatonic", notes: [0, 2, 4, 7, 9, 12, 9, 4] },
  { id: "two-octaves", label: "Two octaves", notes: [0, 12, 24] },
  { id: "sus", label: "Sus echo", notes: [0, 5, 12, 5] },
  { id: "call-answer", label: "Call & answer", notes: [0, 12, 10, 12, 7, 12, 5, 3] },
  {
    id: "electro",
    label: "Electro riff",
    notes: [0, 0, 12, 0, 10, 0, 7, 0, 5, 0, 3, 0, 0, 12, 0, 7],
  },
  { id: "dub", label: "Dub drop", notes: [0, -12, -12, 0] },
  { id: "sparkle", label: "Sparkle", notes: [12, 24, 19, 31, 24, 36] },
];

export const arpRhythmLabel = (steps: string | undefined) =>
  !steps ? "Straight" : (ARP_RHYTHMS.find((r) => r.steps === steps)?.label ?? "Custom");
export const arpNotesLabel = (notes: number[] | undefined) =>
  !notes?.length
    ? "Held keys only"
    : (ARP_NOTE_PATTERNS.find((n) => n.notes.join(",") === notes.join(","))?.label ?? "Custom");

const isHit = (c: string | undefined) => c === "x" || c === "X";

/** Ordered pitches the arp walks through for the held keys (direction × octaves). */
export function arpSequence(pitches: number[], arp: SynthPatch["arp"]): number[] {
  if (pitches.length === 0) return [];
  const base = [...new Set(pitches)].sort((a, b) => a - b);
  const oct = Math.max(1, Math.round(arp.octaves || 1));
  const up: number[] = [];
  for (let o = 0; o < oct; o++) for (const p of base) up.push(p + o * 12);
  switch (arp.direction) {
    case "down":
      return [...up].reverse();
    case "updown":
      return up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up;
    case "alternate":
      return up.flatMap((p, i) => (i === 0 ? [p] : [p, up[0] as number]));
    case "chord":
      return base;
    default:
      return up;
  }
}

/** Stable pseudo-random index so "random" plays the same in the song, the export and the MIDI file. */
const hashIndex = (i: number, n: number) => {
  let h = (i + 1) * 2654435761;
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % n;
};

export interface ArpHit {
  /** one note, or the whole held chord when the direction is "chord" */
  pitches: number[];
  /** velocity multiplier: accents 1, other notes softer */
  accent: number;
  /** note length in arp steps (1 + held "-" steps) */
  length: number;
}

/**
 * What the arp plays on step `tick` (0 = when the keys went down), or null for a rest/hold.
 * Rests don't advance the note walk, so the riff keeps its order whatever the rhythm.
 */
export function arpHit(arp: SynthPatch["arp"], pitches: number[], tick: number): ArpHit | null {
  const seq = arpSequence(pitches, arp);
  if (seq.length === 0 || tick < 0) return null;
  const rhythm = arp.rhythm && /[xX]/.test(arp.rhythm) ? arp.rhythm : "";
  let hitIndex = tick;
  let accent = 1;
  let length = 1;
  if (rhythm) {
    const L = rhythm.length;
    const pos = tick % L;
    const c = rhythm[pos];
    if (!isHit(c)) return null;
    let perCycle = 0;
    let before = 0;
    for (let i = 0; i < L; i++)
      if (isHit(rhythm[i])) {
        perCycle++;
        if (i < pos) before++;
      }
    hitIndex = Math.floor(tick / L) * perCycle + before;
    accent = c === "X" ? 1 : 0.72;
    for (let i = 1; i < L && rhythm[(pos + i) % L] === "-"; i++) length++;
  }
  const motif = arp.notes?.length ? arp.notes : null;
  const offset = motif ? (motif[hitIndex % motif.length] ?? 0) : 0;
  if (arp.direction === "chord") {
    // chord mode: the whole chord on every hit, climbing through the octaves hit by hit
    const oct = Math.max(1, Math.round(arp.octaves || 1));
    const shift = (hitIndex % oct) * 12 + offset;
    return { pitches: seq.map((p) => p + shift), accent, length };
  }
  const idx = arp.direction === "random" ? hashIndex(hitIndex, seq.length) : hitIndex % seq.length;
  return { pitches: [(seq[idx] as number) + offset], accent, length };
}
