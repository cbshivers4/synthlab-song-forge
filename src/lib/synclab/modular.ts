/** Modular Tech Synth: an empty rack you fill with devices, then wire with coloured patch cables. */

export type ModuleType = "vco" | "noise" | "lfo" | "env" | "vcf" | "vca" | "mixer" | "drive" | "delay" | "output" | "fold" | "ring" | "sh" | "chorus" | "reverb";
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
  output: { type: "output", label: "OUTPUT", hp: 1, params: [{ id: "level", label: "LEVEL", min: 0, max: 1, step: 0.01, def: 0.7 }],
    inputs: [{ id: "in", label: "IN", kind: "audio" }, { id: "pan", label: "PAN CV", kind: "param", scale: 1 }], outputs: [] },
};

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
export function playModularVoice(ctx: BaseAudioContext, dest: AudioNode, raw: unknown, midi: number, duration: number, velocity: number, t0: number, pitchBus?: AudioNode): number {
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

  for (const mod of m.modules) {
    switch (mod.type) {
      case "vco": {
        const o = ctx.createOscillator();
        o.type = str(mod, "wave") as OscillatorType;
        o.frequency.value = freq * Math.pow(2, num(mod, "octave"));
        o.detune.value = num(mod, "fine");
        if (pitchBus) pitchBus.connect(o.detune);
        sources.push(o); outs.set(key(mod.id, "out"), o);
        ins.set(key(mod.id, "pitch"), o.detune); ins.set(key(mod.id, "fm"), o.frequency);
        break;
      }
      case "noise": {
        const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, str(mod, "color")); s.loop = true;
        sources.push(s); outs.set(key(mod.id, "out"), s); break;
      }
      case "lfo": {
        const o = ctx.createOscillator(); o.type = str(mod, "wave") as OscillatorType; o.frequency.value = num(mod, "rate");
        sources.push(o); outs.set(key(mod.id, "out"), o); ins.set(key(mod.id, "rate"), o.frequency); break;
      }
      case "env": {
        const s = ctx.createConstantSource(); const p = s.offset;
        const a = Math.max(0.001, num(mod, "attack")), d = Math.max(0.005, num(mod, "decay")), su = num(mod, "sustain"), r = Math.max(0.005, num(mod, "release"));
        p.setValueAtTime(0, t0); p.linearRampToValueAtTime(1, t0 + a); p.setTargetAtTime(su, t0 + a, d / 3);
        const rel = t0 + Math.max(duration, a); p.cancelScheduledValues(rel); p.setTargetAtTime(0, rel, r / 3);
        sources.push(s); outs.set(key(mod.id, "out"), s); break;
      }
      case "vcf": {
        const i = ctx.createGain(); const f = ctx.createBiquadFilter();
        f.type = str(mod, "type") as BiquadFilterType; f.frequency.value = num(mod, "cutoff"); f.Q.value = num(mod, "resonance");
        i.connect(f); ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "cutoff"), f.frequency); outs.set(key(mod.id, "out"), f); break;
      }
      case "vca": {
        const i = ctx.createGain(); const g = ctx.createGain(); g.gain.value = num(mod, "bias");
        i.connect(g); ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "cv"), g.gain); outs.set(key(mod.id, "out"), g); break;
      }
      case "mixer": {
        const g = ctx.createGain(); g.gain.value = num(mod, "level");
        for (let k = 1; k <= 4; k++) ins.set(key(mod.id, `in${k}`), g);
        outs.set(key(mod.id, "out"), g); break;
      }
      case "drive": {
        const i = ctx.createGain(); i.gain.value = 1 + num(mod, "amount") * 3; const w = ctx.createWaveShaper(); w.curve = driveCurve(num(mod, "amount")); w.oversample = "2x";
        i.connect(w); ins.set(key(mod.id, "in"), i); outs.set(key(mod.id, "out"), w); break;
      }
      case "delay": {
        const i = ctx.createGain(); const dl = ctx.createDelay(2); dl.delayTime.value = num(mod, "time");
        const fb = ctx.createGain(); fb.gain.value = num(mod, "feedback"); const wet = ctx.createGain(); wet.gain.value = num(mod, "mix");
        const dry = ctx.createGain(); dry.gain.value = 1 - num(mod, "mix") * 0.5; const o = ctx.createGain();
        i.connect(dry).connect(o); i.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(o);
        ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "time"), dl.delayTime); outs.set(key(mod.id, "out"), o); break;
      }
      case "fold": {
        const i = ctx.createGain(); i.gain.value = num(mod, "gain"); const w = ctx.createWaveShaper(); w.curve = foldCurve(num(mod, "folds")); w.oversample = "4x";
        const o = ctx.createGain(); o.gain.value = 0.8;
        i.connect(w).connect(o); ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "gain"), i.gain); outs.set(key(mod.id, "out"), o); break;
      }
      case "ring": {
        const i = ctx.createGain(); const r = ctx.createGain(); r.gain.value = 1 - num(mod, "mix");
        i.connect(r); ins.set(key(mod.id, "in"), i); ins.set(key(mod.id, "mod"), r.gain); outs.set(key(mod.id, "out"), r); break;
      }
      case "sh": {
        const s = ctx.createConstantSource(); const rate = Math.max(0.5, num(mod, "rate")), range = num(mod, "range");
        for (let t = t0; t < stopAt; t += 1 / rate) s.offset.setValueAtTime((Math.random() * 2 - 1) * range, t);
        sources.push(s); outs.set(key(mod.id, "out"), s); break;
      }
      case "chorus": {
        const i = ctx.createGain(); const dl = ctx.createDelay(0.1); dl.delayTime.value = 0.015;
        const lfo = ctx.createOscillator(); lfo.frequency.value = num(mod, "rate"); const dep = ctx.createGain(); dep.gain.value = 0.008 * num(mod, "depth");
        lfo.connect(dep).connect(dl.delayTime); sources.push(lfo);
        const wet = ctx.createGain(); wet.gain.value = num(mod, "mix"); const dry = ctx.createGain(); dry.gain.value = 1 - num(mod, "mix") * 0.5; const o = ctx.createGain();
        i.connect(dry).connect(o); i.connect(dl).connect(wet).connect(o);
        ins.set(key(mod.id, "in"), i); outs.set(key(mod.id, "out"), o); break;
      }
      case "reverb": {
        const i = ctx.createGain(); const cv = ctx.createConvolver(); cv.buffer = springIR(ctx, num(mod, "size"));
        const wet = ctx.createGain(); wet.gain.value = num(mod, "mix") * 0.6; const dry = ctx.createGain(); dry.gain.value = 1 - num(mod, "mix") * 0.5; const o = ctx.createGain();
        i.connect(dry).connect(o); i.connect(cv).connect(wet).connect(o);
        ins.set(key(mod.id, "in"), i); outs.set(key(mod.id, "out"), o); break;
      }
      case "output": {
        const i = ctx.createGain(); const pan = ctx.createStereoPanner(); const o = ctx.createGain();
        o.gain.value = num(mod, "level") * (0.35 + 0.65 * velocity);
        i.connect(pan).connect(o).connect(dest); finals.push(o);
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

  for (const s of sources) { s.start(t0); s.stop(stopAt); }
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
export const initModularPatch = (): ModularPatch =>
  structuredClone(MODULAR_PRESETS.find((p) => p.name === "Modular Tech Basic Voice")?.modular ?? emptyModular());
