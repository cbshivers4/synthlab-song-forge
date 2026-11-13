/** Modular Tech Synth: an empty rack you fill with devices, then wire with coloured patch cables. */

export type ModuleType = "vco" | "noise" | "lfo" | "env" | "vcf" | "vca" | "mixer" | "drive" | "delay" | "output" | "fold" | "ring" | "sh" | "chorus" | "reverb" | "sub" | "formant" | "phaser" | "compressor" | "stereo" | "attenuverter" | "seq" | "chaos" | "follower" | "macro" | "comb";
export type CableColor = "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "white";
export const CABLE_COLORS: CableColor[] = ["red", "orange", "yellow", "green", "blue", "purple", "white"];

export interface ModModule { id: string; type: ModuleType; params: Record<string, number | string> }
export interface PortRef { module: string; port: string }
export interface ModCable { id: string; from: PortRef; to: PortRef; amount: number; color: CableColor }
export interface ModularPatch { version: 2; modules: ModModule[]; cables: ModCable[] }

type InKind = "audio" | "param";
export interface ModuleDef {
  type: ModuleType;
  label: string;
  hp: number;
  params: { id: string; label: string; min?: number; max?: number; step?: number; unit?: string; options?: string[]; def: number | string }[];
  inputs: { id: string; label: string; kind: InKind; scale?: number }[];
  outputs: { id: string; label: string }[];
}

const WAVES = ["sine", "triangle", "sawtooth", "square"];
export const MODULE_DEFS: Record<ModuleType, ModuleDef> = {
  vco: { type: "vco", label: "VCO", hp: 1, params: [
    { id: "wave", label: "WAVE", options: WAVES, def: "sawtooth" },
    { id: "octave", label: "OCT", min: -3, max: 3, step: 1, def: 0 },
    { id: "fine", label: "FINE", min: -100, max: 100, step: 1, unit: "c", def: 0 },
  ], inputs: [{ id: "pitch", label: "PITCH", kind: "param", scale: 1200 }, { id: "fm", label: "FM", kind: "param", scale: 2000 }], outputs: [{ id: "out", label: "OUT" }] },
  noise: { type: "noise", label: "NOISE", hp: 1, params: [{ id: "color", label: "COLOR", options: ["white", "pink"], def: "white" }], inputs: [], outputs: [{ id: "out", label: "OUT" }] },
  lfo: { type: "lfo", label: "LFO", hp: 1, params: [
    { id: "wave", label: "WAVE", options: WAVES, def: "sine" },
    { id: "rate", label: "RATE", min: 0.05, max: 40, step: 0.05, unit: "Hz", def: 4 },
  ], inputs: [{ id: "rate", label: "RATE", kind: "param", scale: 20 }], outputs: [{ id: "out", label: "OUT" }] },
  env: { type: "env", label: "ENVELOPE", hp: 1, params: [
    { id: "attack", label: "ATK", min: 0.001, max: 3, step: 0.001, def: 0.005 },
    { id: "decay", label: "DEC", min: 0.005, max: 3, step: 0.005, def: 0.3 },
    { id: "sustain", label: "SUS", min: 0, max: 1, step: 0.01, def: 0.6 },
    { id: "release", label: "REL", min: 0.005, max: 4, step: 0.005, def: 0.3 },
  ], inputs: [], outputs: [{ id: "out", label: "OUT" }] },
  vcf: { type: "vcf", label: "VCF", hp: 1, params: [
    { id: "type", label: "MODE", options: ["lowpass", "highpass", "bandpass"], def: "lowpass" },
    { id: "cutoff", label: "CUTOFF", min: 40, max: 16000, step: 10, def: 900 },
    { id: "resonance", label: "RES", min: 0, max: 25, step: 0.5, def: 6 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }, { id: "cutoff", label: "CV", kind: "param", scale: 6000 }], outputs: [{ id: "out", label: "OUT" }] },
  vca: { type: "vca", label: "VCA", hp: 1, params: [{ id: "bias", label: "BIAS", min: 0, max: 1, step: 0.01, def: 0 }],
    inputs: [{ id: "in", label: "IN", kind: "audio" }, { id: "cv", label: "CV", kind: "param", scale: 1 }], outputs: [{ id: "out", label: "OUT" }] },
  mixer: { type: "mixer", label: "MIXER", hp: 1, params: [{ id: "level", label: "LEVEL", min: 0, max: 1.5, step: 0.01, def: 0.8 }],
    inputs: [1, 2, 3, 4].map((i) => ({ id: `in${i}`, label: `IN ${i}`, kind: "audio" as const })), outputs: [{ id: "out", label: "OUT" }] },
  drive: { type: "drive", label: "DRIVE", hp: 1, params: [{ id: "amount", label: "DRIVE", min: 0, max: 1, step: 0.01, def: 0.4 }],
    inputs: [{ id: "in", label: "IN", kind: "audio" }], outputs: [{ id: "out", label: "OUT" }] },
  delay: { type: "delay", label: "DELAY", hp: 1, params: [
    { id: "time", label: "TIME", min: 0.01, max: 1, step: 0.01, unit: "s", def: 0.3 },
    { id: "feedback", label: "FDBK", min: 0, max: 0.9, step: 0.01, def: 0.4 },
    { id: "mix", label: "MIX", min: 0, max: 1, step: 0.01, def: 0.4 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }, { id: "time", label: "TIME CV", kind: "param", scale: 0.05 }], outputs: [{ id: "out", label: "OUT" }] },
  fold: { type: "fold", label: "WAVEFOLDER", hp: 1, params: [
    { id: "folds", label: "FOLD", min: 0, max: 1, step: 0.01, def: 0.5 },
    { id: "gain", label: "INPUT", min: 0.2, max: 4, step: 0.01, def: 1.4 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }, { id: "gain", label: "FOLD CV", kind: "param", scale: 2 }], outputs: [{ id: "out", label: "OUT" }] },
  ring: { type: "ring", label: "RING MOD", hp: 1, params: [{ id: "mix", label: "MIX", min: 0, max: 1, step: 0.01, def: 1 }],
    inputs: [{ id: "in", label: "CARRIER", kind: "audio" }, { id: "mod", label: "MOD", kind: "param", scale: 2 }], outputs: [{ id: "out", label: "OUT" }] },
  sh: { type: "sh", label: "SAMPLE & HOLD", hp: 1, params: [
    { id: "rate", label: "RATE", min: 0.5, max: 32, step: 0.5, unit: "Hz", def: 8 },
    { id: "range", label: "RANGE", min: 0, max: 1, step: 0.01, def: 1 },
  ], inputs: [], outputs: [{ id: "out", label: "OUT" }] },
  chorus: { type: "chorus", label: "CHORUS", hp: 1, params: [
    { id: "rate", label: "RATE", min: 0.05, max: 6, step: 0.05, unit: "Hz", def: 0.8 },
    { id: "depth", label: "DEPTH", min: 0, max: 1, step: 0.01, def: 0.5 },
    { id: "mix", label: "MIX", min: 0, max: 1, step: 0.01, def: 0.5 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }], outputs: [{ id: "out", label: "OUT" }] },
  reverb: { type: "reverb", label: "SPRING VERB", hp: 1, params: [
    { id: "size", label: "SIZE", min: 0.3, max: 4, step: 0.05, unit: "s", def: 1.6 },
    { id: "mix", label: "MIX", min: 0, max: 1, step: 0.01, def: 0.35 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }], outputs: [{ id: "out", label: "OUT" }] },
  sub: { type: "sub", label: "SUB OSC", hp: 1, params: [
    { id: "wave", label: "WAVE", options: ["sine", "square", "triangle"], def: "sine" },
    { id: "octave", label: "OCTAVE", min: -3, max: -1, step: 1, def: -1 },
    { id: "level", label: "LEVEL", min: 0, max: 1, step: 0.01, def: 0.7 },
  ], inputs: [{ id: "pitch", label: "PITCH", kind: "param", scale: 1200 }], outputs: [{ id: "out", label: "OUT" }] },
  formant: { type: "formant", label: "VOWEL FILTER", hp: 2, params: [
    { id: "vowel", label: "VOWEL", options: ["A", "E", "I", "O", "U"], def: "A" },
    { id: "shift", label: "SHIFT", min: -12, max: 12, step: 0.1, unit: "st", def: 0 },
    { id: "resonance", label: "RESONANCE", min: 1, max: 20, step: 0.1, def: 6 },
    { id: "mix", label: "BLEND", min: 0, max: 1, step: 0.01, def: 0.85 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }, { id: "shift", label: "SHIFT CV", kind: "param", scale: 1200 }], outputs: [{ id: "out", label: "OUT" }] },
  phaser: { type: "phaser", label: "PHASE ARRAY", hp: 2, params: [
    { id: "rate", label: "RATE", min: 0.05, max: 8, step: 0.05, unit: "Hz", def: 0.4 },
    { id: "depth", label: "DEPTH", min: 0, max: 1, step: 0.01, def: 0.6 },
    { id: "center", label: "CENTER", min: 100, max: 4000, step: 10, unit: "Hz", def: 700 },
    { id: "mix", label: "BLEND", min: 0, max: 1, step: 0.01, def: 0.5 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }], outputs: [{ id: "out", label: "OUT" }] },
  compressor: { type: "compressor", label: "DYNAMICS", hp: 2, params: [
    { id: "threshold", label: "THRESHOLD", min: -60, max: 0, step: 1, unit: "dB", def: -24 },
    { id: "ratio", label: "RATIO", min: 1, max: 20, step: 0.1, def: 4 },
    { id: "attack", label: "ATTACK", min: 1, max: 100, step: 1, unit: "ms", def: 10 },
    { id: "release", label: "RELEASE", min: 20, max: 1000, step: 10, unit: "ms", def: 180 },
    { id: "makeup", label: "MAKEUP", min: 0, max: 18, step: 0.1, unit: "dB", def: 0 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }], outputs: [{ id: "out", label: "OUT" }] },
  stereo: { type: "stereo", label: "STEREO MOTION", hp: 2, params: [
    { id: "pan", label: "PAN", min: -1, max: 1, step: 0.01, def: 0 },
    { id: "rate", label: "RATE", min: 0.05, max: 10, step: 0.05, unit: "Hz", def: 0.5 },
    { id: "depth", label: "MOTION", min: 0, max: 1, step: 0.01, def: 0.7 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }, { id: "pan", label: "PAN CV", kind: "param", scale: 1 }], outputs: [{ id: "out", label: "OUT" }] },
  attenuverter: { type: "attenuverter", label: "CV UTILITY", hp: 1, params: [
    { id: "amount", label: "POLARITY", min: -2, max: 2, step: 0.01, def: 1 },
    { id: "offset", label: "OFFSET", min: -1, max: 1, step: 0.01, def: 0 },
  ], inputs: [{ id: "in", label: "CV IN", kind: "audio" }], outputs: [{ id: "out", label: "CV OUT" }] },
  seq: { type: "seq", label: "STEP SEQUENCER", hp: 2, params: [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ id: `s${i}`, label: `STEP ${i}`, min: -12, max: 12, step: 1, unit: "st", def: 0 })),
    { id: "rate", label: "RATE", min: 0.5, max: 24, step: 0.5, unit: "Hz", def: 6 },
    { id: "length", label: "LENGTH", min: 1, max: 8, step: 1, def: 8 },
    { id: "glide", label: "GLIDE", min: 0, max: 0.25, step: 0.005, unit: "s", def: 0 },
    { id: "gate", label: "GATE", min: 0.05, max: 1, step: 0.01, def: 0.5 },
  ], inputs: [], outputs: [{ id: "out", label: "PITCH" }, { id: "gate", label: "GATE" }] },
  chaos: { type: "chaos", label: "CHAOS", hp: 1, params: [
    { id: "rate", label: "RATE", min: 0.05, max: 30, step: 0.05, unit: "Hz", def: 3 },
    { id: "chaos", label: "CHAOS", min: 3.4, max: 4, step: 0.005, def: 3.9 },
    { id: "smooth", label: "SMOOTH", min: 0, max: 1, step: 0.01, def: 0.6 },
    { id: "range", label: "RANGE", min: 0, max: 1, step: 0.01, def: 1 },
  ], inputs: [], outputs: [{ id: "out", label: "OUT" }] },
  follower: { type: "follower", label: "ENV FOLLOWER", hp: 1, params: [
    { id: "smooth", label: "SPEED", min: 1, max: 60, step: 0.5, unit: "Hz", def: 12 },
    { id: "gain", label: "GAIN", min: 0, max: 6, step: 0.01, def: 2 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }], outputs: [{ id: "out", label: "CV OUT" }] },
  macro: { type: "macro", label: "MACRO", hp: 1, params: [
    { id: "value", label: "MACRO", min: 0, max: 1, step: 0.01, def: 0.5 },
    { id: "amount", label: "RANGE", min: -1, max: 1, step: 0.01, def: 1 },
  ], inputs: [], outputs: [{ id: "out", label: "OUT" }, { id: "inv", label: "INV" }] },
  comb: { type: "comb", label: "COMB RESONATOR", hp: 2, params: [
    { id: "tune", label: "TUNE", min: 0.25, max: 4, step: 0.01, unit: "×", def: 1 },
    { id: "feedback", label: "FEEDBACK", min: 0, max: 0.98, step: 0.01, def: 0.85 },
    { id: "damp", label: "DAMP", min: 400, max: 16000, step: 10, unit: "Hz", def: 6000 },
    { id: "mix", label: "BLEND", min: 0, max: 1, step: 0.01, def: 0.8 },
  ], inputs: [{ id: "in", label: "IN", kind: "audio" }, { id: "feedback", label: "FDBK CV", kind: "param", scale: 0.3 }], outputs: [{ id: "out", label: "OUT" }] },
  output: { type: "output", label: "OUTPUT", hp: 1, params: [{ id: "level", label: "LEVEL", min: 0, max: 1, step: 0.01, def: 0.7 }],
    inputs: [{ id: "in", label: "IN", kind: "audio" }, { id: "pan", label: "PAN CV", kind: "param", scale: 1 }], outputs: [] },
};

// New controls default to the old signal path so existing racks keep their sound.
const extraControls: Partial<Record<ModuleType, ModuleDef["params"]>> = {
  vco: [{ id: "semitone", label: "SEMITONE", min: -12, max: 12, step: 1, def: 0 }, { id: "level", label: "LEVEL", min: 0, max: 1, def: 1 }],
  noise: [{ id: "level", label: "LEVEL", min: 0, max: 1, def: 1 }, { id: "tone", label: "TONE", min: 100, max: 20000, step: 10, unit: "Hz", def: 20000 }],
  lfo: [{ id: "depth", label: "DEPTH", min: 0, max: 2, def: 1 }, { id: "offset", label: "OFFSET", min: -1, max: 1, def: 0 }],
  env: [{ id: "amount", label: "AMOUNT", min: 0, max: 2, def: 1 }],
  vcf: [{ id: "input", label: "INPUT", min: 0, max: 2, def: 1 }, { id: "tracking", label: "KEY TRACK", min: 0, max: 1, def: 0 }],
  vca: [{ id: "level", label: "OUTPUT", min: 0, max: 2, def: 1 }],
  mixer: [1, 2, 3, 4].map(i => ({ id: `level${i}`, label: `INPUT ${i}`, min: 0, max: 1.5, def: 1 })),
  drive: [{ id: "tone", label: "TONE", min: 100, max: 20000, step: 10, unit: "Hz", def: 20000 }, { id: "mix", label: "BLEND", min: 0, max: 1, def: 1 }, { id: "level", label: "OUTPUT", min: 0, max: 1.5, def: 1 }],
  delay: [{ id: "tone", label: "ECHO TONE", min: 100, max: 20000, step: 10, unit: "Hz", def: 20000 }, { id: "level", label: "OUTPUT", min: 0, max: 1.5, def: 1 }],
  fold: [{ id: "mix", label: "BLEND", min: 0, max: 1, def: 1 }, { id: "level", label: "OUTPUT", min: 0, max: 1.5, def: 1 }],
  ring: [{ id: "frequency", label: "OSC FREQ", min: 0, max: 2000, step: 1, unit: "Hz", def: 0 }, { id: "depth", label: "OSC DEPTH", min: 0, max: 1, def: 0 }],
  sh: [{ id: "offset", label: "OFFSET", min: -1, max: 1, def: 0 }],
  chorus: [{ id: "time", label: "DELAY", min: 10, max: 40, step: 1, unit: "ms", def: 15 }, { id: "feedback", label: "FEEDBACK", min: 0, max: 0.8, def: 0 }],
  reverb: [{ id: "predelay", label: "PREDELAY", min: 0, max: 200, step: 1, unit: "ms", def: 0 }, { id: "tone", label: "DAMPING", min: 200, max: 20000, step: 10, unit: "Hz", def: 20000 }],
  sub: [{ id: "fine", label: "FINE", min: -100, max: 100, step: 1, unit: "c", def: 0 }],
  formant: [{ id: "level", label: "OUTPUT", min: 0, max: 2, def: 1 }],
  phaser: [{ id: "stages", label: "STAGES", options: ["2", "4", "6", "8"], def: "4" }, { id: "resonance", label: "RESONANCE", min: 0.1, max: 4, def: 0.7 }],
  compressor: [{ id: "knee", label: "SOFT KNEE", min: 0, max: 40, step: 1, unit: "dB", def: 6 }, { id: "mix", label: "PARALLEL", min: 0, max: 1, def: 1 }],
  stereo: [{ id: "wave", label: "MOTION WAVE", options: WAVES, def: "sine" }, { id: "level", label: "OUTPUT", min: 0, max: 1.5, def: 1 }],
  attenuverter: [{ id: "smooth", label: "CV FILTER", min: 1, max: 20000, step: 1, unit: "Hz", def: 20000 }],
  output: [{ id: "pan", label: "PAN", min: -1, max: 1, def: 0 }],
};
for (const type of Object.keys(extraControls) as ModuleType[]) {
  MODULE_DEFS[type].params.push(...(extraControls[type] ?? []));
  if (MODULE_DEFS[type].params.length >= 5) MODULE_DEFS[type].hp = 2;
}
MODULE_DEFS.vco.inputs.push({ id: "level", label: "LEVEL CV", kind: "param", scale: 1 });
MODULE_DEFS.vcf.inputs.push({ id: "resonance", label: "RES CV", kind: "param", scale: 10 });
MODULE_DEFS.delay.inputs.push({ id: "mix", label: "WET CV", kind: "param", scale: 0.2 });
MODULE_DEFS.chorus.inputs.push({ id: "rate", label: "RATE CV", kind: "param", scale: 2 });
MODULE_DEFS.output.inputs.push({ id: "level", label: "LEVEL CV", kind: "param", scale: 0.2 });

let n = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}`;
export const cableId = () => nid("cab");
export const newModule = (type: ModuleType): ModModule => ({
  id: nid(type),
  type,
  params: Object.fromEntries(MODULE_DEFS[type].params.map((p) => [p.id, p.def])),
});
export const emptyModular = (): ModularPatch => ({ version: 2, modules: [], cables: [] });

/** Converts patches saved before the open rack (fixed VCO1/VCO2/… layout) into rack modules. */
export function normalizeModular(m: unknown): ModularPatch {
  const x = m as Record<string, any> | undefined;
  if (!x) return emptyModular();
  if (x["version"] === 2) return x as ModularPatch;
  const mods: ModModule[] = [];
  const add = (id: string, type: ModuleType, params: Record<string, any>) => mods.push({ id, type, params: { ...newModule(type).params, ...params } });
  add("vco1", "vco", x["vco1"] ?? {}); add("vco2", "vco", x["vco2"] ?? {}); add("noise", "noise", x["noise"] ?? {});
  add("lfo", "lfo", x["lfo"] ?? {}); add("env1", "env", x["env1"] ?? {}); add("env2", "env", x["env2"] ?? {});
  add("vcf", "vcf", x["vcf"] ?? {}); add("vca", "vca", x["vca"] ?? {}); add("out", "output", x["out"] ?? {});
  const port = (s: string, out: boolean): PortRef => {
    if (out) return { module: s, port: "out" };
    const [mod, p] = s.split(".") as [string, string];
    return { module: mod === "out" ? "out" : mod, port: p === "pitch" || p === "fm" || p === "cv" || p === "in" || p === "pan" ? p : p === "cutoff" ? "cutoff" : p };
  };
  const cables: ModCable[] = (x["cables"] ?? []).map((c: any, i: number) => ({ id: c.id ?? `c${i}`, from: port(c.from, true), to: port(c.to, false), amount: c.amount ?? 1, color: CABLE_COLORS[i % CABLE_COLORS.length]! }));
  return { version: 2, modules: mods, cables };
}

const noiseCache = new WeakMap<BaseAudioContext, Record<string, AudioBuffer>>();
function noiseBuffer(ctx: BaseAudioContext, color: string) {
  let c = noiseCache.get(ctx);
  if (!c) noiseCache.set(ctx, (c = {}));
  if (c[color]) return c[color]!;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (color !== "pink") d[i] = w * 0.5;
    else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
  }
  c[color] = buf;
  return buf;
}
const foldCurve = (k: number) => {
  const c = new Float32Array(2048); const f = 1 + k * 6;
  for (let i = 0; i < c.length; i++) { const x = (i / 1023.5) - 1; c[i] = Math.sin(x * f * Math.PI / 2); }
  return c;
};
const irCache = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();
function springIR(ctx: BaseAudioContext, secs: number) {
  const k = Math.round(secs * 20) / 20;
  let m = irCache.get(ctx); if (!m) irCache.set(ctx, (m = new Map()));
  const hit = m.get(k); if (hit) return hit;
  const len = Math.max(1, Math.floor(ctx.sampleRate * k)); const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-4 * t / k) * (1 + 0.4 * Math.sin(t * 2 * Math.PI * 38)); } }
  m.set(k, b); return b;
}
const driveCurve = (k: number) => {
  const c = new Float32Array(1024);
  const a = 1 + k * 30;
  for (let i = 0; i < c.length; i++) { const x = (i / 511.5) - 1; c[i] = Math.tanh(a * x) / Math.tanh(a); }
  return c;
};

/** Builds one voice of the rack for a note. Unpatched modules make no sound; only what reaches an OUTPUT is heard. */
export function playModularVoice(ctx: BaseAudioContext, dest: AudioNode, raw: unknown, midi: number, duration: number, velocity: number, t0: number, pitchBus?: AudioNode, observeOutput?: (mod: ModModule, source: AudioNode) => (() => void) | undefined): number {
  const m = normalizeModular(raw);
  const num = (mod: ModModule, k: string) => Number(mod.params[k] ?? MODULE_DEFS[mod.type].params.find((p) => p.id === k)?.def ?? 0);
  const str = (mod: ModModule, k: string) => String(mod.params[k] ?? MODULE_DEFS[mod.type].params.find((p) => p.id === k)?.def ?? "");
  const maxRel = Math.max(0.1, ...m.modules.filter((x) => x.type === "env").map((x) => num(x, "release")));
  const hasDelay = m.modules.some((x) => x.type === "delay" || x.type === "reverb");
  const life = duration + maxRel + (hasDelay ? 1.5 : 0.3);
  const stopAt = t0 + life;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const sources: AudioScheduledSourceNode[] = [];
  const outs = new Map<string, AudioNode>();
  const ins = new Map<string, AudioNode | AudioParam>();
  const key = (a: string, b: string) => `${a}|${b}`;
  const finals: GainNode[] = [];
  const outputTaps = new Map<string, AudioNode>();

  for (const mod of m.modules) {
    switch (mod.type) {
      case "vco": {
        const o = ctx.createOscillator();
        o.type = str(mod, "wave") as OscillatorType;
        o.frequency.value = freq * Math.pow(2, num(mod, "octave"));
        o.detune.value = num(mod, "fine") + num(mod, "semitone") * 100;
        if (pitchBus) pitchBus.connect(o.detune);
        const level = ctx.createGain(); level.gain.value = num(mod, "level"); o.connect(level);
        ins.set(key(mod.id, "level"), level.gain);
        sources.push(o); outs.set(key(mod.id, "out"), level);
        ins.set(key(mod.id, "pitch"), o.detune); ins.set(key(mod.id, "fm"), o.frequency);
        break;
      }
      case "noise": {
        const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, str(mod, "color")); s.loop = true;
        const tone = ctx.createBiquadFilter(); tone.frequency.value = num(mod, "tone");
        const level = ctx.createGain(); level.gain.value = num(mod, "level"); s.connect(tone).connect(level);
        sources.push(s); outs.set(key(mod.id, "out"), level); break;
      }
      case "lfo": {
        const o = ctx.createOscillator(); o.type = str(mod, "wave") as OscillatorType; o.frequency.value = num(mod, "rate");
        const depth = ctx.createGain(), output = ctx.createGain(), offset = ctx.createConstantSource();
        depth.gain.value = num(mod, "depth"); offset.offset.value = num(mod, "offset");
        o.connect(depth).connect(output); offset.connect(output); sources.push(o, offset);
        outs.set(key(mod.id, "out"), output); ins.set(key(mod.id, "rate"), o.frequency); break;
      }
      case "env": {
        const s = ctx.createConstantSource(); const p = s.offset;
        const a = Math.max(0.001, num(mod, "attack")), d = Math.max(0.005, num(mod, "decay")), su = num(mod, "sustain"), r = Math.max(0.005, num(mod, "release"));
        p.setValueAtTime(0, t0); p.linearRampToValueAtTime(1, t0 + a); p.setTargetAtTime(su, t0 + a, d / 3);
        const rel = t0 + Math.max(duration, a); p.cancelScheduledValues(rel); p.setTargetAtTime(0, rel, r / 3);
        const amount = ctx.createGain(); amount.gain.value = num(mod, "amount"); s.connect(amount);
        sources.push(s); outs.set(key(mod.id, "out"), amount); break;
      }
      case "vcf": {
        const i = ctx.createGain(); const f = ctx.createBiquadFilter();
        f.type = str(mod, "type") as BiquadFilterType; f.frequency.value = num(mod, "cutoff"); f.Q.value = num(mod, "resonance");
        i.gain.value = num(mod, "input"); f.detune.value = (midi - 60) * 100 * num(mod, "tracking");
        ins.set(key(mod.id, "resonance"), f.Q);
        i.connect(f); ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "cutoff"), f.frequency); outs.set(key(mod.id, "out"), f); break;
      }
      case "vca": {
        const i = ctx.createGain(); const g = ctx.createGain(); g.gain.value = num(mod, "bias");
        const output = ctx.createGain(); output.gain.value = num(mod, "level");
        i.connect(g).connect(output); ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "cv"), g.gain); outs.set(key(mod.id, "out"), output); break;
      }
      case "mixer": {
        const g = ctx.createGain(); g.gain.value = num(mod, "level");
        for (let k = 1; k <= 4; k++) { const input = ctx.createGain(); input.gain.value = num(mod, `level${k}`); input.connect(g); ins.set(key(mod.id, `in${k}`), input); }
        outs.set(key(mod.id, "out"), g); break;
      }
      case "drive": {
        const i = ctx.createGain(); i.gain.value = 1 + num(mod, "amount") * 3; const w = ctx.createWaveShaper(); w.curve = driveCurve(num(mod, "amount")); w.oversample = "2x";
        const tone = ctx.createBiquadFilter(), wet = ctx.createGain(), dry = ctx.createGain(), output = ctx.createGain();
        tone.frequency.value = num(mod, "tone"); wet.gain.value = num(mod, "mix"); dry.gain.value = 1 - num(mod, "mix"); output.gain.value = num(mod, "level");
        const input = ctx.createGain(); input.connect(dry).connect(output); input.connect(i).connect(w).connect(tone).connect(wet).connect(output);
        ins.set(key(mod.id, "in"), input); outs.set(key(mod.id, "out"), output); break;
      }
      case "delay": {
        const i = ctx.createGain(); const dl = ctx.createDelay(2); dl.delayTime.value = num(mod, "time");
        const fb = ctx.createGain(); fb.gain.value = num(mod, "feedback"); const wet = ctx.createGain(); wet.gain.value = num(mod, "mix");
        ins.set(key(mod.id, "mix"), wet.gain);
        const dry = ctx.createGain(); dry.gain.value = 1 - num(mod, "mix") * 0.5; const o = ctx.createGain();
        const tone = ctx.createBiquadFilter(); tone.frequency.value = num(mod, "tone"); o.gain.value = num(mod, "level");
        i.connect(dry).connect(o); i.connect(dl); dl.connect(tone); tone.connect(fb).connect(dl); tone.connect(wet).connect(o);
        ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "time"), dl.delayTime); outs.set(key(mod.id, "out"), o); break;
      }
      case "fold": {
        const i = ctx.createGain(); i.gain.value = num(mod, "gain"); const w = ctx.createWaveShaper(); w.curve = foldCurve(num(mod, "folds")); w.oversample = "4x";
        const o = ctx.createGain(), wet = ctx.createGain(), dry = ctx.createGain(), input = ctx.createGain(); o.gain.value = 0.8 * num(mod, "level");
        wet.gain.value = num(mod, "mix"); dry.gain.value = 1 - num(mod, "mix");
        input.connect(dry).connect(o); input.connect(i).connect(w).connect(wet).connect(o); ins.set(key(mod.id, "in"), input); ins.set(key(mod.id, "gain"), i.gain); outs.set(key(mod.id, "out"), o); break;
      }
      case "ring": {
        const i = ctx.createGain(); const r = ctx.createGain(); r.gain.value = 1 - num(mod, "mix");
        if (num(mod, "frequency") > 0 && num(mod, "depth") > 0) {
          const osc = ctx.createOscillator(), depth = ctx.createGain(); osc.frequency.value = num(mod, "frequency"); depth.gain.value = num(mod, "depth") * num(mod, "mix");
          osc.connect(depth).connect(r.gain); sources.push(osc);
        }
        i.connect(r); ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "mod"), r.gain); outs.set(key(mod.id, "out"), r); break;
      }
      case "sh": {
        const s = ctx.createConstantSource(); const rate = Math.max(0.5, num(mod, "rate")), range = num(mod, "range");
        for (let t = t0; t < stopAt; t += 1 / rate) s.offset.setValueAtTime((Math.random() * 2 - 1) * range + num(mod, "offset"), t);
        sources.push(s); outs.set(key(mod.id, "out"), s); break;
      }
      case "chorus": {
        const i = ctx.createGain(); const dl = ctx.createDelay(0.1); dl.delayTime.value = num(mod, "time") / 1000;
        const feedback = ctx.createGain(); feedback.gain.value = num(mod, "feedback"); dl.connect(feedback).connect(dl);
        const lfo = ctx.createOscillator(); lfo.frequency.value = num(mod, "rate"); const dep = ctx.createGain(); dep.gain.value = 0.008 * num(mod, "depth");
        ins.set(key(mod.id, "rate"), lfo.frequency);
        lfo.connect(dep).connect(dl.delayTime); sources.push(lfo);
        const wet = ctx.createGain(); wet.gain.value = num(mod, "mix"); const dry = ctx.createGain(); dry.gain.value = 1 - num(mod, "mix") * 0.5; const o = ctx.createGain();
        i.connect(dry).connect(o); i.connect(dl).connect(wet).connect(o);
        ins.set(key(mod.id, "in"), i); outs.set(key(mod.id, "out"), o); break;
      }
      case "reverb": {
        const i = ctx.createGain(); const cv = ctx.createConvolver(); cv.buffer = springIR(ctx, num(mod, "size"));
        const wet = ctx.createGain(); wet.gain.value = num(mod, "mix") * 0.6; const dry = ctx.createGain(); dry.gain.value = 1 - num(mod, "mix") * 0.5; const o = ctx.createGain();
        const predelay = ctx.createDelay(1), tone = ctx.createBiquadFilter(); predelay.delayTime.value = num(mod, "predelay") / 1000; tone.frequency.value = num(mod, "tone");
        i.connect(dry).connect(o); i.connect(predelay).connect(cv).connect(tone).connect(wet).connect(o);
        ins.set(key(mod.id, "in"), i); outs.set(key(mod.id, "out"), o); break;
      }
      case "sub": {
        const osc = ctx.createOscillator(); osc.type = str(mod, "wave") as OscillatorType;
        osc.frequency.value = freq * Math.pow(2, num(mod, "octave"));
        osc.detune.value = num(mod, "fine");
        if (pitchBus) pitchBus.connect(osc.detune);
        const level = ctx.createGain(); level.gain.value = num(mod, "level"); osc.connect(level);
        sources.push(osc); ins.set(key(mod.id, "pitch"), osc.detune); outs.set(key(mod.id, "out"), level); break;
      }
      case "formant": {
        const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain();
        const mix = num(mod, "mix"); dry.gain.value = 1 - mix; output.gain.value = num(mod, "level"); input.connect(dry).connect(output);
        const vowels: Record<string, number[]> = { A: [800, 1150, 2900], E: [400, 1700, 2600], I: [350, 2000, 2800], O: [450, 800, 2830], U: [325, 700, 2530] };
        const shiftCV = ctx.createGain();
        for (const frequency of vowels[str(mod, "vowel")] ?? vowels["A"] ?? []) {
          const filter = ctx.createBiquadFilter(); filter.type = "bandpass";
          filter.frequency.value = frequency; filter.detune.value = num(mod, "shift") * 100; filter.Q.value = num(mod, "resonance");
          const gain = ctx.createGain(); gain.gain.value = mix * 0.8;
          shiftCV.connect(filter.detune); input.connect(filter).connect(gain).connect(output);
        }
        ins.set(key(mod.id, "in"), input); ins.set(key(mod.id, "shift"), shiftCV); outs.set(key(mod.id, "out"), output); break;
      }
      case "phaser": {
        const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
        dry.gain.value = 1 - num(mod, "mix"); wet.gain.value = num(mod, "mix"); input.connect(dry).connect(output);
        const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = num(mod, "rate");
        depth.gain.value = num(mod, "depth") * 1600; lfo.connect(depth); sources.push(lfo);
        let previous: AudioNode = input;
        for (let stage = 0; stage < num(mod, "stages"); stage++) {
          const filter = ctx.createBiquadFilter(); filter.type = "allpass"; filter.Q.value = num(mod, "resonance");
          filter.frequency.value = num(mod, "center") * (1 + stage * 0.25); depth.connect(filter.detune);
          previous.connect(filter); previous = filter;
        }
        previous.connect(wet).connect(output); ins.set(key(mod.id, "in"), input); outs.set(key(mod.id, "out"), output); break;
      }
      case "compressor": {
        const comp = ctx.createDynamicsCompressor(), makeup = ctx.createGain();
        comp.threshold.value = num(mod, "threshold"); comp.ratio.value = num(mod, "ratio"); comp.knee.value = num(mod, "knee");
        comp.attack.value = num(mod, "attack") / 1000; comp.release.value = num(mod, "release") / 1000;
        makeup.gain.value = Math.pow(10, num(mod, "makeup") / 20); comp.connect(makeup);
        const input = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), output = ctx.createGain();
        dry.gain.value = 1 - num(mod, "mix"); wet.gain.value = num(mod, "mix");
        input.connect(dry).connect(output); input.connect(comp); makeup.connect(wet).connect(output);
        ins.set(key(mod.id, "in"), input); outs.set(key(mod.id, "out"), output); break;
      }
      case "stereo": {
        const pan = ctx.createStereoPanner(), lfo = ctx.createOscillator(), depth = ctx.createGain();
        pan.pan.value = num(mod, "pan"); lfo.frequency.value = num(mod, "rate"); depth.gain.value = num(mod, "depth");
        lfo.type = str(mod, "wave") as OscillatorType;
        const output = ctx.createGain(); output.gain.value = num(mod, "level"); pan.connect(output);
        lfo.connect(depth).connect(pan.pan); sources.push(lfo);
        ins.set(key(mod.id, "in"), pan); ins.set(key(mod.id, "pan"), pan.pan); outs.set(key(mod.id, "out"), output); break;
      }
      case "attenuverter": {
        const input = ctx.createGain(), output = ctx.createGain(), offset = ctx.createConstantSource();
        input.gain.value = num(mod, "amount"); offset.offset.value = num(mod, "offset");
        const smooth = ctx.createBiquadFilter(); smooth.frequency.value = num(mod, "smooth");
        input.connect(smooth).connect(output); offset.connect(output); sources.push(offset);
        ins.set(key(mod.id, "in"), input); outs.set(key(mod.id, "out"), output); break;
      }
      case "seq": {
        // per-note step sequence: PITCH (octave units: 1 = 12 semitones, so ×1 into a VCO PITCH plays the steps in tune) and GATE pulses
        const pitch = ctx.createConstantSource(), gate = ctx.createConstantSource();
        const rate = Math.max(0.5, num(mod, "rate")), len = Math.max(1, Math.min(8, Math.round(num(mod, "length"))));
        const glide = num(mod, "glide"), gateLen = Math.max(0.05, Math.min(1, num(mod, "gate"))) / rate;
        pitch.offset.setValueAtTime(num(mod, "s1") / 12, t0);
        gate.offset.setValueAtTime(0, t0);
        let k = 0;
        for (let t = t0; t < stopAt; t += 1 / rate, k++) {
          const v = num(mod, `s${(k % len) + 1}`) / 12;
          if (glide > 0 && k > 0) pitch.offset.setTargetAtTime(v, t, glide / 3); else pitch.offset.setValueAtTime(v, t);
          gate.offset.setValueAtTime(1, t); gate.offset.setValueAtTime(0, Math.min(stopAt, t + gateLen));
        }
        sources.push(pitch, gate); outs.set(key(mod.id, "out"), pitch); outs.set(key(mod.id, "gate"), gate); break;
      }
      case "chaos": {
        // logistic-map chaos: steady at low CHAOS, wild near 4; SMOOTH glides between values
        const s = ctx.createConstantSource(); const rate = Math.max(0.05, num(mod, "rate")), r = num(mod, "chaos"), range = num(mod, "range");
        const smooth = num(mod, "smooth"); let x = 0.1 + Math.random() * 0.8;
        s.offset.setValueAtTime((x * 2 - 1) * range, t0);
        for (let t = t0 + 1 / rate; t < stopAt; t += 1 / rate) {
          x = r * x * (1 - x); if (x <= 0 || x >= 1) x = 0.37;
          const v = (x * 2 - 1) * range;
          if (smooth > 0) s.offset.linearRampToValueAtTime(v, t); else s.offset.setValueAtTime(v, t);
        }
        sources.push(s); outs.set(key(mod.id, "out"), s); break;
      }
      case "follower": {
        // rectify, then smooth: the loudness of what comes in, as CV
        const input = ctx.createGain(), rect = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), out = ctx.createGain();
        const curve = new Float32Array(1025); for (let i = 0; i < curve.length; i++) curve[i] = Math.abs(i / 512 - 1); rect.curve = curve;
        lp.type = "lowpass"; lp.frequency.value = num(mod, "smooth"); lp.Q.value = 0.5; out.gain.value = num(mod, "gain");
        input.connect(rect).connect(lp).connect(out);
        ins.set(key(mod.id, "in"), input); outs.set(key(mod.id, "out"), out); break;
      }
      case "macro": {
        const s = ctx.createConstantSource(), inv = ctx.createConstantSource();
        const v = num(mod, "value"), a = num(mod, "amount");
        s.offset.value = v * a; inv.offset.value = (1 - v) * a;
        sources.push(s, inv); outs.set(key(mod.id, "out"), s); outs.set(key(mod.id, "inv"), inv); break;
      }
      case "comb": {
        // tuned feedback comb: rings at the note (×TUNE). A feedback loop can't be shorter than one
        // 128-sample block in the browser, so high notes ring an octave (or two) lower — still in tune.
        const input = ctx.createGain(), dl = ctx.createDelay(1), fb = ctx.createGain(), damp = ctx.createBiquadFilter();
        const wet = ctx.createGain(), dry = ctx.createGain(), out = ctx.createGain();
        let period = 1 / Math.max(1, freq * num(mod, "tune"));
        const minLoop = 128 / ctx.sampleRate;
        while (period < minLoop) period *= 2;
        dl.delayTime.value = period; fb.gain.value = Math.min(0.97, num(mod, "feedback"));
        // Web Audio lowpass Q is a dB peak: keep it negative so the loop gain never exceeds FEEDBACK,
        // and a soft clipper in the loop stops patched feedback CV from running away
        damp.type = "lowpass"; damp.frequency.value = num(mod, "damp"); damp.Q.value = -6;
        const safe = ctx.createWaveShaper(); safe.curve = driveCurve(0.02);
        const mix = num(mod, "mix"); wet.gain.value = mix; dry.gain.value = 1 - mix;
        input.connect(dl); dl.connect(damp).connect(safe).connect(fb).connect(dl); damp.connect(wet).connect(out); input.connect(dry).connect(out);
        ins.set(key(mod.id, "in"), input); ins.set(key(mod.id, "feedback"), fb.gain); outs.set(key(mod.id, "out"), out); break;
      }
      case "output": {
        const i = ctx.createGain(); const pan = ctx.createStereoPanner(); const o = ctx.createGain();
        pan.pan.value = num(mod, "pan");
        o.gain.value = num(mod, "level") * (0.35 + 0.65 * velocity);
        ins.set(key(mod.id, "level"), o.gain);
        i.connect(pan).connect(o).connect(dest); finals.push(o);
        outputTaps.set(mod.id, o);
        ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "pan"), pan.pan); break;
      }
    }
  }

  for (const c of m.cables) {
    const src = outs.get(key(c.from.module, c.from.port));
    const dst = ins.get(key(c.to.module, c.to.port));
    const mod = m.modules.find((x) => x.id === c.to.module);
    if (!src || !dst || !mod) continue;
    const g = ctx.createGain();
    const def = MODULE_DEFS[mod.type].inputs.find((x) => x.id === c.to.port);
    const srcType = m.modules.find((x) => x.id === c.from.module)?.type;
    g.gain.value = def?.kind === "param" ? c.amount * (def.scale ?? 1) * (srcType === "vco" || srcType === "noise" ? 0.5 : 1) : c.amount;
    src.connect(g);
    if (dst instanceof AudioParam) g.connect(dst); else g.connect(dst);
  }

  const cleanups = m.modules.flatMap(mod => {
    const output = outs.get(key(mod.id, 'out')) ?? outputTaps.get(mod.id);
    const cleanup = output ? observeOutput?.(mod, output) : undefined;
    return cleanup ? [cleanup] : [];
  });
  let remaining = sources.length;
  if (!remaining) cleanups.forEach(cleanup => cleanup());
  for (const s of sources) {
    if (cleanups.length) s.addEventListener('ended', () => { remaining--; if (!remaining) cleanups.forEach(cleanup => cleanup()); }, { once: true });
    s.start(t0); s.stop(stopAt);
  }
  for (const f of finals) { f.gain.setValueAtTime(f.gain.value, stopAt - 0.03); f.gain.linearRampToValueAtTime(0, stopAt); }
  return life;
}

/* ---- presets: each builds its own rack and cables ---- */
type Spec = { mods: [string, ModuleType, Record<string, number | string>?][]; cables: [string, string, string, string, number, CableColor][] };
const build = (s: Spec): ModularPatch => ({
  version: 2,
  modules: s.mods.map(([id, type, params]) => ({ id, type, params: { ...newModule(type).params, ...params } })),
  cables: s.cables.map(([fm, fp, tm, tp, amount, color], i) => ({ id: `c${i}`, from: { module: fm, port: fp }, to: { module: tm, port: tp }, amount, color })),
});
const VOICE: Spec["cables"] = [["f", "out", "a", "in", 1, "white"], ["e1", "out", "a", "cv", 1, "yellow"], ["a", "out", "o", "in", 1, "white"]];
const BASIC: Spec["mods"] = [["v1", "vco"], ["f", "vcf"], ["e1", "env"], ["a", "vca"], ["o", "output"]];

export const MODULAR_PRESETS: { name: string; modular: ModularPatch }[] = [
  { name: "Modular Tech Vowel Motion", modular: build({
    mods: [["v1", "vco"], ["f", "formant"], ["e1", "env"], ["a", "vca"], ["p", "phaser"], ["s", "stereo"], ["o", "output"]],
    cables: [["v1", "out", "f", "in", 0.8, "red"], ...VOICE.filter((c) => c[2] !== "o"), ["a", "out", "p", "in", 1, "green"], ["p", "out", "s", "in", 1, "blue"], ["s", "out", "o", "in", 1, "white"]] }) },
  { name: "Modular Tech Sub Pressure", modular: build({
    mods: [["v1", "vco", { octave: -1 }], ["sub", "sub"], ["m", "mixer"], ["f", "vcf", { cutoff: 600 }], ["l", "lfo", { rate: 2 }], ["cv", "attenuverter", { amount: 0.2 }], ["e1", "env"], ["a", "vca"], ["c", "compressor"], ["o", "output"]],
    cables: [["v1", "out", "m", "in1", 0.6, "red"], ["sub", "out", "m", "in2", 0.8, "orange"], ["m", "out", "f", "in", 1, "white"], ["l", "out", "cv", "in", 1, "blue"], ["cv", "out", "f", "cutoff", 0.3, "purple"], ...VOICE.filter((c) => c[2] !== "o"), ["a", "out", "c", "in", 1, "green"], ["c", "out", "o", "in", 1, "white"]] }) },
  { name: "Modular Tech Empty Rack", modular: emptyModular() },
  { name: "Modular Tech Basic Voice", modular: build({ mods: BASIC, cables: [["v1", "out", "f", "in", 1, "red"], ...VOICE] }) },
  { name: "Modular Tech Wobble Bass", modular: build({
    mods: [["v1", "vco", { octave: -2 }], ["v2", "vco", { octave: -2, fine: 10 }], ["m", "mixer"], ["l", "lfo", { rate: 3, wave: "triangle" }], ["f", "vcf", { cutoff: 300, resonance: 10 }], ["e1", "env"], ["a", "vca"], ["o", "output"]],
    cables: [["v1", "out", "m", "in1", 0.8, "red"], ["v2", "out", "m", "in2", 0.6, "orange"], ["m", "out", "f", "in", 1, "white"], ["l", "out", "f", "cutoff", 0.25, "blue"], ...VOICE] }) },
  { name: "Modular Tech FM Bell", modular: build({
    mods: [["v1", "vco", { wave: "sine", octave: 1 }], ["v2", "vco", { wave: "sine" }], ["f", "vcf", { cutoff: 8000, resonance: 1 }], ["e1", "env", { attack: 0.001, decay: 1.2, sustain: 0, release: 1 }], ["a", "vca"], ["d", "delay", { time: 0.375, mix: 0.3 }], ["o", "output"]],
    cables: [["v1", "out", "v2", "fm", 0.6, "purple"], ["v2", "out", "f", "in", 0.9, "red"], ["f", "out", "a", "in", 1, "white"], ["e1", "out", "a", "cv", 1, "yellow"], ["a", "out", "d", "in", 1, "green"], ["d", "out", "o", "in", 1, "white"]] }) },
  { name: "Modular Tech Noise Snare", modular: build({
    mods: [["n", "noise"], ["v1", "vco", { wave: "triangle" }], ["m", "mixer"], ["f", "vcf", { type: "bandpass", cutoff: 1800, resonance: 2 }], ["e1", "env", { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }], ["e2", "env", { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }], ["a", "vca"], ["o", "output"]],
    cables: [["n", "out", "m", "in1", 1, "white"], ["v1", "out", "m", "in2", 0.4, "red"], ["e2", "out", "v1", "pitch", 0.4, "orange"], ["m", "out", "f", "in", 1, "green"], ...VOICE] }) },
  { name: "Modular Tech Acid Line", modular: build({
    mods: [["v1", "vco", { octave: -1 }], ["f", "vcf", { cutoff: 350, resonance: 18 }], ["e1", "env"], ["e2", "env", { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }], ["a", "vca"], ["dr", "drive", { amount: 0.5 }], ["o", "output"]],
    cables: [["v1", "out", "f", "in", 1, "red"], ["e2", "out", "f", "cutoff", 0.6, "orange"], ["f", "out", "a", "in", 1, "white"], ["e1", "out", "a", "cv", 1, "yellow"], ["a", "out", "dr", "in", 1, "green"], ["dr", "out", "o", "in", 1, "white"]] }) },
  { name: "Modular Tech Drone", modular: build({
    mods: [["v1", "vco", { octave: -1 }], ["v2", "vco", { octave: -1, fine: -12 }], ["n", "noise", { color: "pink" }], ["m", "mixer"], ["l", "lfo", { rate: 0.2 }], ["f", "vcf", { cutoff: 600, resonance: 8 }], ["e1", "env", { attack: 1.5, decay: 1, sustain: 1, release: 3 }], ["a", "vca"], ["o", "output"]],
    cables: [["v1", "out", "m", "in1", 0.7, "red"], ["v2", "out", "m", "in2", 0.7, "orange"], ["n", "out", "m", "in3", 0.1, "white"], ["m", "out", "f", "in", 1, "green"], ["l", "out", "f", "cutoff", 0.15, "blue"], ["l", "out", "o", "pan", 0.6, "purple"], ...VOICE] }) },
  { name: "Modular Tech Kick", modular: build({
    mods: [["v1", "vco", { wave: "sine", octave: -2 }], ["e1", "env", { attack: 0.001, decay: 0.35, sustain: 0, release: 0.15 }], ["e2", "env", { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 }], ["a", "vca"], ["dr", "drive", { amount: 0.3 }], ["o", "output"]],
    cables: [["v1", "out", "a", "in", 1, "red"], ["e1", "out", "a", "cv", 1, "yellow"], ["e2", "out", "v1", "pitch", 2, "orange"], ["a", "out", "dr", "in", 1, "green"], ["dr", "out", "o", "in", 1, "white"]] }) },
  { name: "Modular Tech Dub Chord", modular: build({
    mods: [["v1", "vco", { wave: "square" }], ["v2", "vco", { wave: "sawtooth", fine: 100 }], ["m", "mixer"], ["f", "vcf", { cutoff: 1200, resonance: 4 }], ["e1", "env", { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 }], ["a", "vca"], ["d", "delay", { time: 0.33, feedback: 0.6, mix: 0.5 }], ["o", "output"]],
    cables: [["v1", "out", "m", "in1", 0.6, "red"], ["v2", "out", "m", "in2", 0.5, "orange"], ["m", "out", "f", "in", 1, "white"], ["f", "out", "a", "in", 1, "green"], ["e1", "out", "a", "cv", 1, "yellow"], ["a", "out", "d", "in", 1, "blue"], ["d", "out", "o", "in", 1, "white"]] }) },
];

/** Fresh starting patch: VCO → VCF → VCA (envelope) → output, default knob settings. */
/* ---- advanced racks: step sequencers, chaos, envelope followers, macros and comb resonators ---- */
type SeqSteps = [number, number, number, number, number, number, number, number];
const steps = (v: SeqSteps) => Object.fromEntries(v.map((x, i) => [`s${i + 1}`, x]));
const ADVANCED: { name: string; modular: ModularPatch }[] = [];
const add = (name: string, spec: Spec) => ADVANCED.push({ name: `Modular Tech ${name}`, modular: build(spec) });

// 1 · Sequenced basses: the step sequencer plays the bassline from one held note, its GATE opens the filter each step
([
  ["Seq Bass Detroit", [0, 0, 12, 0, 3, 0, 7, 10], 8, "sawtooth", 380, 14, 0],
  ["Seq Bass Rubber", [0, 7, 0, 5, 0, 3, 0, -2], 6, "square", 520, 9, 0.04],
  ["Seq Bass Rolling", [0, 0, 0, 12, 0, 0, 10, 12], 10, "sawtooth", 260, 18, 0],
  ["Seq Bass Minor Walk", [0, 3, 5, 7, 10, 7, 5, 3], 5, "triangle", 900, 6, 0.06],
  ["Seq Bass Offbeat Sub", [-12, 0, -12, 0, -12, 0, -12, 3], 8, "sine", 1400, 2, 0],
] as const).forEach(([name, st, rate, wave, cutoff, res, glide]) => add(name, {
  mods: [["sq", "seq", { ...steps([...st] as SeqSteps), rate, glide, gate: 0.45 }], ["v1", "vco", { wave, octave: -1 }], ["sub", "sub", { level: 0.5 }], ["m", "mixer"],
    ["f", "vcf", { cutoff, resonance: res }], ["a", "vca"], ["e1", "env", { attack: 0.003, decay: 0.4, sustain: 0.8, release: 0.2 }], ["dr", "drive", { amount: 0.35 }], ["o", "output", { level: 0.6 }]],
  cables: [["sq", "out", "v1", "pitch", 1, "yellow"], ["sq", "out", "sub", "pitch", 1, "yellow"], ["v1", "out", "m", "in1", 0.8, "red"], ["sub", "out", "m", "in2", 0.7, "orange"],
    ["m", "out", "f", "in", 1, "white"], ["sq", "gate", "f", "cutoff", 0.35, "green"], ["f", "out", "a", "in", 1, "white"], ["e1", "out", "a", "cv", 1, "yellow"], ["a", "out", "dr", "in", 1, "blue"], ["dr", "out", "o", "in", 1, "white"]],
}));

// 2 · Sequenced leads and arps: steps transpose a bright VCO, gate drives the VCA, delay echoes it
([
  ["Seq Arp Crystal", [0, 7, 12, 19, 24, 19, 12, 7].map((x) => Math.min(12, x)), 12, "triangle", 0.25, 6000],
  ["Seq Arp Minor Ninth", [0, 3, 7, 10, 12, 10, 7, 3], 10, "sawtooth", 0.33, 3800],
  ["Seq Lead Acid Steps", [0, 12, 0, 10, 0, 7, 12, 3], 8, "sawtooth", 0.4, 1600],
  ["Seq Arp Pentatonic", [0, 2, 4, 7, 9, 12, 9, 7], 14, "square", 0.2, 5200],
  ["Seq Lead Glide Riff", [0, -2, 0, 3, 5, 3, 0, -5], 6, "sawtooth", 0.5, 2600],
] as const).forEach(([name, st, rate, wave, gate, cutoff]) => add(name, {
  mods: [["sq", "seq", { ...steps([...st] as SeqSteps), rate, gate, glide: name.includes("Glide") ? 0.08 : 0 }], ["v1", "vco", { wave }], ["v2", "vco", { wave: "sine", octave: 1 }],
    ["m", "mixer"], ["f", "vcf", { cutoff, resonance: 5 }], ["a", "vca"], ["d", "delay", { time: 0.28, feedback: 0.45, mix: 0.35 }], ["o", "output", { level: 0.55 }]],
  cables: [["sq", "out", "v1", "pitch", 1, "yellow"], ["sq", "out", "v2", "pitch", 1, "yellow"], ["v1", "out", "m", "in1", 0.8, "red"], ["v2", "out", "m", "in2", 0.3, "orange"],
    ["m", "out", "f", "in", 1, "white"], ["f", "out", "a", "in", 1, "white"], ["sq", "gate", "a", "cv", 1, "green"], ["a", "out", "d", "in", 1, "blue"], ["d", "out", "o", "in", 1, "white"]],
}));

// 3 · Chaos textures: a chaos generator wanders the wavefolder and filter so no two notes move alike
([
  ["Chaos Folded Pad", 0.6, 3.7, 0.9, 1600, 0.8],
  ["Chaos Storm Lead", 9, 3.98, 0.2, 2600, 0.4],
  ["Chaos Glass Drift", 0.25, 3.55, 1, 5200, 0.7],
  ["Chaos Machine Talk", 14, 3.92, 0, 1200, 0.3],
  ["Chaos Swamp Drone", 1.4, 3.85, 0.7, 700, 1],
] as const).forEach(([name, rate, chaos, smooth, cutoff, att]) => add(name, {
  mods: [["v1", "vco", { wave: "triangle" }], ["v2", "vco", { wave: "sawtooth", fine: 9, octave: name.includes("Drone") ? -1 : 0 }], ["m", "mixer"], ["ch", "chaos", { rate, chaos, smooth }],
    ["x", "fold", { folds: 0.5, gain: 1.4 }], ["f", "vcf", { cutoff, resonance: 3 }], ["e1", "env", { attack: att, decay: 0.8, sustain: 0.85, release: 1.6 }], ["a", "vca"],
    ["r", "reverb", { size: 2.4, mix: 0.35 }], ["o", "output", { level: name.includes("Machine") ? 0.28 : 0.5 }]],
  cables: [["v1", "out", "m", "in1", 0.7, "red"], ["v2", "out", "m", "in2", 0.5, "orange"], ["m", "out", "x", "in", 1, "white"], ["ch", "out", "x", "gain", 0.8, "purple"],
    ["x", "out", "f", "in", 1, "white"], ["ch", "out", "f", "cutoff", 0.25, "blue"], ...VOICE.filter((c) => c[2] !== "o"), ["a", "out", "r", "in", 1, "green"], ["r", "out", "o", "in", 1, "white"]],
}));

// 4 · Comb resonators: noise or a pulse excites a tuned comb — plucks, metal, bowed tones
([
  ["Comb Pluck Harp", "noise", 1, 0.93, 5200, 0.002, 0.25],
  ["Comb Steel Drum", "pulse", 2, 0.9, 7000, 0.001, 0.4],
  ["Comb Bowed Metal", "noise", 1.5, 0.97, 3000, 0.4, 0.9],
  ["Comb Dark Koto", "noise", 1, 0.88, 1800, 0.001, 0.18],
  ["Comb Glass Ping", "pulse", 4, 0.95, 12000, 0.001, 0.6],
] as const).forEach(([name, exc, tune, feedback, damp, attack, decay]) => add(name, {
  mods: [exc === "noise" ? ["x", "noise", { color: "white" }] : ["x", "vco", { wave: "square", octave: 0 }],
    ["e2", "env", { attack, decay: Math.min(0.08, decay / 4), sustain: name.includes("Bowed") ? 0.25 : 0, release: 0.05 }], ["ex", "vca"],
    ["cb", "comb", { tune, feedback, damp, mix: 0.9 }], ["e1", "env", { attack: 0.001, decay, sustain: name.includes("Bowed") ? 0.7 : 0.2, release: decay * 2 }], ["a", "vca"],
    ["r", "reverb", { size: 1.8, mix: 0.25 }], ["o", "output", { level: 0.6 }]],
  cables: [["x", "out", "ex", "in", 1, "red"], ["e2", "out", "ex", "cv", 1, "orange"], ["ex", "out", "cb", "in", 1, "white"], ["cb", "out", "a", "in", 1, "white"],
    ["e1", "out", "a", "cv", 1, "yellow"], ["a", "out", "r", "in", 1, "green"], ["r", "out", "o", "in", 1, "white"]],
}));

// 5 · Envelope follower: the sound's own loudness moves the filter (auto-wah) or the vowel
([
  ["Follower Auto Wah", "vcf", 18, 3, "sawtooth"],
  ["Follower Talking Bass", "formant", 10, 2.5, "square"],
  ["Follower Pumping Pad", "vcf", 4, 4, "sawtooth"],
  ["Follower Funk Clav", "vcf", 30, 2, "square"],
  ["Follower Vowel Sweep", "formant", 6, 3.5, "sawtooth"],
] as const).forEach(([name, target, speed, gain, wave]) => add(name, {
  mods: [["v1", "vco", { wave, octave: name.includes("Bass") ? -1 : 0 }], ["l", "lfo", { rate: name.includes("Pumping") ? 2 : 5.5, wave: "square", depth: 0.6 }], ["pre", "vca", { bias: 0.4 }],
    ["fo", "follower", { smooth: speed, gain }],
    target === "vcf" ? ["t", "vcf", { cutoff: 350, resonance: 14, type: "lowpass" }] : ["t", "formant", { vowel: "O", resonance: 9 }],
    ["e1", "env", { attack: 0.004, decay: 0.3, sustain: 0.7, release: 0.3 }], ["a", "vca"], ["o", "output", { level: target === "vcf" ? 0.9 : 1.8 }]],
  cables: [["v1", "out", "pre", "in", 1, "red"], ["l", "out", "pre", "cv", 0.6, "blue"], ["pre", "out", "t", "in", 1, "white"], ["pre", "out", "fo", "in", 1, "orange"],
    [ "fo", "out", "t", target === "vcf" ? "cutoff" : "shift", target === "vcf" ? 0.5 : 0.8, "purple"], ["t", "out", "a", "in", 1, "white"], ["e1", "out", "a", "cv", 1, "yellow"], ["a", "out", "o", "in", 1, "white"]],
}));

// 6 · Macro morphs: one MACRO knob moves fold, filter and blend together (and its INV output the other way)
([
  ["Macro Morph Pad", 0.3, "sawtooth", 1800],
  ["Macro Grit Bass", 0.7, "square", 500],
  ["Macro Bright Brass", 0.55, "sawtooth", 2400],
  ["Macro Hollow Keys", 0.2, "triangle", 3200],
  ["Macro Snarl Lead", 0.85, "sawtooth", 1400],
] as const).forEach(([name, value, wave, cutoff]) => add(name, {
  mods: [["mc", "macro", { value }], ["v1", "vco", { wave, octave: name.includes("Bass") ? -1 : 0 }], ["v2", "vco", { wave: "square", fine: -7, octave: name.includes("Bass") ? -1 : 0 }],
    ["m", "mixer"], ["x", "fold", { folds: 0.4, gain: 0.8 }], ["f", "vcf", { cutoff, resonance: 6 }], ["e1", "env", { attack: name.includes("Pad") ? 0.6 : 0.005, decay: 0.5, sustain: 0.75, release: 0.5 }],
    ["a", "vca"], ["ch", "chorus", { mix: 0.4 }], ["o", "output", { level: 0.5 }]],
  cables: [["v1", "out", "m", "in1", 0.7, "red"], ["v2", "out", "m", "in2", 0.5, "orange"], ["m", "out", "x", "in", 1, "white"],
    ["mc", "out", "x", "gain", 1.2, "purple"], ["mc", "out", "f", "cutoff", 0.4, "blue"], ["mc", "inv", "v2", "level", -0.6, "green"],
    ["x", "out", "f", "in", 1, "white"], ...VOICE.filter((c) => c[2] !== "o"), ["a", "out", "ch", "in", 1, "green"], ["ch", "out", "o", "in", 1, "white"]],
}));

// 7 · Ring & FM bells: ring modulation with a second VCO for clangorous, inharmonic tones
([
  ["Ring Bell Tower", 2.76, 1.4, 6000],
  ["Ring Robot Voice", 1.5, 0.3, 2200],
  ["Ring Gong Hit", 3.4, 2.5, 4000],
  ["Ring Alien Lead", 1.01, 0.5, 3500],
  ["Ring Tin Pluck", 5.2, 0.35, 9000],
] as const).forEach(([name, ratio, decay, cutoff]) => add(name, {
  mods: [["v1", "vco", { wave: "sine" }], ["v2", "vco", { wave: "sine", octave: Math.floor(Math.log2(ratio)), fine: Math.round(1200 * Math.log2(ratio / 2 ** Math.floor(Math.log2(ratio)))) % 100, semitone: Math.floor((1200 * Math.log2(ratio / 2 ** Math.floor(Math.log2(ratio)))) / 100) }],
    ["rm", "ring", { mix: 1 }], ["f", "vcf", { cutoff, resonance: 1.5 }], ["e1", "env", { attack: 0.001, decay, sustain: name.includes("Lead") || name.includes("Robot") ? 0.7 : 0, release: decay }],
    ["a", "vca"], ["d", "delay", { time: 0.42, feedback: 0.35, mix: 0.25 }], ["o", "output", { level: 0.6 }]],
  cables: [["v1", "out", "rm", "in", 1, "red"], ["v2", "out", "rm", "mod", 1, "orange"], ["rm", "out", "f", "in", 1, "white"], ...VOICE.filter((c) => c[2] !== "o"),
    ["a", "out", "d", "in", 1, "green"], ["d", "out", "o", "in", 1, "white"]],
}));

// 8 · Rhythmic gates and S&H: random or sequenced CV slices a pad into patterns
([
  ["Gate Trance Chop", 16, [12, 0, 12, 12, 0, 12, 12, 0], 0.4],
  ["Gate Dub Stab Steps", 6, [0, 0, 7, 0, 0, 5, 0, 3], 0.25],
  ["Gate Half Time Pulse", 4, [0, 0, 0, 0, 0, 0, 0, 0], 0.8],
  ["Gate Random Bleeps", 10, [0, 12, 7, 19 - 7, 3, 10, 5, 12], 0.15],
  ["Gate Shuffle Chords", 8, [0, 0, 5, 0, 0, 7, 0, 0], 0.55],
] as const).forEach(([name, rate, st, gate]) => add(name, {
  mods: [["sq", "seq", { ...steps([...st] as SeqSteps), rate, gate, length: 8 }], ["v1", "vco", { wave: "sawtooth" }], ["v2", "vco", { wave: "sawtooth", fine: 14 }], ["v3", "vco", { wave: "square", semitone: 7 }],
    ["m", "mixer"], ["sh", "sh", { rate: rate / 2, range: 0.4 }], ["f", "vcf", { cutoff: 1800, resonance: 8 }], ["a", "vca"], ["e1", "env", { attack: 0.01, decay: 1, sustain: 1, release: 0.4 }],
    ["fin", "vca"], ["st", "stereo", { rate: 0.3, depth: 0.6 }], ["o", "output", { level: 0.5 }]],
  cables: [["v1", "out", "m", "in1", 0.6, "red"], ["v2", "out", "m", "in2", 0.6, "orange"], ["v3", "out", "m", "in3", 0.4, "yellow"],
    ["sq", "out", "v1", "pitch", 1, "yellow"], ["sq", "out", "v2", "pitch", 1, "yellow"], ["sq", "out", "v3", "pitch", 1, "yellow"],
    ["m", "out", "f", "in", 1, "white"], ["sh", "out", "f", "cutoff", 0.25, "blue"], ["f", "out", "a", "in", 1, "white"], ["sq", "gate", "a", "cv", 1, "green"],
    ["a", "out", "fin", "in", 1, "white"], ["e1", "out", "fin", "cv", 1, "yellow"], ["fin", "out", "st", "in", 1, "purple"], ["st", "out", "o", "in", 1, "white"]],
}));
MODULAR_PRESETS.push(...ADVANCED);

export const initModularPatch = (): ModularPatch =>
  structuredClone(MODULAR_PRESETS.find((p) => p.name === "Modular Tech Basic Voice")?.modular ?? emptyModular());
