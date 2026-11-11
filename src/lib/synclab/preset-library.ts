/**
 * Extra factory voices for Spec 4, Poly Synth and Acid Bass, sorted into the
 * standard instrument categories. Each entry is a full description of the
 * patch (unused oscillators are switched off and effects start dry), so every
 * preset sounds the same whatever was loaded before it.
 */
import type { LfoParams, OscWave, SynthPatch } from "./types";

type Osc = [wave: OscWave, octave?: number, semitone?: number, detune?: number, level?: number];
type Env = [attack: number, decay: number, sustain: number, release: number];
export type VoiceCfg = {
  o: Osc[];
  n?: number;
  ft?: BiquadFilterType;
  c: number;
  q?: number;
  dr?: number;
  kt?: number;
  a: Env;
  f?: [...Env, number];
  l?: [LfoParams["destination"], number, LfoParams["wave"], number];
  l2?: [LfoParams["destination"], number, LfoParams["wave"], number];
  u?: [voices: number, detune: number, width: number];
  g?: number;
  m?: "poly" | "mono" | "legato";
  fx?: Partial<SynthPatch["fx"]>;
  arp?: [rate: number, direction: SynthPatch["arp"]["direction"], octaves: number, gate: number, swing?: number];
  an?: number;
};

const PAN = [0, -0.15, 0.15];

export function applyVoice(p: SynthPatch, v: VoiceCfg): void {
  for (let i = 0; i < 3; i++) {
    const cur = p.oscillators[i]!;
    const o = v.o[i];
    p.oscillators[i] = o
      ? { ...cur, on: true, wave: o[0], octave: o[1] ?? 0, semitone: o[2] ?? 0, detune: o[3] ?? 0, level: o[4] ?? (i === 0 ? 0.75 : 0.45), pan: PAN[i] ?? 0 }
      : { ...cur, on: false };
  }
  const wt = p.oscillators[3];
  if (wt) p.oscillators[3] = { ...wt, on: false };
  p.noise = v.n ?? 0;
  p.filterType = v.ft ?? "lowpass";
  p.cutoff = v.c;
  p.resonance = v.q ?? 1;
  p.drive = v.dr ?? 0.05;
  if (v.kt !== undefined) p.keyTracking = v.kt;
  p.amp = { attack: v.a[0], decay: v.a[1], sustain: v.a[2], release: v.a[3] };
  p.filterEnv = v.f
    ? { attack: v.f[0], decay: v.f[1], sustain: v.f[2], release: v.f[3], amount: v.f[4] }
    : { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3, amount: 0 };
  const lfo = (cfg: VoiceCfg["l"], cur: LfoParams): LfoParams =>
    cfg ? { ...cur, on: true, destination: cfg[0], rate: cfg[1], wave: cfg[2], amount: cfg[3] } : { ...cur, on: false };
  p.lfos = p.lfos.map((cur, i) => (i === 0 ? lfo(v.l, cur) : i === 1 ? lfo(v.l2, cur) : { ...cur, on: false }));
  p.unison = v.u ? { voices: v.u[0], detune: v.u[1], width: v.u[2] } : { voices: 1, detune: 0, width: 0 };
  p.glide = v.g ?? 0;
  p.voiceMode = v.m ?? "poly";
  if (p.voiceMode !== "poly") p.glideMode = "legato";
  p.analog = v.an ?? 0.1;
  p.fx = { ...p.fx, distortion: 0, saturation: 0, chorus: 0, delay: 0, delayFeedback: 0.3, reverb: 0.12, bitcrush: 0, ...v.fx };
  p.arp = v.arp
    ? { on: true, rate: v.arp[0], direction: v.arp[1], octaves: v.arp[2], gate: v.arp[3], ...(v.arp[4] ? { swing: v.arp[4] } : {}), sync: true }
    : { ...p.arp, on: false };
}

/** Standard instrument categories, in menu order. */
export const STANDARD_CATEGORIES = [
  "Arpeggio", "Bass", "Brass", "FX", "Keyboard", "Lead", "Organ", "Pad",
  "Percussive", "Sequence", "Strings", "Synth", "Template", "Woodwind",
] as const;
export type StandardCategory = (typeof STANDARD_CATEGORIES)[number];
/** Poly Synth presets carry this prefix on their category so only the Poly Synth lists them. */
export const POLY_CATEGORY_PREFIX = "Poly Synth · ";
export const ACID_CLEAN_CATEGORY = "Acid Bass · Clean";

type Entry = [name: string, voice: VoiceCfg];
type Bank = Partial<Record<StandardCategory, Entry[]>>;

// ---------------- Spec 4 ----------------
export const SPEC4_LIBRARY: Bank = {
  Sequence: [
    ["Hex Grid Sequence", { o: [["sawtooth"], ["square", -1, 0, 0, 0.35]], c: 1600, q: 5, a: [0.002, 0.15, 0.1, 0.1], f: [0.001, 0.12, 0, 0.1, 2200], arp: [2, "up", 2, 0.35], fx: { delay: 0.3, delayFeedback: 0.4 } }],
    ["Pulse Lattice Sequence", { o: [["pulse"]], c: 2400, q: 4, a: [0.002, 0.12, 0.15, 0.08], f: [0.001, 0.1, 0, 0.08, 1500], arp: [4, "updown", 1, 0.3], fx: { delay: 0.2 } }],
    ["Night Shift Sequence", { o: [["sawtooth", -1]], c: 900, q: 9, a: [0.002, 0.18, 0.2, 0.1], f: [0.001, 0.14, 0, 0.1, 2600], arp: [2, "alternate", 2, 0.5, 0.2], fx: { delay: 0.25 } }],
    ["Crystal Step Sequence", { o: [["triangle"], ["sine", 1, 0, 3, 0.3]], c: 5000, a: [0.002, 0.25, 0.05, 0.25], arp: [4, "random", 3, 0.25], fx: { delay: 0.35, reverb: 0.4 } }],
    ["Offbeat Machine Sequence", { o: [["square"]], c: 1800, q: 6, a: [0.001, 0.14, 0.1, 0.08], f: [0.001, 0.09, 0, 0.08, 1800], arp: [2, "down", 1, 0.4, 0.4], fx: { delay: 0.22 } }],
    ["Rolling Ostinato", { o: [["sawtooth"], ["sawtooth", 0, 0, 10, 0.5]], c: 1300, q: 3, a: [0.003, 0.2, 0.3, 0.12], l: ["filter", 0.2, "sine", 0.25], arp: [1, "up", 2, 0.6], fx: { chorus: 0.2, delay: 0.2 } }],
  ],
  Arpeggio: [
    ["Cascade Arp", { o: [["sine"], ["triangle", 1, 0, 2, 0.35]], c: 4200, a: [0.002, 0.3, 0.1, 0.3], arp: [4, "down", 3, 0.4], fx: { delay: 0.4, reverb: 0.35 } }],
    ["Pluck Ladder Arp", { o: [["square"]], c: 1500, q: 4, a: [0.001, 0.15, 0, 0.12], f: [0.001, 0.1, 0, 0.1, 2000], arp: [2, "up", 3, 0.3], fx: { delay: 0.25 } }],
    ["Euphoria Arp", { o: [["sawtooth"], ["sawtooth", 0, 0, 14, 0.5]], u: [3, 14, 0.8], c: 3200, a: [0.003, 0.2, 0.3, 0.2], arp: [4, "up", 2, 0.45], fx: { chorus: 0.25, delay: 0.3, reverb: 0.35 } }],
    ["Midnight Broken Chord", { o: [["triangle"], ["sawtooth", 0, 0, 5, 0.2]], c: 2200, a: [0.002, 0.35, 0.2, 0.3], arp: [2, "alternate", 2, 0.55], fx: { chorus: 0.3, reverb: 0.3 } }],
    ["Bubble Arp", { o: [["sine"]], c: 900, q: 8, a: [0.001, 0.12, 0, 0.1], f: [0.001, 0.08, 0, 0.08, 2800], arp: [4, "updown", 2, 0.25], fx: { delay: 0.3 } }],
  ],
  Bass: [
    ["Analog Mono Bass", { o: [["sawtooth", -1], ["square", -1, 0, 4, 0.4]], c: 700, q: 3, a: [0.003, 0.3, 0.7, 0.12], f: [0.001, 0.2, 0.2, 0.1, 900], m: "mono", g: 0.03 }],
    ["Punch Bass", { o: [["square", -1]], c: 500, q: 2, a: [0.002, 0.25, 0.5, 0.1], f: [0.001, 0.1, 0, 0.1, 1600], m: "mono" }],
    ["Fat Unison Bass", { o: [["sawtooth", -1], ["sawtooth", -1, 0, 12, 0.5]], u: [2, 10, 0.3], c: 900, q: 2, a: [0.003, 0.3, 0.8, 0.15], m: "mono" }],
    ["Sine Thump Bass", { o: [["sine", -1], ["triangle", 0, 0, 0, 0.2]], c: 600, a: [0.002, 0.35, 0.5, 0.15], m: "mono" }],
    ["Pick Bass", { o: [["sawtooth", -1], ["triangle", -1, 0, 3, 0.4]], c: 800, q: 2, a: [0.001, 0.3, 0.3, 0.1], f: [0.001, 0.08, 0, 0.08, 1400], m: "mono" }],
  ],
  Brass: [
    ["Velvet Brass", { o: [["sawtooth"], ["sawtooth", 0, 0, 8, 0.5]], c: 1300, q: 2, a: [0.06, 0.4, 0.8, 0.3], f: [0.05, 0.4, 0.4, 0.3, 1600], fx: { chorus: 0.3, reverb: 0.25 } }],
    ["Stadium Horns", { o: [["sawtooth"], ["sawtooth", 0, 0, 10, 0.5], ["square", 0, 0, -6, 0.2]], u: [3, 12, 0.7], c: 2200, q: 2, a: [0.04, 0.3, 0.85, 0.35], f: [0.03, 0.3, 0.5, 0.3, 1400], fx: { reverb: 0.35 } }],
    ["Soft French Horn", { o: [["triangle"], ["sawtooth", 0, 0, 4, 0.3]], c: 1100, a: [0.12, 0.5, 0.85, 0.5], f: [0.1, 0.4, 0.6, 0.4, 600], l: ["pitch", 5, "sine", 0.05], fx: { reverb: 0.4 } }],
    ["Brass Pad Swell", { o: [["sawtooth"], ["sawtooth", 0, 0, 11, 0.55]], c: 1200, a: [0.6, 0.8, 0.85, 0.9], f: [0.7, 0.8, 0.5, 0.8, 1800], fx: { chorus: 0.4, reverb: 0.45 } }],
    ["Sforzando Brass", { o: [["sawtooth"], ["square", 0, 0, -5, 0.35]], c: 1500, q: 3, a: [0.01, 0.3, 0.6, 0.3], f: [0.005, 0.2, 0.2, 0.2, 2400], fx: { reverb: 0.25 } }],
  ],
  FX: [
    ["Rising Tide", { o: [["sawtooth"]], n: 0.3, c: 500, q: 8, a: [2, 1, 1, 2], l: ["filter", 0.15, "sawtooth", 0.9], fx: { reverb: 0.7 } }],
    ["Data Stream", { o: [["square", 1]], c: 5000, a: [0.005, 0.3, 0.8, 0.2], l: ["pitch", 12, "square", 0.5], fx: { bitcrush: 0.3, delay: 0.3 } }],
    ["Dark Matter Drone", { o: [["sawtooth", -2], ["sine", -1, 0, 0, 0.6]], c: 400, q: 6, a: [1.5, 1, 1, 3], l: ["filter", 0.05, "sine", 0.5], fx: { reverb: 0.8 } }],
    ["Glitch Burst", { o: [["square"]], n: 0.4, c: 3000, q: 4, a: [0.001, 0.4, 0.6, 0.2], l: ["volume", 16, "square", 0.9], fx: { bitcrush: 0.4 } }],
    ["Siren Sweep", { o: [["triangle"]], c: 4000, a: [0.05, 0.3, 0.9, 0.5], l: ["pitch", 0.5, "sine", 0.8], fx: { delay: 0.3, reverb: 0.4 } }],
    ["Filter Downlifter", { o: [["sawtooth"]], n: 0.3, c: 200, q: 6, a: [0.01, 3, 0, 1], f: [0.001, 3, 0, 1, 6000], fx: { reverb: 0.6 } }],
  ],
  Keyboard: [
    ["Crystal EP", { o: [["sine"], ["triangle", 1, 0, 0, 0.25]], c: 3000, a: [0.002, 1.1, 0.25, 0.6], l: ["volume", 4.5, "sine", 0.12], fx: { chorus: 0.3, reverb: 0.25 } }],
    ["Digital Piano", { o: [["triangle"], ["square", 1, 0, 0, 0.12]], c: 3800, a: [0.001, 1.4, 0.08, 0.5], f: [0.001, 0.6, 0.2, 0.4, 1200], fx: { reverb: 0.25 } }],
    ["Vintage Clav", { o: [["pulse"]], c: 2600, q: 5, a: [0.001, 0.25, 0.05, 0.1], f: [0.001, 0.1, 0, 0.1, 1800] }],
    ["Soft Celesta", { o: [["sine", 1], ["sine", 2, 0, 0, 0.2]], c: 6000, a: [0.001, 0.8, 0, 0.6], fx: { reverb: 0.4 } }],
    ["Synth Piano 88", { o: [["sawtooth"], ["triangle", 0, 0, 5, 0.5]], c: 2400, a: [0.002, 0.9, 0.2, 0.4], f: [0.001, 0.4, 0.1, 0.3, 1500], fx: { chorus: 0.15, reverb: 0.25 } }],
  ],
  Lead: [
    ["Neon Saw Lead", { o: [["sawtooth"], ["sawtooth", 0, 0, 9, 0.55]], u: [3, 10, 0.6], c: 3600, q: 3, a: [0.005, 0.3, 0.8, 0.25], g: 0.03, fx: { delay: 0.25, reverb: 0.25 } }],
    ["Pure Whistle Lead", { o: [["sine", 1]], c: 6000, a: [0.03, 0.2, 0.9, 0.2], l: ["pitch", 5.5, "sine", 0.12], fx: { reverb: 0.3 } }],
    ["Sync Scream Lead", { o: [["square"], ["sawtooth", 0, 7, 0, 0.4]], c: 4500, q: 8, a: [0.003, 0.2, 0.7, 0.2], fx: { distortion: 0.15, delay: 0.2 } }],
    ["Mono Glide Lead", { o: [["sawtooth"]], c: 2200, q: 6, a: [0.005, 0.25, 0.75, 0.2], m: "legato", g: 0.1, fx: { delay: 0.3 } }],
    ["Hollow Pulse Lead", { o: [["pulse"], ["triangle", 1, 0, 0, 0.3]], c: 2800, q: 2, a: [0.01, 0.3, 0.7, 0.3], l: ["pitch", 5, "sine", 0.06], fx: { chorus: 0.2, reverb: 0.25 } }],
  ],
  Organ: [
    ["Drawbar Organ 888", { o: [["sine"], ["sine", 1, 0, 0, 0.5], ["sine", 1, 7, 0, 0.35]], c: 7000, a: [0.003, 0.1, 1, 0.08], l: ["pan", 6, "sine", 0.4], fx: { chorus: 0.3 } }],
    ["Gospel Organ", { o: [["sine"], ["sine", 1, 0, 0, 0.55], ["square", 2, 0, 0, 0.08]], c: 5000, a: [0.003, 0.1, 1, 0.1], l: ["volume", 6, "sine", 0.1], fx: { chorus: 0.4, reverb: 0.2 } }],
    ["Church Pipe Organ", { o: [["sine"], ["sine", 1, 0, 0, 0.45], ["triangle", -1, 0, 0, 0.35]], c: 4000, a: [0.08, 0.2, 1, 0.6], fx: { reverb: 0.6 } }],
    ["Combo Organ 60s", { o: [["square"], ["square", 1, 0, 0, 0.3]], c: 3000, a: [0.003, 0.1, 0.95, 0.08], l: ["pitch", 6, "sine", 0.05], fx: { reverb: 0.2 } }],
    ["Jazz Organ Click", { o: [["sine"], ["sine", 1, 0, 0, 0.45], ["sine", 1, 7, 0, 0.3]], n: 0.03, c: 6000, a: [0.002, 0.3, 0.85, 0.08], l: ["pan", 1, "sine", 0.3], fx: { chorus: 0.35 } }],
  ],
  Pad: [
    ["Aurora Pad", { o: [["sawtooth"], ["sawtooth", 0, 0, 12, 0.5], ["triangle", 1, 0, 0, 0.25]], c: 1600, a: [1.2, 1, 0.85, 2.6], l: ["filter", 0.15, "sine", 0.3], fx: { chorus: 0.5, reverb: 0.7 } }],
    ["Velour Pad", { o: [["triangle"], ["sawtooth", 0, 0, 7, 0.3]], c: 1100, a: [0.8, 1, 0.85, 2], fx: { chorus: 0.4, reverb: 0.55 } }],
    ["Evolving Glass Pad", { o: [["sine"], ["triangle", 1, 0, 4, 0.4]], c: 3000, q: 3, a: [1, 1, 0.8, 2.8], l: ["filter", 0.08, "triangle", 0.5], fx: { delay: 0.25, reverb: 0.8 } }],
    ["Warm Blanket Pad", { o: [["sawtooth"], ["sawtooth", 0, 0, 8, 0.55]], u: [2, 12, 0.8], c: 800, a: [0.7, 1, 0.9, 2], fx: { chorus: 0.45, reverb: 0.5 } }],
    ["Distant Choir Pad", { o: [["sawtooth"], ["sawtooth", 0, 0, -9, 0.5]], ft: "bandpass", c: 1000, q: 3, a: [1, 1, 0.85, 2.2], l: ["pitch", 4.5, "sine", 0.04], fx: { chorus: 0.5, reverb: 0.75 } }],
  ],
  Percussive: [
    ["Wood Block Hit", { o: [["sine", 1]], n: 0.1, c: 3000, a: [0.001, 0.06, 0, 0.05] }],
    ["Mallet Hit", { o: [["triangle"], ["sine", 2, 0, 0, 0.2]], c: 4000, a: [0.001, 0.35, 0, 0.3], fx: { reverb: 0.3 } }],
    ["Analog Tom", { o: [["sine", -1]], n: 0.1, c: 1200, a: [0.001, 0.3, 0, 0.2], l: ["pitch", 3, "sawtooth", 0.3] }],
    ["Metallic Ping", { o: [["square"], ["square", 0, 6, 31, 0.5]], ft: "bandpass", c: 3000, q: 10, a: [0.001, 0.4, 0, 0.3], fx: { reverb: 0.35 } }],
    ["Kalimba Tine", { o: [["sine"], ["triangle", 1, 0, 0, 0.3]], c: 3500, a: [0.001, 0.5, 0, 0.4], fx: { reverb: 0.3 } }],
    ["Noise Snap", { o: [["sine", 0, 0, 0, 0.2]], n: 0.7, ft: "bandpass", c: 2000, q: 2, a: [0.001, 0.12, 0, 0.08] }],
  ],
  Synth: [
    ["Spec Supersaw", { o: [["sawtooth"], ["sawtooth", 0, 0, 16, 0.55]], u: [5, 18, 1], c: 4000, a: [0.005, 0.4, 0.8, 0.4], fx: { chorus: 0.3, reverb: 0.35 } }],
    ["Vintage Sync Stab", { o: [["sawtooth"], ["square", 0, 5, 0, 0.4]], c: 2600, q: 4, a: [0.001, 0.25, 0, 0.15], f: [0.001, 0.15, 0, 0.1, 2400], fx: { delay: 0.25 } }],
    ["Digital Bell Synth", { o: [["sine"], ["square", 2, 0, 0, 0.08]], c: 5000, a: [0.001, 0.8, 0.15, 0.6], fx: { reverb: 0.4 } }],
    ["Retro Square Chords", { o: [["square"], ["square", 0, 0, 6, 0.5]], c: 2000, q: 2, a: [0.005, 0.4, 0.6, 0.3], fx: { chorus: 0.35 } }],
    ["Sweep Synth", { o: [["sawtooth"], ["pulse", 0, 0, 7, 0.4]], c: 1200, q: 7, a: [0.01, 0.5, 0.8, 0.4], l: ["filter", 0.5, "sine", 0.5], fx: { chorus: 0.2, delay: 0.2 } }],
  ],
  Strings: [
    ["Spec Silk Violins", { o: [["sawtooth"], ["sawtooth", 0, 0, 7, 0.5]], c: 2500, a: [0.25, 0.6, 0.85, 1], l: ["pitch", 5, "sine", 0.06], fx: { chorus: 0.35, reverb: 0.45 } }],
    ["Spec Viola Section", { o: [["sawtooth"], ["triangle", 0, 0, 5, 0.4]], u: [3, 10, 0.7], c: 1700, a: [0.3, 0.6, 0.85, 1.1], fx: { chorus: 0.3, reverb: 0.4 } }],
    ["Spec Contrabass Strings", { o: [["sawtooth", -1], ["sawtooth", -1, 0, 9, 0.5]], c: 800, a: [0.3, 0.6, 0.85, 1.2], fx: { reverb: 0.4 } }],
    ["Spec Spiccato", { o: [["sawtooth"], ["sawtooth", 0, 0, 6, 0.45]], c: 2200, a: [0.005, 0.18, 0, 0.12], f: [0.001, 0.1, 0, 0.1, 900], fx: { reverb: 0.3 } }],
    ["Spec String Machine", { o: [["sawtooth"], ["square", 0, 0, 8, 0.35]], c: 2800, a: [0.2, 0.5, 0.9, 0.9], fx: { chorus: 0.6, reverb: 0.35 } }],
  ],
  Template: [
    ["Template Init Saw", { o: [["sawtooth"]], c: 8000, a: [0.005, 0.2, 0.8, 0.2], fx: { reverb: 0 } }],
    ["Template Init Square", { o: [["square"]], c: 8000, a: [0.005, 0.2, 0.8, 0.2], fx: { reverb: 0 } }],
    ["Template Init Sine", { o: [["sine"]], c: 8000, a: [0.005, 0.2, 0.8, 0.2], fx: { reverb: 0 } }],
    ["Template Init Triangle", { o: [["triangle"]], c: 8000, a: [0.005, 0.2, 0.8, 0.2], fx: { reverb: 0 } }],
    ["Template Two Osc", { o: [["sawtooth"], ["sawtooth", 0, 0, 8, 0.5]], c: 6000, a: [0.005, 0.2, 0.8, 0.2], fx: { reverb: 0 } }],
    ["Template Filter Env", { o: [["sawtooth"]], c: 600, q: 4, a: [0.005, 0.3, 0.7, 0.2], f: [0.005, 0.3, 0.2, 0.3, 3000], fx: { reverb: 0 } }],
  ],
  Woodwind: [
    ["Breathy Flute", { o: [["triangle"], ["sine", 1, 0, 0, 0.2]], n: 0.05, c: 3000, a: [0.06, 0.2, 0.85, 0.25], l: ["pitch", 5, "sine", 0.08], fx: { reverb: 0.35 } }],
    ["Pan Flute", { o: [["sine"]], n: 0.08, c: 4000, a: [0.04, 0.2, 0.8, 0.3], l: ["pitch", 4.5, "sine", 0.05], fx: { reverb: 0.45 } }],
    ["Clarinet", { o: [["square"]], c: 1800, a: [0.03, 0.2, 0.9, 0.15], l: ["pitch", 5, "sine", 0.04], fx: { reverb: 0.25 } }],
    ["Oboe", { o: [["pulse"]], ft: "bandpass", c: 1400, q: 3, a: [0.04, 0.2, 0.85, 0.15], l: ["pitch", 5.5, "sine", 0.05], fx: { reverb: 0.25 } }],
    ["Soft Sax", { o: [["sawtooth"]], ft: "bandpass", c: 1200, q: 2, a: [0.04, 0.3, 0.8, 0.2], l: ["pitch", 5, "sine", 0.1], g: 0.02, fx: { reverb: 0.3 } }],
    ["Bassoon", { o: [["square", -1]], c: 900, q: 2, a: [0.05, 0.2, 0.85, 0.2], l: ["pitch", 5, "sine", 0.04], fx: { reverb: 0.25 } }],
  ],
};

// ---------------- Poly Synth (8-voice analogue poly) ----------------
const ch = 0.45; // the classic poly chorus
export const POLY_LIBRARY: Bank = {
  Sequence: [
    ["Poly Synth Chord Sequencer", { o: [["sawtooth"], ["sawtooth", 0, 0, 8, 0.55]], c: 1800, q: 4, a: [0.002, 0.18, 0.1, 0.12], f: [0.001, 0.12, 0, 0.1, 1800], arp: [2, "up", 1, 0.3], fx: { chorus: ch, delay: 0.25 } }],
    ["Poly Synth Gated Pulse Seq", { o: [["pulse"], ["sawtooth", 0, 0, 6, 0.4]], c: 2200, a: [0.01, 0.4, 0.9, 0.2], l: ["volume", 8, "square", 0.85], fx: { chorus: ch, reverb: 0.3 } }],
    ["Poly Synth Offbeat Chords Seq", { o: [["sawtooth"], ["square", 0, 0, -6, 0.45]], c: 1500, q: 3, a: [0.002, 0.15, 0, 0.1], f: [0.001, 0.1, 0, 0.1, 2000], arp: [2, "up", 1, 0.35, 0.4], fx: { chorus: ch, delay: 0.3 } }],
    ["Poly Synth Analog Step Seq", { o: [["sawtooth"], ["pulse", -1, 0, 4, 0.4]], c: 1100, q: 8, a: [0.002, 0.14, 0.15, 0.1], f: [0.001, 0.1, 0, 0.08, 2600], arp: [4, "updown", 2, 0.35], fx: { delay: 0.25 } }],
    ["Poly Synth Dub Chord Seq", { o: [["square"], ["sawtooth", 0, 0, 7, 0.4]], c: 900, q: 4, a: [0.003, 0.2, 0, 0.18], f: [0.001, 0.15, 0, 0.15, 1400], arp: [4, "down", 1, 0.25], fx: { chorus: ch, delay: 0.45, delayFeedback: 0.45, reverb: 0.3 } }],
  ],
  Arpeggio: [
    ["Poly Synth Classic Arp", { o: [["pulse"], ["sawtooth", 0, 0, 5, 0.4]], c: 2000, q: 5, a: [0.002, 0.18, 0.15, 0.15], f: [0.001, 0.12, 0, 0.1, 1800], arp: [2, "up", 2, 0.45], fx: { chorus: ch, delay: 0.3 } }],
    ["Poly Synth Sparkle Arp", { o: [["triangle"], ["sine", 1, 0, 4, 0.35]], c: 5000, a: [0.002, 0.3, 0.05, 0.35], arp: [4, "up", 3, 0.3], fx: { chorus: 0.3, delay: 0.4, reverb: 0.45 } }],
    ["Poly Synth Rising Arp", { o: [["sawtooth"], ["sawtooth", 0, 0, 10, 0.5]], c: 2600, q: 3, a: [0.002, 0.2, 0.2, 0.15], arp: [2, "up", 3, 0.4], fx: { chorus: ch, delay: 0.25, reverb: 0.3 } }],
    ["Poly Synth Dream Arp", { o: [["sine"], ["triangle", 1, 0, 6, 0.4]], c: 3500, a: [0.003, 0.4, 0, 0.5], arp: [4, "random", 2, 0.35], fx: { chorus: ch, delay: 0.45, reverb: 0.55 } }],
    ["Poly Synth Synthwave Arp", { o: [["sawtooth"], ["square", -1, 0, 3, 0.35]], c: 1700, q: 6, a: [0.002, 0.15, 0.2, 0.1], f: [0.001, 0.1, 0, 0.08, 2200], arp: [4, "updown", 2, 0.4], fx: { chorus: ch, delay: 0.3, reverb: 0.3 } }],
  ],
  Bass: [
    ["Poly Synth Analog Bass", { o: [["sawtooth", -1], ["pulse", -1, 0, 5, 0.45]], c: 800, q: 3, a: [0.003, 0.3, 0.7, 0.15], f: [0.001, 0.18, 0.2, 0.12, 1000], fx: { chorus: 0.15 } }],
    ["Poly Synth Ladder Bass", { o: [["sawtooth", -1]], c: 450, q: 6, a: [0.002, 0.3, 0.6, 0.12], f: [0.001, 0.2, 0.1, 0.12, 1800] }],
    ["Poly Synth Soft Sub", { o: [["sine", -1], ["triangle", -1, 0, 0, 0.3]], c: 700, a: [0.004, 0.3, 0.85, 0.2] }],
    ["Poly Synth Octave Bass", { o: [["sawtooth", -1], ["sawtooth", 0, 0, 3, 0.3]], c: 1000, q: 2, a: [0.002, 0.25, 0.6, 0.12], f: [0.001, 0.12, 0.1, 0.1, 1200] }],
    ["Poly Synth Funk Bass", { o: [["square", -1], ["sawtooth", -1, 0, 4, 0.3]], c: 600, q: 7, a: [0.001, 0.2, 0.3, 0.08], f: [0.001, 0.09, 0, 0.08, 2200] }],
  ],
  Brass: [
    ["Poly Synth Jump Brass", { o: [["sawtooth"], ["sawtooth", 0, 0, 10, 0.6]], u: [2, 10, 0.6], c: 1800, q: 2, a: [0.02, 0.3, 0.75, 0.3], f: [0.02, 0.3, 0.4, 0.3, 2400], fx: { chorus: ch, reverb: 0.25 } }],
    ["Poly Synth Soft Horns", { o: [["sawtooth"], ["triangle", 0, 0, 6, 0.4]], c: 1100, a: [0.1, 0.5, 0.85, 0.5], f: [0.1, 0.5, 0.5, 0.4, 800], fx: { chorus: 0.35, reverb: 0.35 } }],
    ["Poly Synth Brass Fanfare", { o: [["sawtooth"], ["sawtooth", 0, 0, 7, 0.55], ["square", 0, 0, -4, 0.2]], c: 2400, q: 3, a: [0.03, 0.3, 0.85, 0.4], f: [0.03, 0.25, 0.5, 0.3, 1800], fx: { chorus: 0.3, reverb: 0.4 } }],
    ["Poly Synth Detuned Brass", { o: [["sawtooth"], ["sawtooth", 0, 0, 18, 0.6]], c: 1500, q: 2, a: [0.05, 0.4, 0.8, 0.35], f: [0.04, 0.35, 0.4, 0.3, 1600], fx: { chorus: 0.5 } }],
    ["Poly Synth Brass Stab", { o: [["sawtooth"], ["pulse", 0, 0, 6, 0.5]], c: 1700, q: 3, a: [0.005, 0.25, 0.2, 0.2], f: [0.003, 0.18, 0, 0.15, 2600], fx: { chorus: ch, reverb: 0.25 } }],
  ],
  FX: [
    ["Poly Synth Space Wash", { o: [["sawtooth"], ["triangle", 1, 0, 12, 0.4]], n: 0.1, c: 1400, q: 3, a: [2, 1, 0.9, 4], l: ["filter", 0.1, "sine", 0.6], fx: { chorus: 0.5, delay: 0.4, reverb: 0.9 } }],
    ["Poly Synth Filter Riser", { o: [["sawtooth"], ["sawtooth", 0, 0, 14, 0.5]], n: 0.15, c: 300, q: 10, a: [0.5, 1, 1, 1.5], f: [4, 1, 1, 1, 7000], fx: { chorus: ch, reverb: 0.6 } }],
    ["Poly Synth Laser Rain", { o: [["square", 1]], c: 4000, q: 6, a: [0.001, 0.3, 0, 0.3], l: ["pitch", 10, "sawtooth", 0.6], arp: [4, "random", 3, 0.3], fx: { delay: 0.5, reverb: 0.5 } }],
    ["Poly Synth Alarm Chord", { o: [["square"], ["square", 0, 0, 12, 0.4]], c: 3000, a: [0.005, 0.2, 0.9, 0.2], l: ["pitch", 3, "square", 0.3], fx: { reverb: 0.3 } }],
    ["Poly Synth Noise Storm", { o: [["sine", 0, 0, 0, 0.2]], n: 0.6, ft: "bandpass", c: 900, q: 5, a: [1, 1, 0.9, 2.5], l: ["filter", 0.3, "triangle", 0.8], fx: { reverb: 0.7 } }],
  ],
  Keyboard: [
    ["Poly Synth Analog EP", { o: [["triangle"], ["sine", 1, 0, 3, 0.3]], c: 2400, a: [0.002, 1, 0.3, 0.5], f: [0.001, 0.5, 0.2, 0.4, 900], l: ["volume", 4, "sine", 0.12], fx: { chorus: ch, reverb: 0.25 } }],
    ["Poly Synth Stage Piano", { o: [["triangle"], ["sawtooth", 0, 0, 4, 0.2]], c: 3200, a: [0.001, 1.3, 0.1, 0.45], f: [0.001, 0.8, 0.1, 0.4, 1600], fx: { reverb: 0.3 } }],
    ["Poly Synth Clav Chord", { o: [["pulse"], ["square", 0, 0, 5, 0.3]], c: 2000, q: 6, a: [0.001, 0.22, 0.05, 0.1], f: [0.001, 0.08, 0, 0.08, 2400], fx: { chorus: 0.2 } }],
    ["Poly Synth Vibes", { o: [["sine"], ["sine", 2, 0, 0, 0.15]], c: 5000, a: [0.001, 1.2, 0.1, 0.8], l: ["volume", 5, "sine", 0.25], fx: { reverb: 0.4 } }],
    ["Poly Synth Harpsichord", { o: [["sawtooth"], ["square", 1, 0, 3, 0.3]], c: 4200, q: 2, a: [0.001, 0.5, 0, 0.3], f: [0.001, 0.2, 0, 0.2, 2000], fx: { reverb: 0.3 } }],
  ],
  Lead: [
    ["Poly Synth Unison Lead", { o: [["sawtooth"], ["sawtooth", 0, 0, 12, 0.55]], u: [4, 14, 0.8], c: 3000, q: 3, a: [0.005, 0.3, 0.8, 0.3], fx: { chorus: 0.3, delay: 0.3, reverb: 0.3 } }],
    ["Poly Synth Soft Square Lead", { o: [["square"], ["triangle", 1, 0, 0, 0.25]], c: 2200, q: 2, a: [0.01, 0.3, 0.8, 0.3], l: ["pitch", 5, "sine", 0.06], fx: { delay: 0.25, reverb: 0.25 } }],
    ["Poly Synth Sync Lead", { o: [["sawtooth"], ["sawtooth", 0, 7, 3, 0.5]], c: 3800, q: 5, a: [0.003, 0.2, 0.75, 0.25], f: [0.001, 0.3, 0.3, 0.2, 1500], fx: { delay: 0.25 } }],
    ["Poly Synth Glide Lead", { o: [["sawtooth"], ["pulse", 0, 0, 6, 0.4]], c: 2600, q: 4, a: [0.005, 0.3, 0.8, 0.25], m: "legato", g: 0.08, fx: { chorus: 0.2, delay: 0.3 } }],
    ["Poly Synth Pulse Lead", { o: [["pulse"]], c: 2400, q: 3, a: [0.005, 0.25, 0.7, 0.2], l: ["filter", 5, "triangle", 0.15], fx: { chorus: 0.25, delay: 0.2 } }],
  ],
  Organ: [
    ["Poly Synth Drawbar", { o: [["sine"], ["sine", 1, 0, 0, 0.5], ["sine", -1, 0, 0, 0.4]], c: 6000, a: [0.003, 0.1, 1, 0.08], l: ["pan", 5.5, "sine", 0.35], fx: { chorus: 0.35 } }],
    ["Poly Synth Gospel Organ", { o: [["sine"], ["sine", 1, 0, 0, 0.5], ["sine", 1, 7, 0, 0.3]], c: 5000, a: [0.003, 0.1, 1, 0.12], l: ["volume", 6.5, "sine", 0.12], fx: { chorus: 0.4, reverb: 0.25 } }],
    ["Poly Synth Church Organ", { o: [["sine"], ["triangle", 1, 0, 0, 0.4], ["sine", 2, 0, 0, 0.2]], c: 4500, a: [0.1, 0.2, 1, 0.8], fx: { reverb: 0.65 } }],
    ["Poly Synth Combo Organ", { o: [["square"], ["pulse", 1, 0, 0, 0.3]], c: 2800, a: [0.003, 0.1, 0.95, 0.08], l: ["pitch", 6.5, "sine", 0.05], fx: { reverb: 0.2 } }],
    ["Poly Synth Reed Organ", { o: [["sawtooth"], ["square", 1, 0, 0, 0.25]], c: 1600, q: 1, a: [0.05, 0.2, 0.95, 0.3], fx: { chorus: 0.2, reverb: 0.35 } }],
  ],
  Pad: [
    ["Poly Synth Chorus Pad", { o: [["sawtooth"], ["pulse", 0, 0, -6, 0.5]], c: 1500, a: [0.6, 1, 0.85, 1.8], fx: { chorus: 0.7, reverb: 0.5 } }],
    ["Poly Synth Sweep Pad", { o: [["sawtooth"], ["sawtooth", 0, 0, 12, 0.55]], c: 600, q: 6, a: [0.8, 1, 0.9, 2], f: [2.5, 2, 0.4, 2, 2400], fx: { chorus: ch, reverb: 0.6 } }],
    ["Poly Synth Glass Pad", { o: [["triangle"], ["sine", 1, 0, 5, 0.4]], c: 3200, a: [0.9, 1, 0.8, 2.6], fx: { chorus: ch, delay: 0.2, reverb: 0.75 } }],
    ["Poly Synth Night Pad", { o: [["sawtooth"], ["triangle", -1, 0, 0, 0.4]], c: 800, q: 3, a: [1.2, 1, 0.85, 2.8], l: ["filter", 0.12, "sine", 0.35], fx: { chorus: ch, reverb: 0.7 } }],
    ["Poly Synth Velvet Pad", { o: [["pulse"], ["triangle", 0, 0, 8, 0.5]], c: 1200, a: [0.7, 1, 0.9, 2.2], fx: { chorus: 0.55, reverb: 0.55 } }],
  ],
  Percussive: [
    ["Poly Synth Mallet", { o: [["triangle"], ["sine", 2, 0, 0, 0.2]], c: 3500, a: [0.001, 0.4, 0, 0.35], fx: { reverb: 0.3 } }],
    ["Poly Synth Marimba", { o: [["sine"], ["triangle", 1, 0, 0, 0.3]], c: 2600, a: [0.001, 0.3, 0, 0.25], f: [0.001, 0.1, 0, 0.1, 1200], fx: { reverb: 0.25 } }],
    ["Poly Synth Bell Hit", { o: [["sine"], ["sine", 1, 7, 0, 0.3], ["sine", 2, 0, 0, 0.2]], c: 6000, a: [0.001, 1.2, 0, 1], fx: { reverb: 0.45 } }],
    ["Poly Synth Pluck Chord", { o: [["sawtooth"], ["square", 0, 0, 5, 0.4]], c: 1400, q: 3, a: [0.001, 0.25, 0, 0.2], f: [0.001, 0.12, 0, 0.1, 2400], fx: { chorus: ch, reverb: 0.3 } }],
    ["Poly Synth Wood Hit", { o: [["sine", 1]], n: 0.12, ft: "bandpass", c: 1800, q: 3, a: [0.001, 0.08, 0, 0.06] }],
  ],
  Synth: [
    ["Poly Synth Classic Chords", { o: [["sawtooth"], ["pulse", 0, 0, 7, 0.5]], c: 2000, q: 2, a: [0.005, 0.5, 0.6, 0.4], f: [0.003, 0.4, 0.3, 0.3, 1200], fx: { chorus: ch, reverb: 0.3 } }],
    ["Poly Synth Supersaw", { o: [["sawtooth"], ["sawtooth", 0, 0, 16, 0.55]], u: [4, 18, 1], c: 3500, a: [0.005, 0.4, 0.8, 0.4], fx: { chorus: 0.3, reverb: 0.4 } }],
    ["Poly Synth Square Chords", { o: [["square"], ["square", 0, 0, 8, 0.5]], c: 1800, q: 2, a: [0.005, 0.4, 0.6, 0.3], fx: { chorus: ch, reverb: 0.25 } }],
    ["Poly Synth Retro Stab", { o: [["sawtooth"], ["sawtooth", 0, 0, 9, 0.5]], c: 2200, q: 4, a: [0.002, 0.25, 0, 0.18], f: [0.001, 0.15, 0, 0.12, 2400], fx: { chorus: ch, delay: 0.25 } }],
    ["Poly Synth Detroit Hook", { o: [["pulse"], ["sawtooth", 0, 0, -7, 0.4]], c: 1600, q: 5, a: [0.003, 0.3, 0.3, 0.25], f: [0.002, 0.2, 0.1, 0.2, 1800], fx: { chorus: 0.3, delay: 0.3, reverb: 0.25 } }],
  ],
  Strings: [
    ["Poly Synth String Machine", { o: [["sawtooth"], ["sawtooth", 0, 0, 9, 0.55]], c: 2600, a: [0.25, 0.5, 0.9, 1], fx: { chorus: 0.7, reverb: 0.4 } }],
    ["Poly Synth Ensemble Strings", { o: [["sawtooth"], ["sawtooth", 0, 0, 14, 0.6]], u: [3, 14, 0.9], c: 2200, a: [0.35, 0.6, 0.9, 1.3], fx: { chorus: 0.5, reverb: 0.5 } }],
    ["Poly Synth Slow Strings", { o: [["sawtooth"], ["triangle", 0, 0, 7, 0.45]], c: 1600, a: [1, 0.8, 0.9, 2], fx: { chorus: ch, reverb: 0.6 } }],
    ["Poly Synth Pizz Strings", { o: [["sawtooth"], ["sawtooth", 0, 0, 5, 0.4]], c: 2400, a: [0.002, 0.15, 0, 0.12], f: [0.001, 0.07, 0, 0.08, 1200], fx: { reverb: 0.3 } }],
    ["Poly Synth Cello Strings", { o: [["sawtooth", -1], ["sawtooth", -1, 0, 8, 0.5]], c: 1100, a: [0.25, 0.6, 0.85, 1], l: ["pitch", 5, "sine", 0.05], fx: { chorus: 0.3, reverb: 0.4 } }],
  ],
  Template: [
    ["Poly Synth Init Saw", { o: [["sawtooth"]], c: 6000, a: [0.005, 0.2, 0.8, 0.25], fx: { reverb: 0 } }],
    ["Poly Synth Init Pulse", { o: [["pulse"]], c: 6000, a: [0.005, 0.2, 0.8, 0.25], fx: { reverb: 0 } }],
    ["Poly Synth Init Two Osc", { o: [["sawtooth"], ["pulse", 0, 0, 7, 0.5]], c: 5000, a: [0.005, 0.2, 0.8, 0.25], fx: { chorus: ch, reverb: 0 } }],
    ["Poly Synth Init Pad", { o: [["sawtooth"], ["sawtooth", 0, 0, 10, 0.5]], c: 2000, a: [0.5, 0.5, 0.9, 1.2], fx: { chorus: ch, reverb: 0.3 } }],
    ["Poly Synth Init Pluck", { o: [["sawtooth"]], c: 1000, q: 2, a: [0.001, 0.3, 0, 0.2], f: [0.001, 0.15, 0, 0.12, 2400], fx: { reverb: 0 } }],
  ],
  Woodwind: [
    ["Poly Synth Flute", { o: [["triangle"], ["sine", 1, 0, 0, 0.15]], n: 0.04, c: 2800, a: [0.07, 0.2, 0.85, 0.25], l: ["pitch", 5, "sine", 0.07], fx: { reverb: 0.4 } }],
    ["Poly Synth Clarinet", { o: [["square"], ["square", 0, 0, 3, 0.3]], c: 1500, a: [0.04, 0.2, 0.9, 0.2], l: ["pitch", 4.5, "sine", 0.04], fx: { reverb: 0.3 } }],
    ["Poly Synth Oboe", { o: [["pulse"], ["sawtooth", 0, 0, 0, 0.2]], ft: "bandpass", c: 1600, q: 3, a: [0.04, 0.2, 0.85, 0.15], l: ["pitch", 5.5, "sine", 0.05], fx: { reverb: 0.3 } }],
    ["Poly Synth Recorder", { o: [["sine"], ["triangle", 1, 0, 0, 0.15]], n: 0.03, c: 3500, a: [0.03, 0.2, 0.9, 0.15], fx: { reverb: 0.3 } }],
    ["Poly Synth Sax", { o: [["sawtooth"], ["square", 0, 0, 4, 0.3]], ft: "bandpass", c: 1300, q: 2, a: [0.04, 0.3, 0.8, 0.2], l: ["pitch", 5, "sine", 0.1], fx: { reverb: 0.3 } }],
  ],
};

/** Older Poly Synth presets moved from one "Poly Synth" list into the standard categories. */
export const POLY_EXISTING_CATEGORY: Record<string, StandardCategory> = {
  "Poly Synth Brass": "Brass", "Poly Synth Pad": "Pad", "Poly Synth Strings": "Strings", "Poly Synth Keys": "Keyboard",
  "Poly Synth Pluck": "Percussive", "Poly Synth Stab": "Synth", "Poly Synth Choir": "Pad", "Poly Synth Bass": "Bass",
  "Poly Synth Dream": "Pad", "Poly Atmos Horizon": "Pad", "Poly Atmos Frozen Lake": "Pad", "Poly Atmos Night Drive": "Pad",
  "Poly Atmos Dust Choir": "Pad", "Poly Atmos Deep Space": "FX", "Poly Arp Belleville Run": "Arpeggio",
  "Poly Arp Glass Cascade": "Arpeggio", "Poly Arp Bounce": "Arpeggio", "Poly Arp Random Stars": "Arpeggio",
  "Poly Arp Motor City Pulse": "Arpeggio", "Poly Arp Trance Gate": "Arpeggio", "Poly Rhythm Chopper": "Sequence",
  "Poly Rhythm Pulse Wash": "Sequence", "Poly Rhythm Filter Step": "Sequence", "Poly Rhythm Shimmer Sync": "Sequence",
  "Poly Rhythm Stab Sequence": "Sequence", "Poly Keys Electric Glow": "Keyboard", "Poly Lead Soft Saw": "Lead",
};

// ---------------- Acid Bass: clean (non-distorted) voices ----------------
/** Single oscillator, no drive, no distortion, gentle resonance: a round bass without grit. */
export const ACID_CLEAN_LIBRARY: Entry[] = ([
  ["TD-3 Clean Round Saw", { o: [["sawtooth", -1]], c: 520, q: 3, a: [0.003, 0.3, 0.75, 0.1], f: [0.001, 0.2, 0, 0.1, 900], m: "legato", g: 0.04 }],
  ["TD-3 Clean Square Thump", { o: [["square", -1]], c: 450, q: 2, a: [0.003, 0.25, 0.6, 0.08], f: [0.001, 0.12, 0, 0.08, 700], m: "mono" }],
  ["TD-3 Clean Soft Slide", { o: [["sawtooth", -1]], c: 600, q: 4, a: [0.004, 0.3, 0.8, 0.12], f: [0.001, 0.25, 0, 0.12, 1100], m: "legato", g: 0.09 }],
  ["TD-3 Clean Deep Sub", { o: [["square", -2]], c: 260, q: 1, a: [0.005, 0.3, 0.9, 0.15], f: [0.001, 0.3, 0, 0.15, 250], m: "legato", g: 0.05 }],
  ["TD-3 Clean Funk Pluck", { o: [["square", -1]], c: 700, q: 4, a: [0.002, 0.18, 0.15, 0.06], f: [0.001, 0.08, 0, 0.06, 1300], m: "mono" }],
  ["TD-3 Clean Warm Mono", { o: [["sawtooth", -1]], c: 380, q: 2, a: [0.004, 0.35, 0.85, 0.14], f: [0.001, 0.3, 0.1, 0.12, 500], m: "mono" }],
  ["TD-3 Clean House Bass", { o: [["sawtooth", -1]], c: 650, q: 3, a: [0.002, 0.2, 0.4, 0.08], f: [0.001, 0.14, 0, 0.08, 1200], m: "mono" }],
  ["TD-3 Clean Electro Pulse", { o: [["square", -1]], c: 800, q: 5, a: [0.002, 0.15, 0.2, 0.05], f: [0.001, 0.1, 0, 0.05, 1500], m: "legato", g: 0.025 }],
  ["TD-3 Clean Hollow Bass", { o: [["square", -1]], c: 550, q: 6, a: [0.003, 0.3, 0.7, 0.1], f: [0.001, 0.22, 0.1, 0.1, 800], m: "legato", g: 0.03 }],
  ["TD-3 Clean Dub Sub", { o: [["sawtooth", -2]], c: 300, q: 2, a: [0.006, 0.4, 0.85, 0.2], f: [0.001, 0.35, 0.1, 0.2, 400], m: "legato", g: 0.07, fx: { delay: 0.15, delayFeedback: 0.3, reverb: 0.03 } }],
  ["TD-3 Clean Smooth Acid", { o: [["sawtooth", -1]], c: 480, q: 6, a: [0.002, 0.25, 0.6, 0.08], f: [0.001, 0.18, 0, 0.08, 1600], m: "legato", g: 0.06 }],
  ["TD-3 Clean Bounce", { o: [["square", -1]], c: 600, q: 3, a: [0.002, 0.2, 0.3, 0.07], f: [0.001, 0.15, 0, 0.07, 1000], m: "legato", g: 0.045 }],
] as Entry[]).map(([name, v]): Entry => [name, { an: 0.03, dr: 0, ...v, fx: { reverb: 0.02, ...v.fx, distortion: 0, saturation: 0, bitcrush: 0, chorus: 0 } }]);

type Def = { name: string; category: string; mutate: (p: SynthPatch) => void };
const flatten = (bank: Bank, prefix: string): Def[] =>
  STANDARD_CATEGORIES.flatMap((cat) => (bank[cat] ?? []).map(([name, v]) => ({ name, category: prefix + cat, mutate: (p: SynthPatch) => applyVoice(p, v) })));

export const SPEC4_DEFS = flatten(SPEC4_LIBRARY, "");
export const POLY_DEFS = flatten(POLY_LIBRARY, POLY_CATEGORY_PREFIX);
/** Clean voices also skip the always-on voice warmth stage; DRIVE and DIST still work when turned up. */
export const ACID_CLEAN_DEFS: Def[] = ACID_CLEAN_LIBRARY.map(([name, v]) => ({ name, category: ACID_CLEAN_CATEGORY, mutate: (p: SynthPatch) => { applyVoice(p, v); p.clean = true; } }));
