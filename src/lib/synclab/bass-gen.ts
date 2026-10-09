/** Rule-based bassline generator (music theory, not AI). Steps are sixteenth notes. */
import type { MidiNote, Track } from "./types";

export type BassStyle = "roots" | "octave" | "walking" | "808" | "funk";
export const BASS_STYLES: { id: BassStyle; label: string; hint: string }[] = [
  { id: "roots", label: "Roots", hint: "One long root note per chord." },
  { id: "octave", label: "Octave bounce", hint: "Disco/house root–octave eighths." },
  { id: "walking", label: "Walking", hint: "Quarter notes stepping toward the next chord." },
  { id: "808", label: "808 trap", hint: "Long subs with syncopated re-hits." },
  { id: "funk", label: "Funk", hint: "Syncopated sixteenths with fifths and octaves." },
];

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
export const PROGRESSIONS: { id: string; label: string; degrees: number[] }[] = [
  { id: "1-5-6-4", label: "I – V – vi – IV", degrees: [0, 4, 5, 3] },
  { id: "1-6-4-5", label: "I – vi – IV – V", degrees: [0, 5, 3, 4] },
  { id: "1-4-5-1", label: "I – IV – V – I", degrees: [0, 3, 4, 0] },
  { id: "6-4-1-5", label: "vi – IV – I – V", degrees: [5, 3, 0, 4] },
  { id: "1-1-1-1", label: "One-chord groove", degrees: [0, 0, 0, 0] },
];

/** Root pitch class for each bar from progression in a key. */
export function rootsFromKey(tonic: number, minor: boolean, degrees: number[], bars: number) {
  const scale = minor ? MINOR : MAJOR;
  return Array.from({ length: bars }, (_, b) => (tonic + scale[degrees[b % degrees.length]!]!) % 12);
}

/** Root per bar from the lowest note sounding in each bar of the song's note tracks. */
export function rootsFromTracks(tracks: Track[], bars: number, barSteps: number): (number | null)[] {
  return Array.from({ length: bars }, (_, b) => {
    let low: number | null = null;
    for (const t of tracks) {
      if (t.kind !== "instrument" || t.muted || !t.notes?.length || /bass/i.test(t.name)) continue;
      const len = Math.max(1, t.steps || barSteps);
      for (const n of t.notes) {
        const s = n.step % len;
        for (let rep = 0; rep * len < bars * barSteps; rep++) {
          const at = s + rep * len;
          if (at < (b + 1) * barSteps && at + n.length > b * barSteps && (low === null || n.pitch < low)) low = n.pitch;
        }
      }
    }
    return low === null ? null : low % 12;
  });
}

export function generateBass(roots: number[], style: BassStyle, barSteps: number, octave = 1): MidiNote[] {
  const base = 12 * (octave + 1); // octave 1 → C1 = 24
  const out: MidiNote[] = [];
  let k = 0;
  const add = (step: number, length: number, pitch: number, velocity = 0.85) =>
    out.push({ id: `bass-${Date.now()}-${k++}`, step, length, pitch, velocity });
  roots.forEach((pc, b) => {
    const r = base + pc;
    const s0 = b * barSteps;
    const next = base + roots[(b + 1) % roots.length]!;
    if (style === "roots") add(s0, barSteps, r);
    if (style === "octave") for (let s = 0; s < barSteps; s += 2) add(s0 + s, 2, s % 4 === 0 ? r : r + 12, s % 4 === 0 ? 0.9 : 0.7);
    if (style === "walking") {
      const beats = Math.max(1, Math.round(barSteps / 4));
      const pts = [r, r + 4, r + 7, next > r ? next - 1 : next + 1];
      for (let i = 0; i < beats; i++) add(s0 + i * 4, 4, pts[Math.min(i, 3)]!, i === 0 ? 0.9 : 0.75);
    }
    if (style === "808") {
      add(s0, 6, r, 1);
      add(s0 + 7, 3, r, 0.8);
      if (barSteps >= 16) { add(s0 + 10, 6, b % 2 ? r + 12 : r, 0.9); }
    }
    if (style === "funk") {
      const pat: [number, number, number][] = [[0, 2, 0], [3, 1, 12], [6, 2, 7], [8, 1, 0], [10, 1, 0], [11, 2, 12], [14, 2, 10]];
      pat.filter(([s]) => s < barSteps).forEach(([s, l, iv], i) => add(s0 + s, l, r + iv, i === 0 ? 0.95 : 0.75));
    }
  });
  return out;
}
