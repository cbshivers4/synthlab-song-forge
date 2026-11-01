/** Rule-based bassline generator (music theory, not AI). Steps are sixteenth notes. */
import type { MidiNote, Track } from "./types";

export type BassStyle = "roots" | "octave" | "walking" | "808" | "funk" | "detroit" | "electro" | "house" | "trance" | "ghettotech";
export const BASS_STYLES: { id: BassStyle; label: string; hint: string }[] = [
  { id: "roots", label: "Roots", hint: "One long root note per chord." },
  { id: "octave", label: "Octave bounce", hint: "Disco/house root–octave eighths." },
  { id: "walking", label: "Walking", hint: "Quarter notes stepping toward the next chord." },
  { id: "808", label: "808 trap", hint: "Long subs with syncopated re-hits." },
  { id: "funk", label: "Funk", hint: "Syncopated sixteenths with fifths and octaves." },
  { id: "detroit", label: "Detroit techno", hint: "Rolling off-beat sixteenths that sit between the kicks." },
  { id: "electro", label: "Electro", hint: "Syncopated 808-style line with octave and seventh jumps." },
  { id: "house", label: "House", hint: "Off-beat bass on the 'and' of every beat with a fifth pickup." },
  { id: "trance", label: "Trance", hint: "Galloping 16ths on the three off-steps of each beat." },
  { id: "ghettotech", label: "Ghetto tech", hint: "Fast booty-bass bounce with long subs and quick re-hits." },
];

/** Genre starting points: pattern, sound, key, progression and the usual tempo. */
export const BASS_TEMPLATES: { id: string; label: string; style: BassStyle; sound: string; octave: number; tonic: number; minor: boolean; prog: string; bpm: number }[] = [
  { id: "detroit-techno", label: "Detroit Techno", style: "detroit", sound: "Techno Drone Bass", octave: 1, tonic: 5, minor: true, prog: "1-1-1-1", bpm: 132 },
  { id: "electro", label: "Electro", style: "electro", sound: "Sub Bass", octave: 1, tonic: 0, minor: true, prog: "1-6-4-5", bpm: 126 },
  { id: "house", label: "House", style: "house", sound: "Acid Rubber", octave: 1, tonic: 9, minor: true, prog: "1-6-4-5", bpm: 124 },
  { id: "trance", label: "Trance", style: "trance", sound: "Reese Bass", octave: 1, tonic: 9, minor: true, prog: "6-4-1-5", bpm: 138 },
  { id: "ghetto-tech", label: "Ghetto Tech", style: "ghettotech", sound: "Ghetto Tech Bass", octave: 1, tonic: 7, minor: true, prog: "1-1-1-1", bpm: 150 },
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
    const groove = (pat: [number, number, number, number?][]) =>
      pat.filter(([s]) => s < barSteps).forEach(([s, l, iv, v]) => add(s0 + s, Math.min(l, barSteps - s), r + iv, v ?? 0.8));
    if (style === "detroit") {
      const pat: [number, number, number, number?][] = [];
      for (let beat = 0; beat * 4 < barSteps; beat++) pat.push([beat * 4 + 2, 1, 0, 0.9], [beat * 4 + 3, 1, beat === 3 ? 12 : 0, 0.7]);
      groove(pat);
    }
    if (style === "electro") groove([[0, 2, 0, 1], [3, 1, 0, 0.75], [6, 1, 12, 0.85], [8, 2, 0, 0.9], [10, 1, 10, 0.75], [12, 1, 7, 0.8], [14, 2, 12, 0.85]]);
    if (style === "house") groove([[2, 2, 0, 0.9], [6, 2, 0, 0.85], [10, 2, 0, 0.9], [13, 1, 12, 0.7], [14, 2, 7, 0.8]]);
    if (style === "trance") {
      const pat: [number, number, number, number?][] = [];
      for (let beat = 0; beat * 4 < barSteps; beat++) pat.push([beat * 4 + 1, 1, 0, 0.75], [beat * 4 + 2, 1, 0, 0.9], [beat * 4 + 3, 1, 0, 0.75]);
      groove(pat);
    }
    if (style === "ghettotech") groove([[0, 3, 0, 1], [3, 1, 0, 0.8], [6, 2, 0, 0.9], [10, 1, 12, 0.8], [11, 1, 0, 0.85], [14, 2, 10, 0.8]]);
    if (style === "funk") {
      const pat: [number, number, number][] = [[0, 2, 0], [3, 1, 12], [6, 2, 7], [8, 1, 0], [10, 1, 0], [11, 2, 12], [14, 2, 10]];
      pat.filter(([s]) => s < barSteps).forEach(([s, l, iv], i) => add(s0 + s, l, r + iv, i === 0 ? 0.95 : 0.75));
    }
  });
  return out;
}

/** Clean, headroom-safe version of a bass preset for generated basslines. Root causes of the
 *  distortion it removes: the always-on voice saturation stage (6x gain into a soft clipper),
 *  preset oscillators pitched 1-2 octaves below the written note (C1 notes sounding at 8-16 Hz,
 *  which speakers can only reproduce as distorted harmonics), drive/distortion/bitcrush,
 *  hot resonance, stacked unison voices and instant attacks/releases that click. */
export function cleanBassPatch(p: import("./types").SynthPatch): import("./types").SynthPatch {
  const q: import("./types").SynthPatch = JSON.parse(JSON.stringify(p));
  q.clean = true;
  q.drive = 0;
  q.resonance = Math.min(q.resonance, 4);
  if (q.filter2) q.filter2 = { ...q.filter2, resonance: Math.min(q.filter2.resonance, 4) };
  q.analog = Math.min(q.analog ?? 0, 0.05);
  q.noise = 0;
  q.unison = { ...q.unison, voices: 1, detune: 0 };
  q.voiceMode = "mono";
  q.fx = { ...q.fx, distortion: 0, saturation: 0, bitcrush: 0, chorus: 0, flanger: 0, phaser: 0, delay: 0, reverb: Math.min(q.fx.reverb, 0.05) };
  q.amp = { ...q.amp, attack: Math.max(0.003, q.amp.attack), release: Math.max(0.03, q.amp.release) };
  const on = q.oscillators.filter((o) => o.on);
  // The generator already writes notes in the bass register its Octave menu names, so lift the
  // preset's own sub-octave offset (keeping the oscillators' spacing) to sound at that pitch.
  const lowest = on.length ? Math.min(...on.map((o) => o.octave)) : 0;
  if (lowest < 0) q.oscillators = q.oscillators.map((o) => ({ ...o, octave: o.octave - lowest }));
  const sum = on.reduce((s, o) => s + o.level, 0);
  if (sum > 0.8) q.oscillators = q.oscillators.map((o) => (o.on ? { ...o, level: (o.level * 0.8) / sum } : o));
  return q;
}

/** Small repeatable random generator so the same variation number always gives the same bassline. */
function seeded(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Regenerate: a new take on the same bassline. Variation 0 returns the notes unchanged.
 * Each bar keeps its first (root) note; other notes may move to the octave, fifth or the key's third,
 * and short ghost notes can fill one-step gaps. Notes never leave their bar or overlap.
 */
export function varyBass(notes: MidiNote[], variation: number, minor: boolean, barSteps: number): MidiNote[] {
  if (!variation) return notes;
  const rnd = seeded(variation);
  const third = minor ? 3 : 4;
  const moves = [0, 7, 12, third, minor ? 10 : 9];
  const sorted = [...notes].sort((a, b) => a.step - b.step);
  const rootOf = new Map<number, number>();
  for (const n of sorted) { const bar = Math.floor(n.step / barSteps); if (!rootOf.has(bar)) rootOf.set(bar, n.pitch); }
  const out: MidiNote[] = sorted.map((n) => {
    const bar = Math.floor(n.step / barSteps);
    const root = rootOf.get(bar)!;
    if (n.step === bar * barSteps || n.step === sorted.find((m) => Math.floor(m.step / barSteps) === bar)!.step) return { ...n };
    if (rnd() < 0.4) return { ...n, pitch: root + moves[Math.floor(rnd() * moves.length)]!, velocity: Math.min(1, Math.max(0.5, n.velocity + (rnd() - 0.5) * 0.2)) };
    return { ...n };
  });
  const taken = new Set<number>();
  for (const n of out) for (let s = n.step; s < n.step + n.length; s++) taken.add(s);
  let k = 0;
  for (const n of [...out]) {
    const s = n.step + n.length;
    const bar = Math.floor(n.step / barSteps);
    if (Math.floor(s / barSteps) !== bar || taken.has(s) || rnd() >= 0.2) continue;
    taken.add(s);
    out.push({ id: `${n.id}-ghost-${variation}-${k++}`, step: s, length: 1, pitch: rootOf.get(bar)!, velocity: 0.55 });
  }
  return out.sort((a, b) => a.step - b.step);
}
