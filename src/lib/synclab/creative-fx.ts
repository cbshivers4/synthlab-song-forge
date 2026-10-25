import type { PluginInstance, PluginParam } from "./types";

/**
 * Thirteen original SYNCLAB hardware-style effects. Each kind has its own real
 * Web Audio signal path (no shared "skin over the same DSP"), built between a
 * single input and output node so the insert chain treats every one as size 2.
 */
export const CREATIVE_KINDS = [
  "modulator", "modfx", "retro", "trigate", "demolition", "pitchvoice", "maximizer",
  "imager", "unison", "amp", "ensemble", "sidechain", "distmatrix",
] as const;
export type CreativeKind = (typeof CREATIVE_KINDS)[number];
export const isCreativeKind = (kind: string): kind is CreativeKind => (CREATIVE_KINDS as readonly string[]).includes(kind);

const p = (id: string, name: string, value: number, min: number, max: number, unit?: string): PluginParam => ({ id, name, value, min, max, ...(unit ? { unit } : {}) });

export const CREATIVE_PARAMS: Record<CreativeKind, () => PluginParam[]> = {
  modulator: () => [p("rate", "Rate", 2, 0.05, 20, "Hz"), p("depth", "Depth", 0.6, 0, 1), p("shape", "Shape", 0, 0, 2), p("cutoff", "Cutoff", 1800, 100, 16000, "Hz"), p("resonance", "Resonance", 3, 0.1, 15, "Q"), p("filterAmt", "Filter Mod", 0.7, 0, 1), p("ampAmt", "Amp Mod", 0.3, 0, 1), p("mix", "Mix", 1, 0, 1)],
  modfx: () => [p("mode", "Mode", 0, 0, 2), p("rate", "Rate", 0.8, 0.05, 10, "Hz"), p("depth", "Depth", 0.5, 0, 1), p("feedback", "Feedback", 0.2, 0, 0.9), p("tone", "Tone", 9000, 800, 18000, "Hz"), p("mix", "Mix", 0.5, 0, 1)],
  retro: () => [p("era", "Era", 0, 0, 3), p("wow", "Wow", 0.3, 0, 1), p("drive", "Drive", 0.3, 0, 1), p("noise", "Noise", 0.2, 0, 1), p("mix", "Mix", 1, 0, 1), p("output", "Output", 0, -18, 6, "dB")],
  trigate: () => [p("rate", "Rate", 4, 0.5, 16, "Hz"), p("pattern", "Pattern", 0, 0, 3), p("lowFreq", "Low Band", 220, 60, 600, "Hz"), p("midFreq", "Mid Band", 1200, 500, 3000, "Hz"), p("highFreq", "High Band", 5000, 2500, 12000, "Hz"), p("resonance", "Resonance", 2, 0.5, 12, "Q"), p("depth", "Gate Depth", 0.9, 0, 1), p("mix", "Mix", 1, 0, 1)],
  demolition: () => [p("drive", "Drive", 0.5, 0, 1), p("bits", "Bits", 8, 2, 16, "bit"), p("ring", "Ring Freq", 120, 20, 2000, "Hz"), p("ringMix", "Ring Mix", 0.2, 0, 1), p("tone", "Tone", 7000, 500, 18000, "Hz"), p("mix", "Mix", 1, 0, 1), p("output", "Output", -6, -24, 6, "dB")],
  pitchvoice: () => [p("pitch", "Pitch", 0, -12, 12, "st"), p("fine", "Fine", 0, -100, 100, "ct"), p("formant", "Formant", 0, -12, 12, "st"), p("harmony", "Harmony", 7, -12, 12, "st"), p("harmonyLevel", "Harmony Lvl", 0, 0, 1), p("mix", "Mix", 1, 0, 1)],
  maximizer: () => [p("threshold", "Threshold", -6, -24, 0, "dB"), p("ceiling", "Ceiling", -0.3, -6, 0, "dB"), p("release", "Release", 80, 10, 1000, "ms"), p("character", "Character", 0.4, 0, 1), p("output", "Output", 0, -12, 0, "dB")],
  imager: () => [p("crossover", "Crossover", 250, 80, 2000, "Hz"), p("lowWidth", "Low Width", 0.6, 0, 2), p("highWidth", "High Width", 1.4, 0, 2), p("output", "Output", 0, -12, 6, "dB")],
  unison: () => [p("voices", "Voices", 4, 2, 8), p("detune", "Detune", 0.4, 0, 1), p("spread", "Spread", 0.8, 0, 1), p("rate", "Drift Rate", 0.7, 0.1, 3, "Hz"), p("mix", "Mix", 0.5, 0, 1), p("output", "Output", 0, -12, 6, "dB")],
  amp: () => [p("mode", "Guitar/Bass", 0, 0, 1), p("gain", "Gain", 0.4, 0, 1), p("bass", "Bass", 0, -12, 12, "dB"), p("mid", "Middle", 0, -12, 12, "dB"), p("treble", "Treble", 0, -12, 12, "dB"), p("presence", "Presence", 0, -12, 12, "dB"), p("cabinet", "Cabinet", 0.8, 0, 1), p("output", "Output", -6, -24, 6, "dB")],
  ensemble: () => [p("rate", "Chorus Rate", 0.6, 0.1, 2, "Hz"), p("depth", "Chorus Depth", 0.6, 0, 1), p("vibrato", "Vibrato Rate", 6, 2, 9, "Hz"), p("vibDepth", "Vibrato Depth", 0.2, 0, 1), p("spread", "Spread", 0.8, 0, 1), p("mix", "Mix", 0.6, 0, 1)],
  sidechain: () => [p("tempo", "Tempo", 124, 60, 200, "BPM"), p("division", "Division", 0, 0, 3), p("depth", "Depth", 0.8, 0, 1), p("release", "Release", 0.5, 0.05, 0.95), p("curve", "Curve", 2, 0.5, 4), p("output", "Output", 0, -12, 6, "dB")],
  distmatrix: () => [p("drive", "Drive", 0.5, 0, 1), p("tube", "Tube", 0.7, 0, 1), p("fuzz", "Fuzz", 0, 0, 1), p("fold", "Fold", 0, 0, 1), p("rect", "Rectify", 0, 0, 1), p("tone", "Tone", 8000, 500, 18000, "Hz"), p("mix", "Mix", 1, 0, 1), p("output", "Output", -6, -24, 6, "dB")],
};

export const CREATIVE_DEVICES: [name: string, kind: CreativeKind][] = [
  ["FX Modulator", "modulator"], ["Mod Engine", "modfx"], ["Retro Transformer", "retro"], ["Triple Filter Gate", "trigate"],
  ["Demolition Unit", "demolition"], ["Pitch & Voice Synth", "pitchvoice"], ["Maximizer", "maximizer"], ["Stereo Imager", "imager"],
  ["Unison Expander", "unison"], ["Guitar & Bass Amp", "amp"], ["Chorus Ensemble", "ensemble"], ["Sidechain Pump", "sidechain"], ["Distortion Matrix", "distmatrix"],
];

type R = [string, Record<string, number>];
export const CREATIVE_RECIPES: Record<CreativeKind, R[]> = {
  modulator: [["Slow Wah Sweep", { rate: 0.4, filterAmt: 0.9, ampAmt: 0 }], ["Choppy Square", { rate: 8, shape: 2, ampAmt: 1, filterAmt: 0.1 }], ["Acid Wobble", { rate: 3, resonance: 10, cutoff: 900, filterAmt: 1 }], ["Gentle Pulse", { rate: 1, depth: 0.3, ampAmt: 0.6, filterAmt: 0.2 }], ["Triangle Drift", { rate: 0.2, shape: 1, depth: 0.8 }], ["Fast Flutter", { rate: 15, depth: 0.4, filterAmt: 0.5 }], ["Dub Siren Filter", { rate: 6, resonance: 13, cutoff: 2500 }], ["Half Blend", { mix: 0.5, rate: 2.5 }], ["Bright Shimmer", { cutoff: 9000, rate: 5, filterAmt: 0.4, ampAmt: 0.1 }], ["Deep Throb", { cutoff: 300, rate: 1.5, resonance: 6, ampAmt: 0.5 }]],
  modfx: [["Lush Chorus", { mode: 0, rate: 0.5, depth: 0.7, mix: 0.5 }], ["Jet Flange", { mode: 1, rate: 0.2, depth: 0.9, feedback: 0.8 }], ["Vibrato Voice", { mode: 2, rate: 5.5, depth: 0.4, mix: 1 }], ["Subtle Thicken", { mode: 0, rate: 0.3, depth: 0.3, mix: 0.3 }], ["Metallic Flange", { mode: 1, rate: 1.5, feedback: 0.9, tone: 14000 }], ["Seasick Tape", { mode: 2, rate: 1, depth: 0.9 }], ["Dark Chorus", { mode: 0, tone: 2500, depth: 0.6 }], ["Fast Leslie", { mode: 2, rate: 7, depth: 0.3, mix: 0.7 }], ["Barber Flange", { mode: 1, rate: 0.08, depth: 1, feedback: 0.6, mix: 0.6 }], ["Wide Shimmer", { mode: 0, rate: 2, depth: 0.5, feedback: 0.5 }]],
  retro: [["Dusty Vinyl", { era: 0, noise: 0.5, wow: 0.2 }], ["AM Radio", { era: 1, drive: 0.5, noise: 0.3 }], ["Old Telephone", { era: 2, drive: 0.6, noise: 0.1 }], ["Warped Cassette", { era: 3, wow: 0.8, noise: 0.3 }], ["Clean Vinyl", { era: 0, noise: 0.05, wow: 0.05 }], ["Broken Radio", { era: 1, drive: 1, wow: 0.6, noise: 0.7 }], ["Intercom", { era: 2, drive: 0.9, noise: 0 }], ["Lo-Fi Beat Tape", { era: 3, wow: 0.4, drive: 0.5, noise: 0.15 }], ["Ghost Blend", { era: 1, mix: 0.4 }], ["Heavy Crackle", { era: 0, noise: 1, drive: 0.4, output: -3 }]],
  trigate: [["Classic Triple Gate", { pattern: 0, rate: 5, depth: 1 }], ["Polyrhythm", { pattern: 1, rate: 3 }], ["Fast Shimmer", { pattern: 2, rate: 12 }], ["Broken Groove", { pattern: 3, rate: 6 }], ["Soft Pulse", { depth: 0.5, rate: 2 }], ["Resonant Bands", { resonance: 9, depth: 0.8 }], ["Low End Chop", { lowFreq: 120, midFreq: 900, rate: 8 }], ["Vocal Slicer", { midFreq: 1800, highFreq: 6000, pattern: 1, rate: 8 }], ["Half Gate", { mix: 0.5, rate: 4.5 }], ["Glitch Bands", { pattern: 3, rate: 16, resonance: 6 }]],
  demolition: [["Total Wreck", { drive: 1, bits: 4, ringMix: 0.5 }], ["Bit Grinder", { bits: 3, drive: 0.4, ringMix: 0 }], ["Robot Ring", { ring: 440, ringMix: 0.9, drive: 0.2 }], ["Dirty Bus", { drive: 0.35, bits: 12, ringMix: 0, mix: 0.5 }], ["Metal Clang", { ring: 1500, ringMix: 0.7, bits: 6 }], ["Smashed Drums", { drive: 0.8, bits: 10, tone: 5000 }], ["Sub Rumble", { ring: 40, ringMix: 0.6, tone: 2000 }], ["Lo Crunch", { bits: 5, tone: 3000, drive: 0.6 }], ["Siren Ring", { ring: 900, ringMix: 1, bits: 16 }], ["Gentle Damage", { drive: 0.2, bits: 14, mix: 0.35 }]],
  pitchvoice: [["Octave Up", { pitch: 12 }], ["Octave Down", { pitch: -12 }], ["Chipmunk", { pitch: 7, formant: 6 }], ["Deep Monster", { pitch: -7, formant: -6 }], ["Fifth Harmony", { harmony: 7, harmonyLevel: 0.7 }], ["Third Harmony", { harmony: 4, harmonyLevel: 0.6 }], ["Octave Double", { harmony: -12, harmonyLevel: 0.5 }], ["Slight Detune", { fine: 15, mix: 0.5 }], ["Gender Flip Up", { formant: 5, pitch: 3 }], ["Choir Stack", { pitch: 0, harmony: 5, harmonyLevel: 0.8, formant: -2 }]],
  maximizer: [["Loud Master", { threshold: -10, character: 0.5 }], ["Transparent", { threshold: -4, character: 0.1, release: 200 }], ["Club Banger", { threshold: -14, character: 0.8, release: 40 }], ["Streaming Safe", { threshold: -6, ceiling: -1, release: 120 }], ["Drum Smash", { threshold: -18, release: 20, character: 0.9 }], ["Gentle Glue", { threshold: -3, release: 400 }], ["Warm Saturate", { threshold: -8, character: 1 }], ["Broadcast", { threshold: -12, ceiling: -2, release: 250 }], ["Vocal Up Front", { threshold: -9, release: 60, character: 0.3 }], ["Maximum Push", { threshold: -24, character: 0.7, output: -1 }]],
  imager: [["Wide Top Mono Bass", { lowWidth: 0, highWidth: 1.6 }], ["Full Mono", { lowWidth: 0, highWidth: 0 }], ["Extra Wide", { lowWidth: 1, highWidth: 2 }], ["Narrow Focus", { lowWidth: 0.5, highWidth: 0.6 }], ["Pad Spread", { crossover: 600, highWidth: 1.8 }], ["Club Safe", { crossover: 150, lowWidth: 0 }], ["Vocal Center", { crossover: 1200, lowWidth: 0.8, highWidth: 1.2 }], ["Drum Room", { crossover: 400, lowWidth: 0.7, highWidth: 1.5 }], ["Gentle Widen", { lowWidth: 1, highWidth: 1.2 }], ["Side Boost", { crossover: 2000, lowWidth: 1.2, highWidth: 1.9, output: -1 }]],
  unison: [["Supersaw Stack", { voices: 8, detune: 0.7, spread: 1 }], ["Subtle Double", { voices: 2, detune: 0.2, mix: 0.4 }], ["Wide Quad", { voices: 4, detune: 0.5, spread: 1 }], ["Vocal Thicken", { voices: 3, detune: 0.25, mix: 0.35 }], ["Detuned Chaos", { voices: 8, detune: 1, rate: 2.5 }], ["Slow Drift", { voices: 6, rate: 0.15, detune: 0.6 }], ["Mono Stack", { voices: 5, spread: 0, detune: 0.4 }], ["Lead Width", { voices: 4, detune: 0.35, spread: 0.6, mix: 0.6 }], ["Pad Bloom", { voices: 7, detune: 0.8, mix: 0.7, rate: 0.4 }], ["Tight Six", { voices: 6, detune: 0.15, spread: 0.9 }]],
  amp: [["Clean Jazz", { gain: 0.1, treble: -3, bass: 2 }], ["Blues Crunch", { gain: 0.5, mid: 3 }], ["Metal Lead", { gain: 1, mid: -6, bass: 4, treble: 4 }], ["Motor City Bass", { mode: 1, gain: 0.2, bass: 5, mid: 2 }], ["Growl Bass", { mode: 1, gain: 0.8, mid: 5, treble: 3 }], ["Funk Clean", { gain: 0.15, treble: 5, presence: 3 }], ["Fuzz Bass", { mode: 1, gain: 1, cabinet: 0.4 }], ["Direct Line", { cabinet: 0, gain: 0.3 }], ["Rock Rhythm", { gain: 0.7, bass: 2, treble: 2, presence: 2 }], ["Warm Upright", { mode: 1, gain: 0.05, treble: -6, bass: 3 }]],
  ensemble: [["String Machine", { rate: 0.6, vibDepth: 0.3, mix: 0.7 }], ["Classic Poly", { rate: 0.4, vibDepth: 0, depth: 0.5 }], ["Dreamy Wide", { spread: 1, depth: 0.9, rate: 0.3 }], ["Vibrato Organ", { vibDepth: 0.7, vibrato: 7 }], ["Subtle Ensemble", { mix: 0.35, depth: 0.4 }], ["Seasick Strings", { rate: 1.5, depth: 1, vibDepth: 0.4 }], ["Mono Ensemble", { spread: 0, mix: 0.5 }], ["Fast Shimmer", { rate: 2, vibrato: 9, vibDepth: 0.5 }], ["Slow Swirl", { rate: 0.1, depth: 0.8 }], ["Pad Haze", { mix: 0.9, depth: 0.7, vibrato: 4, vibDepth: 0.2 }]],
  sidechain: [["Four on Floor", { division: 0, depth: 0.85 }], ["Eighth Pump", { division: 1, depth: 0.7, release: 0.6 }], ["Half Note Swell", { division: 2, depth: 0.9, curve: 1 }], ["Bar Duck", { division: 3, release: 0.8 }], ["Gentle Breath", { depth: 0.4, release: 0.7 }], ["Hard Duck", { depth: 1, release: 0.3, curve: 3 }], ["House 126", { tempo: 126, depth: 0.8 }], ["Techno 132", { tempo: 132, depth: 0.9, curve: 2.5 }], ["Hip Hop 90", { tempo: 90, division: 0, release: 0.4 }], ["DnB 174", { tempo: 174, division: 1, depth: 0.6 }]],
  distmatrix: [["Warm Tube", { tube: 1, drive: 0.3 }], ["Fuzz Box", { tube: 0, fuzz: 1, drive: 0.8 }], ["Wave Folder", { tube: 0, fold: 1, drive: 0.6 }], ["Octave Rectifier", { tube: 0, rect: 1 }], ["Tube + Fuzz", { tube: 0.6, fuzz: 0.6 }], ["Folded Rect", { tube: 0, fold: 0.7, rect: 0.7 }], ["Everything", { tube: 0.5, fuzz: 0.5, fold: 0.5, rect: 0.5, drive: 0.7 }], ["Dark Crunch", { tube: 0.8, tone: 2500, drive: 0.7 }], ["Parallel Grit", { fuzz: 0.7, mix: 0.4 }], ["Bright Fold", { tube: 0.2, fold: 0.8, tone: 15000 }]],
};

export interface FxHelpers {
  val: (id: string, fallback: number) => number;
  live: (id: string, fn: (v: number, t: number) => void) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const db = (v: number) => Math.pow(10, v / 20);
const glide = (param: AudioParam, v: number, t: number) => param.setTargetAtTime(v, t, 0.015);
const curve = (fn: (x: number) => number, n = 2049) => {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1);
  return c;
};
const LFO: OscillatorType[] = ["sine", "triangle", "square"];

/** Delay-line pitch shifter: two crossfaded taps swept by phase-opposed ramps. */
function shifter(ctx: BaseAudioContext, input: AudioNode, out: AudioNode, semis: number) {
  const W = 0.05;
  const H = 32;
  const re = new Float32Array(H), imA = new Float32Array(H), imB = new Float32Array(H);
  for (let n = 1; n < H; n++) { imA[n] = -2 / (Math.PI * n); imB[n] = imA[n]! * (n % 2 ? -1 : 1); }
  const sawA = ctx.createPeriodicWave(re, imA, { disableNormalization: true });
  const sawB = ctx.createPeriodicWave(re, imB, { disableNormalization: true });
  const winRe = new Float32Array(2); const winIm = new Float32Array(2);
  winRe[1] = -0.5; const winA = ctx.createPeriodicWave(winRe, winIm, { disableNormalization: true });
  const winRe2 = new Float32Array(2); winRe2[1] = 0.5; const winB = ctx.createPeriodicWave(winRe2, winIm, { disableNormalization: true });
  const oscs: OscillatorNode[] = [];
  const amps: GainNode[] = [];
  for (const [saw, win] of [[sawA, winA], [sawB, winB]] as const) {
    const d = ctx.createDelay(0.2); d.delayTime.value = W / 2 + 0.002;
    const ramp = ctx.createOscillator(); ramp.setPeriodicWave(saw);
    const amt = ctx.createGain(); ramp.connect(amt); amt.connect(d.delayTime);
    const vca = ctx.createGain(); vca.gain.value = 0.5;
    const w = ctx.createOscillator(); w.setPeriodicWave(win); w.connect(vca.gain);
    input.connect(d); d.connect(vca); vca.connect(out);
    oscs.push(ramp, w); amps.push(amt);
  }
  const set = (s: number, t?: number) => {
    const ratio = Math.pow(2, s / 12);
    const f = Math.max(0.001, Math.abs(1 - ratio) / W);
    const a = (ratio > 1 ? -1 : 1) * W / 2 * (Math.abs(1 - ratio) < 1e-4 ? 0 : 1);
    for (const o of oscs) t === undefined ? (o.frequency.value = f) : glide(o.frequency, f, t);
    for (const g of amps) t === undefined ? (g.gain.value = a) : glide(g.gain, a, t);
  };
  set(semis);
  const t0 = ctx.currentTime + 0.01;
  for (const o of oscs) o.start(t0);
  return set;
}

/** Stereo width matrix: L' = aL + bR, R' = bL + aR. */
export function widthStage(ctx: BaseAudioContext, input: AudioNode, out: AudioNode, width: number) {
  const split = ctx.createChannelSplitter(2); const merge = ctx.createChannelMerger(2);
  const ll = ctx.createGain(), rr = ctx.createGain(), lr = ctx.createGain(), rl = ctx.createGain();
  input.connect(split);
  split.connect(ll, 0); split.connect(lr, 0); split.connect(rr, 1); split.connect(rl, 1);
  ll.connect(merge, 0, 0); rl.connect(merge, 0, 0); rr.connect(merge, 0, 1); lr.connect(merge, 0, 1);
  merge.connect(out);
  const set = (w: number, t?: number) => {
    const a = (1 + w) / 2, b = (1 - w) / 2;
    for (const [g, v] of [[ll, a], [rr, a], [lr, b], [rl, b]] as const) t === undefined ? (g.gain.value = v) : glide(g.gain, v, t);
  };
  set(width);
  return set;
}

/** Ducking envelope for one beat cycle: fast dip, curved recovery. */
export function duckShape(phase: number, depth: number, release: number, power: number) {
  const rec = Math.min(1, phase / release);
  return 1 - depth * Math.pow(1 - rec, power);
}

export function buildCreativeFx(ctx: BaseAudioContext, pl: PluginInstance, h: FxHelpers): { input: GainNode; output: GainNode } {
  const { val, live } = h;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  input.connect(dry); dry.connect(output); wet.connect(output);
  const mix = (fallback = 1) => {
    const m = clamp(val("mix", fallback), 0, 1); wet.gain.value = m; dry.gain.value = 1 - m;
    live("mix", (v, t) => { const x = clamp(v, 0, 1); glide(wet.gain, x, t); glide(dry.gain, 1 - x, t); });
  };
  const outLevel = (node: GainNode, fallback = 0) => { node.gain.value = db(val("output", fallback)); live("output", (v, t) => glide(node.gain, db(v), t)); };
  const start = (...o: (OscillatorNode | AudioBufferSourceNode)[]) => o.forEach(x => x.start(ctx.currentTime + 0.005));

  switch (pl.kind) {
    case "modulator": {
      const filter = ctx.createBiquadFilter(); filter.type = "lowpass";
      filter.frequency.value = val("cutoff", 1800); filter.Q.value = val("resonance", 3);
      const amp = ctx.createGain();
      const lfo = ctx.createOscillator(); lfo.type = LFO[clamp(Math.round(val("shape", 0)), 0, 2)] ?? "sine";
      lfo.frequency.value = val("rate", 2);
      const fAmt = ctx.createGain(), aAmt = ctx.createGain();
      const apply = (t?: number) => {
        const d = val("depth", 0.6), fa = val("filterAmt", 0.7), aa = val("ampAmt", 0.3);
        const set = (prm: AudioParam, v: number) => t === undefined ? (prm.value = v) : glide(prm, v, t);
        set(fAmt.gain, d * fa * 3600); set(aAmt.gain, d * aa * 0.5); set(amp.gain, 1 - d * aa * 0.5);
      };
      apply();
      lfo.connect(fAmt); fAmt.connect(filter.detune); lfo.connect(aAmt); aAmt.connect(amp.gain);
      input.connect(filter); filter.connect(amp); amp.connect(wet);
      live("rate", (v, t) => glide(lfo.frequency, v, t));
      live("cutoff", (v, t) => glide(filter.frequency, v, t));
      live("resonance", (v, t) => glide(filter.Q, v, t));
      for (const id of ["depth", "filterAmt", "ampAmt"]) live(id, (_v, t) => apply(t));
      mix(1); start(lfo);
      break;
    }
    case "modfx": {
      const mode = clamp(Math.round(val("mode", 0)), 0, 2);
      const base = [0.018, 0.003, 0.006][mode]!, span = [0.006, 0.0025, 0.004][mode]!;
      const d = ctx.createDelay(0.1); d.delayTime.value = base;
      const fb = ctx.createGain(); fb.gain.value = mode === 2 ? 0 : val("feedback", 0.2);
      const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = val("tone", 9000);
      const lfo = ctx.createOscillator(); lfo.frequency.value = val("rate", 0.8);
      const depth = ctx.createGain(); depth.gain.value = val("depth", 0.5) * span;
      lfo.connect(depth); depth.connect(d.delayTime);
      input.connect(d); d.connect(tone); tone.connect(fb); fb.connect(d); tone.connect(wet);
      live("rate", (v, t) => glide(lfo.frequency, v, t));
      live("depth", (v, t) => glide(depth.gain, v * span, t));
      live("feedback", (v, t) => glide(fb.gain, mode === 2 ? 0 : v, t));
      live("tone", (v, t) => glide(tone.frequency, v, t));
      if (mode === 2) { wet.gain.value = 1; dry.gain.value = 1 - val("mix", 0.5); live("mix", (v, t) => glide(dry.gain, 1 - v, t)); }
      else mix(0.5);
      start(lfo);
      break;
    }
    case "retro": {
      const era = clamp(Math.round(val("era", 0)), 0, 3);
      const [hpF, lpF] = ([[60, 9000], [300, 4000], [500, 3000], [40, 11000]] as const)[era]!;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = hpF;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = lpF;
      const pre = ctx.createGain(); const sat = ctx.createWaveShaper();
      const setDrive = (v: number) => { pre.gain.value = 1 + v * 8; sat.curve = curve(x => Math.tanh(x * (1 + v * 3))); };
      setDrive(val("drive", 0.3));
      const wowD = ctx.createDelay(0.1); wowD.delayTime.value = 0.012;
      const wow = ctx.createOscillator(); wow.frequency.value = era === 3 ? 0.9 : 0.5;
      const wowAmt = ctx.createGain(); wowAmt.gain.value = val("wow", 0.3) * 0.004;
      wow.connect(wowAmt); wowAmt.connect(wowD.delayTime);
      const post = ctx.createGain(); outLevel(post);
      input.connect(hp); hp.connect(pre); pre.connect(sat); sat.connect(wowD); wowD.connect(lp); lp.connect(post); post.connect(wet);
      // Era-specific noise: vinyl crackle, radio/phone hiss, tape hiss.
      const len = ctx.sampleRate * 2; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const ch = buf.getChannelData(0);
      let seed = 1234567;
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647; const r = seed / 2147483647 * 2 - 1;
        ch[i] = era === 0 ? (Math.abs(r) > 0.9994 ? r * 4 : r * 0.08) : r * 0.4;
      }
      const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const nGain = ctx.createGain(); nGain.gain.value = val("noise", 0.2) * 0.06;
      const nFilter = ctx.createBiquadFilter(); nFilter.type = "bandpass"; nFilter.frequency.value = era === 0 ? 3000 : 2000; nFilter.Q.value = 0.5;
      noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(wet);
      live("wow", (v, t) => glide(wowAmt.gain, v * 0.004, t));
      live("noise", (v, t) => glide(nGain.gain, v * 0.06, t));
      live("drive", (v) => setDrive(v));
      mix(1); start(wow, noise);
      break;
    }
    case "trigate": {
      const mults = ([[1, 2, 4], [1, 1.5, 3], [2, 3, 5], [1, 0.75, 2.5]] as const)[clamp(Math.round(val("pattern", 0)), 0, 3)]!;
      const sum = ctx.createGain();
      const lfos: OscillatorNode[] = []; const depths: GainNode[] = []; const gates: GainNode[] = []; const filters: BiquadFilterNode[] = [];
      ["lowFreq", "midFreq", "highFreq"].forEach((id, i) => {
        const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = val(id, [220, 1200, 5000][i]!); f.Q.value = val("resonance", 2);
        const gate = ctx.createGain(); const lfo = ctx.createOscillator(); lfo.type = "square";
        lfo.frequency.value = val("rate", 4) * mults[i]!;
        const dep = ctx.createGain();
        lfo.connect(dep); dep.connect(gate.gain);
        input.connect(f); f.connect(gate); gate.connect(sum);
        live(id, (v, t) => glide(f.frequency, v, t));
        lfos.push(lfo); depths.push(dep); gates.push(gate); filters.push(f);
      });
      const setDepth = (d: number, t?: number) => { for (let i = 0; i < 3; i++) { if (t === undefined) { depths[i]!.gain.value = d / 2; gates[i]!.gain.value = 1 - d / 2; } else { glide(depths[i]!.gain, d / 2, t); glide(gates[i]!.gain, 1 - d / 2, t); } } };
      setDepth(val("depth", 0.9));
      sum.gain.value = 1.6; sum.connect(wet);
      live("rate", (v, t) => lfos.forEach((l, i) => glide(l.frequency, v * mults[i]!, t)));
      live("resonance", (v, t) => filters.forEach(f => glide(f.Q, v, t)));
      live("depth", (v, t) => setDepth(v, t));
      mix(1); start(...lfos);
      break;
    }
    case "demolition": {
      const pre = ctx.createGain(); const shaper = ctx.createWaveShaper();
      const shape = () => {
        const drive = val("drive", 0.5); const steps = Math.pow(2, Math.round(val("bits", 8)) - 1);
        pre.gain.value = 1 + drive * 30;
        shaper.curve = curve(x => Math.round(clamp(x * (1 + drive * 4), -1, 1) * steps) / steps);
      };
      shape();
      const ring = ctx.createGain(); const osc = ctx.createOscillator(); osc.frequency.value = val("ring", 120);
      const oAmt = ctx.createGain();
      const setRing = (m: number, t?: number) => { if (t === undefined) { ring.gain.value = 1 - m; oAmt.gain.value = m; } else { glide(ring.gain, 1 - m, t); glide(oAmt.gain, m, t); } };
      setRing(val("ringMix", 0.2)); osc.connect(oAmt); oAmt.connect(ring.gain);
      const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = val("tone", 7000);
      const post = ctx.createGain(); outLevel(post, -6);
      input.connect(pre); pre.connect(shaper); shaper.connect(ring); ring.connect(tone); tone.connect(post); post.connect(wet);
      live("drive", () => shape()); live("bits", () => shape());
      live("ring", (v, t) => glide(osc.frequency, v, t)); live("ringMix", (v, t) => setRing(v, t));
      live("tone", (v, t) => glide(tone.frequency, v, t));
      mix(1); start(osc);
      break;
    }
    case "pitchvoice": {
      const lead = ctx.createGain(); const harm = ctx.createGain(); harm.gain.value = val("harmonyLevel", 0);
      const setLead = shifter(ctx, input, lead, val("pitch", 0) + val("fine", 0) / 100);
      const setHarm = shifter(ctx, input, harm, val("harmony", 7));
      const voice = ctx.createGain(); lead.connect(voice); harm.connect(voice);
      const formants = [500, 1500, 2500].map((f, i) => { const b = ctx.createBiquadFilter(); b.type = "peaking"; b.Q.value = 4; b.gain.value = [5, 4, 3][i]!; b.frequency.value = f; return b; });
      const setFormant = (s: number, t?: number) => formants.forEach((b, i) => { const f = [500, 1500, 2500][i]! * Math.pow(2, s / 12); t === undefined ? (b.frequency.value = f) : glide(b.frequency, f, t); });
      setFormant(val("formant", 0));
      voice.connect(formants[0]!); formants[0]!.connect(formants[1]!); formants[1]!.connect(formants[2]!); formants[2]!.connect(wet);
      const lp = () => val("pitch", 0) + val("fine", 0) / 100;
      live("pitch", (_v, t) => setLead(lp(), t)); live("fine", (_v, t) => setLead(lp(), t));
      live("harmony", (v, t) => setHarm(v, t));
      live("harmonyLevel", (v, t) => glide(harm.gain, v, t));
      live("formant", (v, t) => setFormant(v, t));
      mix(1);
      break;
    }
    case "maximizer": {
      const drive = ctx.createGain(); drive.gain.value = db(-val("threshold", -6));
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -1; comp.ratio.value = 20; comp.knee.value = 0; comp.attack.value = 0.001; comp.release.value = val("release", 80) / 1000;
      const clip = ctx.createWaveShaper();
      const setChar = (c: number) => { clip.curve = curve(x => { const k = 1 + c * 4; return Math.tanh(x * k) / Math.tanh(k); }); };
      setChar(val("character", 0.4));
      const ceil = ctx.createGain(); ceil.gain.value = db(val("ceiling", -0.3));
      const post = ctx.createGain(); outLevel(post);
      input.connect(drive); drive.connect(comp); comp.connect(clip); clip.connect(ceil); ceil.connect(post); post.connect(wet);
      wet.gain.value = 1; dry.gain.value = 0;
      live("threshold", (v, t) => glide(drive.gain, db(-v), t));
      live("release", (v, t) => glide(comp.release, v / 1000, t));
      live("character", (v) => setChar(v));
      live("ceiling", (v, t) => glide(ceil.gain, db(v), t));
      break;
    }
    case "imager": {
      // Linkwitz-Riley 4th-order crossover: cascaded Butterworth pairs sum flat.
      const bq = (type: BiquadFilterType) => { const b = ctx.createBiquadFilter(); b.type = type; b.Q.value = -3.0103; b.frequency.value = val("crossover", 250); return b; };
      const lo1 = bq("lowpass"), lo = bq("lowpass"), hi1 = bq("highpass"), hi = bq("highpass");
      const post = ctx.createGain(); outLevel(post);
      input.connect(lo1); lo1.connect(lo); input.connect(hi1); hi1.connect(hi);
      const setLo = widthStage(ctx, lo, post, val("lowWidth", 0.6));
      const setHi = widthStage(ctx, hi, post, val("highWidth", 1.4));
      post.connect(wet); wet.gain.value = 1; dry.gain.value = 0;
      live("crossover", (v, t) => [lo1, lo, hi1, hi].forEach(b => glide(b.frequency, v, t)));
      live("lowWidth", (v, t) => setLo(v, t)); live("highWidth", (v, t) => setHi(v, t));
      break;
    }
    case "unison": {
      const voices: { gain: GainNode; pan: StereoPannerNode; depth: GainNode; lfo: OscillatorNode }[] = [];
      const bus = ctx.createGain(); const post = ctx.createGain(); outLevel(post);
      for (let i = 0; i < 8; i++) {
        const d = ctx.createDelay(0.1); d.delayTime.value = 0.01 + i * 0.0013;
        const lfo = ctx.createOscillator(); lfo.frequency.value = val("rate", 0.7) * (1 + i * 0.17);
        const depth = ctx.createGain(); lfo.connect(depth); depth.connect(d.delayTime);
        const gain = ctx.createGain(); const pan = ctx.createStereoPanner();
        input.connect(d); d.connect(gain); gain.connect(pan); pan.connect(bus);
        voices.push({ gain, pan, depth, lfo });
      }
      const apply = (t?: number) => {
        const n = clamp(Math.round(val("voices", 4)), 2, 8), det = val("detune", 0.4), spr = val("spread", 0.8);
        voices.forEach((v, i) => {
          const on = i < n ? 1 / Math.sqrt(n) : 0;
          const pan = i < n ? spr * ((i / (n - 1)) * 2 - 1) : 0;
          const dep = det * 0.004;
          if (t === undefined) { v.gain.gain.value = on; v.pan.pan.value = pan; v.depth.gain.value = dep; }
          else { glide(v.gain.gain, on, t); glide(v.pan.pan, pan, t); glide(v.depth.gain, dep, t); }
        });
      };
      apply();
      bus.connect(post); post.connect(wet);
      for (const id of ["voices", "detune", "spread"]) live(id, (_v, t) => apply(t));
      live("rate", (v, t) => voices.forEach((x, i) => glide(x.lfo.frequency, v * (1 + i * 0.17), t)));
      mix(0.5); start(...voices.map(v => v.lfo));
      break;
    }
    case "amp": {
      const bass = val("mode", 0) >= 0.5;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = bass ? 30 : 80;
      const pre = ctx.createGain(); const shaper = ctx.createWaveShaper();
      const setGain = (g: number) => { pre.gain.value = 1 + g * (bass ? 20 : 40); shaper.curve = curve(x => x >= 0 ? Math.tanh(x * 1.5) : Math.tanh(x * (bass ? 1.2 : 2)) * 0.9); };
      setGain(val("gain", 0.4));
      const stack = [["bass", "lowshelf", bass ? 80 : 110], ["mid", "peaking", bass ? 500 : 750], ["treble", "highshelf", bass ? 2500 : 3200], ["presence", "peaking", bass ? 4000 : 5500]] as const;
      let cur: AudioNode = shaper;
      for (const [id, type, f] of stack) {
        const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = 0.8; b.gain.value = val(id, 0);
        live(id, (v, t) => glide(b.gain, v, t)); cur.connect(b); cur = b;
      }
      const cabLp = ctx.createBiquadFilter(); cabLp.type = "lowpass"; cabLp.Q.value = 1.2;
      const cabRes = ctx.createBiquadFilter(); cabRes.type = "peaking"; cabRes.frequency.value = bass ? 90 : 120; cabRes.Q.value = 2;
      const setCab = (c: number, t?: number) => { const f = 20000 - c * (20000 - (bass ? 3500 : 5500)); const g = c * 4; if (t === undefined) { cabLp.frequency.value = f; cabRes.gain.value = g; } else { glide(cabLp.frequency, f, t); glide(cabRes.gain, g, t); } };
      setCab(val("cabinet", 0.8));
      const post = ctx.createGain(); outLevel(post, -6);
      input.connect(hp); hp.connect(pre); pre.connect(shaper); cur.connect(cabLp); cabLp.connect(cabRes); cabRes.connect(post); post.connect(wet);
      wet.gain.value = 1; dry.gain.value = 0;
      live("gain", (v) => setGain(v)); live("cabinet", (v, t) => setCab(v, t));
      break;
    }
    case "ensemble": {
      const slow: OscillatorNode[] = []; const slowAmt: GainNode[] = []; const pans: StereoPannerNode[] = [];
      const vib = ctx.createOscillator(); vib.frequency.value = val("vibrato", 6);
      const vibAmt = ctx.createGain(); vibAmt.gain.value = val("vibDepth", 0.2) * 0.0008; vib.connect(vibAmt);
      const bus = ctx.createGain(); bus.gain.value = 0.6;
      [0.012, 0.015, 0.018].forEach((base, i) => {
        const d = ctx.createDelay(0.1); d.delayTime.value = base;
        const lfo = ctx.createOscillator(); lfo.frequency.value = val("rate", 0.6) * [1, 1.13, 0.89][i]!;
        const amt = ctx.createGain(); amt.gain.value = val("depth", 0.6) * 0.004;
        lfo.connect(amt); amt.connect(d.delayTime); vibAmt.connect(d.delayTime);
        const pan = ctx.createStereoPanner(); pan.pan.value = (i - 1) * val("spread", 0.8);
        input.connect(d); d.connect(pan); pan.connect(bus);
        slow.push(lfo); slowAmt.push(amt); pans.push(pan);
      });
      bus.connect(wet);
      live("rate", (v, t) => slow.forEach((l, i) => glide(l.frequency, v * [1, 1.13, 0.89][i]!, t)));
      live("depth", (v, t) => slowAmt.forEach(a => glide(a.gain, v * 0.004, t)));
      live("vibrato", (v, t) => glide(vib.frequency, v, t));
      live("vibDepth", (v, t) => glide(vibAmt.gain, v * 0.0008, t));
      live("spread", (v, t) => pans.forEach((pn, i) => glide(pn.pan, (i - 1) * v, t)));
      mix(0.6); start(vib, ...slow);
      break;
    }
    case "sidechain": {
      const beats = [1, 0.5, 2, 4][clamp(Math.round(val("division", 0)), 0, 3)]!;
      const depth = val("depth", 0.8), rel = val("release", 0.5), pw = val("curve", 2);
      const N = 256, H = 48; const samples = Array.from({ length: N }, (_, i) => duckShape(i / N, depth, rel, pw));
      const mean = samples.reduce((a, b) => a + b, 0) / N;
      const re = new Float32Array(H), im = new Float32Array(H);
      for (let k = 1; k < H; k++) { let a = 0, b = 0; for (let i = 0; i < N; i++) { const ph = 2 * Math.PI * k * i / N; a += samples[i]! * Math.cos(ph); b += samples[i]! * Math.sin(ph); } re[k] = 2 * a / N; im[k] = 2 * b / N; }
      const osc = ctx.createOscillator(); osc.setPeriodicWave(ctx.createPeriodicWave(re, im, { disableNormalization: true }));
      osc.frequency.value = val("tempo", 124) / 60 / beats;
      const vca = ctx.createGain(); vca.gain.value = mean; osc.connect(vca.gain);
      const post = ctx.createGain(); outLevel(post);
      input.connect(vca); vca.connect(post); post.connect(wet); wet.gain.value = 1; dry.gain.value = 0;
      live("tempo", (v, t) => glide(osc.frequency, v / 60 / beats, t));
      start(osc);
      break;
    }
    case "distmatrix": {
      const pre = ctx.createGain(); pre.gain.value = 1 + val("drive", 0.5) * 12;
      const sum = ctx.createGain(); sum.gain.value = 0.6;
      const types: [string, (x: number) => number][] = [
        ["tube", x => x >= 0 ? Math.tanh(x) : Math.tanh(x * 0.6) / 0.8],
        ["fuzz", x => Math.sign(x) * (1 - Math.exp(-Math.abs(x) * 8))],
        ["fold", x => Math.sin(x * Math.PI * 1.5)],
        ["rect", x => Math.abs(x) * 2 - 0.6],
      ];
      for (const [id, fn] of types) {
        const ws = ctx.createWaveShaper(); ws.curve = curve(fn); ws.oversample = "2x";
        const lvl = ctx.createGain(); lvl.gain.value = val(id, id === "tube" ? 0.7 : 0);
        pre.connect(ws); ws.connect(lvl); lvl.connect(sum);
        live(id, (v, t) => glide(lvl.gain, v, t));
      }
      const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = val("tone", 8000);
      const post = ctx.createGain(); outLevel(post, -6);
      input.connect(pre); sum.connect(tone); tone.connect(post); post.connect(wet);
      live("drive", (v, t) => glide(pre.gain, 1 + v * 12, t));
      live("tone", (v, t) => glide(tone.frequency, v, t));
      mix(1);
      break;
    }
  }
  return { input, output };
}
