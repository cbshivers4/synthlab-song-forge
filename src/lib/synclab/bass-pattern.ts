/** Hand-written bass step patterns (Bassline-Generator style): you choose every note. */
import type { MidiNote } from "./types";

/** One step: off (null) or a note `degree` scale steps above the bar's root (0 = root, 7 = octave). */
export interface BassStep { degree: number; accent: boolean; tie: boolean }
export type BassPattern = (BassStep | null)[];

export const DEGREE_ROWS = 15; // two octaves of scale notes plus the top root
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export function degreeSemis(degree: number, minor: boolean): number {
  const scale = minor ? MINOR : MAJOR;
  const d = Math.max(0, Math.round(degree));
  return Math.floor(d / 7) * 12 + (scale[d % 7] as number);
}

const P = (s: string): BassPattern =>
  s.split(" ").map((t) => {
    if (t === "." ) return null;
    const accent = t.includes("!");
    const tie = t.includes("~");
    return { degree: Number(t.replace(/[!~]/g, "")), accent, tie };
  });

/** Factory step patterns (16 steps each, degree numbers; ! = accent, ~ = tie into next step). */
export const BASS_PATTERN_PRESETS: { id: string; label: string; steps: BassPattern }[] = [
  { id: "offbeat", label: "OnBeat / OffBeat", steps: P(". . 0! . . . 0 . . . 0! . . . 0 .") },
  { id: "rolling", label: "Detroit Roll", steps: P(". . 0! 7 . . 0 6 . . 0! 7 . . 4 2") },
  { id: "acid", label: "Acid Line", steps: P("0! 0 7! 0 . 3~ 4 0 0! . 6 0 2! 0 7 .") },
  { id: "electro", label: "Electro Funk", steps: P("0!~ 0~ 0 0 7! . 6 . 4! . . 3 2!~ 2 . .") },
  { id: "house", label: "House Pump", steps: P(". . 0! . . . 0! 7 . . 0! . . . 4! .") },
  { id: "disco", label: "Disco Octaves", steps: P("0! . 7 . 0! . 7 . 0! . 7 . 0! . 7 .") },
  { id: "trance", label: "Trance Gallop", steps: P(". 0 0 7! . 0 0 7! . 0 0 7! . 4 4 7!") },
  { id: "ghetto", label: "Ghetto Bounce", steps: P("0!~ 0~ 0 0 7! . 0!~ 0 0!~ 0~ 0 0 6! . 7! .") },
  { id: "808", label: "808 Slide", steps: P("0!~ 0~ 0~ 0 . . . 0 . . 4!~ 4 . 3 . .") },
  { id: "walk", label: "Walking", steps: P("0! . . . 2 . . . 4! . . . 5 . . .") },
  { id: "minimal", label: "Minimal Pulse", steps: P("0! . . 0 . . 0 . . 0! . . 0 . . .") },
  { id: "funk", label: "Funk Pop", steps: P("0! . 7 0 . 0 . 6 . 4! . 0 7 . 0 2") },
];

export const emptyPattern = (n = 16): BassPattern => Array.from({ length: n }, () => null);

/** Resizes to 16 or 32 steps, repeating the first half when growing. */
export function resizePattern(p: BassPattern, n: number): BassPattern {
  return Array.from({ length: n }, (_, i) => p[i % p.length] ?? null);
}

/** Fills each bar with the pattern over that bar's chord root; ties merge into one longer note. */
export function patternToNotes(p: BassPattern, roots: number[], barSteps: number, octave: number, minor: boolean): MidiNote[] {
  const base = 12 * (octave + 1);
  const out: MidiNote[] = [];
  const total = roots.length * barSteps;
  let k = 0;
  for (let i = 0; i < total; ) {
    const st = p[i % p.length];
    if (!st) { i++; continue; }
    let len = 1;
    while (p[(i + len - 1) % p.length]?.tie && i + len < total && (i + len) % barSteps !== 0 && p[(i + len) % p.length]) len++;
    const root = roots[Math.floor(i / barSteps)] ?? 0;
    out.push({ id: `bassp-${k++}`, step: i, length: len, pitch: base + root + degreeSemis(st.degree, minor), velocity: st.accent ? 1 : 0.72 });
    i += len;
  }
  return out;
}

/** Random pattern that stays musical: roots on strong beats, scale notes elsewhere. */
export function randomPattern(n: number, rand = Math.random): BassPattern {
  return Array.from({ length: n }, (_, i) => {
    const strong = i % 4 === 0;
    if (rand() > (strong ? 0.8 : 0.5)) return null;
    const pool = strong ? [0, 0, 7] : [0, 2, 3, 4, 6, 7, 9];
    return { degree: pool[Math.floor(rand() * pool.length)] as number, accent: strong || rand() > 0.75, tie: rand() > 0.85 };
  });
}
