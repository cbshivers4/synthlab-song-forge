/** Modular Tech Synth: a patchable voice. Modules have fixed jacks; cables route audio or control voltage. */

export type ModOutJack = "vco1" | "vco2" | "noise" | "lfo" | "env1" | "env2" | "vcf" | "vca";
export type ModInJack =
  | "vcf.in"
  | "vca.in"
  | "out.in"
  | "vco1.pitch"
  | "vco2.pitch"
  | "vco2.fm"
  | "vcf.cutoff"
  | "vca.cv"
  | "out.pan";

export interface ModCable { id: string; from: ModOutJack; to: ModInJack; amount: number }

export interface ModularPatch {
  vco1: { wave: OscillatorType; octave: number; fine: number };
  vco2: { wave: OscillatorType; octave: number; fine: number };
  noise: { color: "white" | "pink" };
  lfo: { wave: OscillatorType; rate: number };
  env1: { attack: number; decay: number; sustain: number; release: number };
  env2: { attack: number; decay: number; sustain: number; release: number };
  vcf: { type: "lowpass" | "highpass" | "bandpass"; cutoff: number; resonance: number };
  vca: { bias: number };
  out: { level: number };
  cables: ModCable[];
}

export const OUT_JACKS: { id: ModOutJack; label: string; kind: "audio" | "cv" }[] = [
  { id: "vco1", label: "VCO 1 OUT", kind: "audio" },
  { id: "vco2", label: "VCO 2 OUT", kind: "audio" },
  { id: "noise", label: "NOISE OUT", kind: "audio" },
  { id: "lfo", label: "LFO OUT", kind: "cv" },
  { id: "env1", label: "ENV 1 OUT", kind: "cv" },
  { id: "env2", label: "ENV 2 OUT", kind: "cv" },
  { id: "vcf", label: "VCF OUT", kind: "audio" },
  { id: "vca", label: "VCA OUT", kind: "audio" },
];

export const IN_JACKS: { id: ModInJack; label: string; kind: "audio" | "cv" }[] = [
  { id: "vco1.pitch", label: "VCO 1 PITCH", kind: "cv" },
  { id: "vco2.pitch", label: "VCO 2 PITCH", kind: "cv" },
  { id: "vco2.fm", label: "VCO 2 FM", kind: "cv" },
  { id: "vcf.in", label: "VCF IN", kind: "audio" },
  { id: "vcf.cutoff", label: "VCF CUTOFF", kind: "cv" },
  { id: "vca.in", label: "VCA IN", kind: "audio" },
  { id: "vca.cv", label: "VCA CV", kind: "cv" },
  { id: "out.in", label: "OUTPUT", kind: "audio" },
  { id: "out.pan", label: "PAN CV", kind: "cv" },
];

let n = 0;
export const cableId = () => `cab-${Date.now().toString(36)}-${(n++).toString(36)}`;

export const defaultModular = (): ModularPatch => ({
  vco1: { wave: "sawtooth", octave: 0, fine: 0 },
  vco2: { wave: "square", octave: 0, fine: 7 },
  noise: { color: "white" },
  lfo: { wave: "sine", rate: 4 },
  env1: { attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.3 },
  env2: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
  vcf: { type: "lowpass", cutoff: 900, resonance: 6 },
  vca: { bias: 0 },
  out: { level: 0.7 },
  cables: [
    { id: "c1", from: "vco1", to: "vcf.in", amount: 0.8 },
    { id: "c2", from: "vco2", to: "vcf.in", amount: 0.5 },
    { id: "c3", from: "vcf", to: "vca.in", amount: 1 },
    { id: "c4", from: "env1", to: "vca.cv", amount: 1 },
    { id: "c5", from: "env2", to: "vcf.cutoff", amount: 0.5 },
    { id: "c6", from: "vca", to: "out.in", amount: 1 },
  ],
});

/** Scale applied to a CV cable for each destination (amount -1..1 times this). */
const CV_SCALE: Partial<Record<ModInJack, number>> = {
  "vco1.pitch": 1200, // cents
  "vco2.pitch": 1200,
  "vco2.fm": 2000, // Hz of linear FM depth (audio-rate capable)
  "vcf.cutoff": 6000, // Hz
  "vca.cv": 1,
  "out.pan": 1,
};

const noiseCache = new WeakMap<BaseAudioContext, Record<string, AudioBuffer>>();
function noiseBuffer(ctx: BaseAudioContext, color: "white" | "pink") {
  let c = noiseCache.get(ctx);
  if (!c) noiseCache.set(ctx, (c = {}));
  if (c[color]) return c[color]!;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "white") d[i] = w * 0.5;
    else {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }
  }
  c[color] = buf;
  return buf;
}

function envelope(ctx: BaseAudioContext, e: ModularPatch["env1"], t0: number, dur: number, peak: number) {
  const src = ctx.createConstantSource();
  const p = src.offset;
  p.setValueAtTime(0, t0);
  p.linearRampToValueAtTime(peak, t0 + Math.max(0.001, e.attack));
  p.setTargetAtTime(peak * e.sustain, t0 + Math.max(0.001, e.attack), Math.max(0.005, e.decay) / 3);
  const rel = t0 + Math.max(dur, e.attack);
  p.cancelScheduledValues(rel);
  p.setTargetAtTime(0, rel, Math.max(0.005, e.release) / 3);
  return src;
}

/** Builds one modular voice for a note and returns its total lifetime in seconds. */
export function playModularVoice(
  ctx: BaseAudioContext,
  dest: AudioNode,
  m: ModularPatch,
  midi: number,
  duration: number,
  velocity: number,
  t0: number,
  pitchBus?: AudioNode,
): number {
  const life = duration + Math.max(m.env1.release, m.env2.release) + 0.3;
  const stopAt = t0 + life;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const sources: AudioScheduledSourceNode[] = [];

  const vco = (cfg: ModularPatch["vco1"]) => {
    const o = ctx.createOscillator();
    o.type = cfg.wave;
    o.frequency.value = freq * Math.pow(2, cfg.octave);
    o.detune.value = cfg.fine;
    if (pitchBus) pitchBus.connect(o.detune);
    sources.push(o);
    return o;
  };
  const vco1 = vco(m.vco1);
  const vco2 = vco(m.vco2);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, m.noise.color);
  noise.loop = true;
  sources.push(noise);

  const lfo = ctx.createOscillator();
  lfo.type = m.lfo.wave;
  lfo.frequency.value = m.lfo.rate;
  sources.push(lfo);

  const env1 = envelope(ctx, m.env1, t0, duration, 1);
  const env2 = envelope(ctx, m.env2, t0, duration, 1);
  sources.push(env1, env2);

  const vcfIn = ctx.createGain();
  const vcf = ctx.createBiquadFilter();
  vcf.type = m.vcf.type;
  vcf.frequency.value = m.vcf.cutoff;
  vcf.Q.value = m.vcf.resonance;
  vcfIn.connect(vcf);

  const vcaIn = ctx.createGain();
  const vca = ctx.createGain();
  vca.gain.value = m.vca.bias;
  vcaIn.connect(vca);

  const outIn = ctx.createGain();
  const pan = ctx.createStereoPanner();
  const out = ctx.createGain();
  out.gain.value = m.out.level * (0.35 + 0.65 * velocity);
  outIn.connect(pan);
  pan.connect(out);
  out.connect(dest);

  const outs: Record<ModOutJack, AudioNode> = { vco1, vco2, noise, lfo, env1, env2, vcf, vca };
  const audioIns: Partial<Record<ModInJack, AudioNode>> = { "vcf.in": vcfIn, "vca.in": vcaIn, "out.in": outIn };
  const params: Partial<Record<ModInJack, AudioParam>> = {
    "vco1.pitch": vco1.detune,
    "vco2.pitch": vco2.detune,
    "vco2.fm": vco2.frequency,
    "vcf.cutoff": vcf.frequency,
    "vca.cv": vca.gain,
    "out.pan": pan.pan,
  };

  for (const c of m.cables) {
    const g = ctx.createGain();
    const a = audioIns[c.to];
    if (a) {
      g.gain.value = c.amount;
      outs[c.from].connect(g).connect(a);
      continue;
    }
    const p = params[c.to];
    if (!p) continue;
    // audio-rate VCO output sent to a CV input is ±1, envelopes 0..1 — both scaled to the destination range
    g.gain.value = c.amount * (CV_SCALE[c.to] ?? 1) * (c.from === "vco1" || c.from === "vco2" ? 0.5 : 1);
    outs[c.from].connect(g).connect(p);
  }

  for (const s of sources) {
    s.start(t0);
    s.stop(stopAt);
  }
  // final de-click
  out.gain.setValueAtTime(out.gain.value, stopAt - 0.03);
  out.gain.linearRampToValueAtTime(0, stopAt);
  return life;
}

type Partial2 = { [K in keyof ModularPatch]?: K extends "cables" ? [ModOutJack, ModInJack, number][] : Partial<ModularPatch[K]> };
const mk = (name: string, o: Partial2): { name: string; modular: ModularPatch } => {
  const base = defaultModular();
  const res: ModularPatch = {
    ...base,
    vco1: { ...base.vco1, ...o.vco1 },
    vco2: { ...base.vco2, ...o.vco2 },
    noise: { ...base.noise, ...o.noise },
    lfo: { ...base.lfo, ...o.lfo },
    env1: { ...base.env1, ...o.env1 },
    env2: { ...base.env2, ...o.env2 },
    vcf: { ...base.vcf, ...o.vcf },
    vca: { ...base.vca, ...o.vca },
    out: { ...base.out, ...o.out },
    cables: o.cables ? o.cables.map(([from, to, amount], i) => ({ id: `c${i}`, from, to, amount })) : base.cables,
  };
  return { name, modular: res };
};

const VOICE: [ModOutJack, ModInJack, number][] = [["vcf", "vca.in", 1], ["env1", "vca.cv", 1], ["vca", "out.in", 1]];

export const MODULAR_PRESETS = [
  mk("Modular Tech Init", {}),
  mk("Modular Tech Wobble Bass", { vco1: { octave: -2 }, vco2: { octave: -2, wave: "sawtooth", fine: 10 }, lfo: { rate: 3, wave: "triangle" }, vcf: { cutoff: 300, resonance: 10 }, cables: [["vco1", "vcf.in", 0.8], ["vco2", "vcf.in", 0.6], ["lfo", "vcf.cutoff", 0.25], ...VOICE] }),
  mk("Modular Tech FM Bell", { vco1: { wave: "sine", octave: 1 }, vco2: { wave: "sine", octave: 0, fine: 0 }, env1: { attack: 0.001, decay: 1.2, sustain: 0, release: 1 }, env2: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.5 }, vcf: { cutoff: 8000, resonance: 1 }, cables: [["vco1", "vco2.fm", 0.6], ["vco2", "vcf.in", 0.9], ...VOICE] }),
  mk("Modular Tech Noise Snare", { env1: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }, env2: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }, vcf: { type: "bandpass", cutoff: 1800, resonance: 2 }, vco1: { wave: "triangle", octave: 0 }, cables: [["noise", "vcf.in", 1], ["vco1", "vca.in", 0.4], ["env2", "vco1.pitch", 0.4], ...VOICE] }),
  mk("Modular Tech Acid Line", { vco1: { octave: -1 }, vco2: { octave: -1 }, env2: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }, vcf: { cutoff: 350, resonance: 18 }, cables: [["vco1", "vcf.in", 1], ["env2", "vcf.cutoff", 0.6], ...VOICE] }),
  mk("Modular Tech Sync Lead", { vco1: { wave: "square" }, vco2: { wave: "sawtooth", octave: 1, fine: 5 }, lfo: { rate: 5.5 }, vcf: { cutoff: 2600, resonance: 5 }, cables: [["vco1", "vcf.in", 0.5], ["vco2", "vcf.in", 0.6], ["lfo", "vco1.pitch", 0.02], ["lfo", "vco2.pitch", 0.02], ["env2", "vcf.cutoff", 0.3], ...VOICE] }),
  mk("Modular Tech Drone", { vco1: { octave: -1 }, vco2: { octave: -1, fine: -12 }, lfo: { rate: 0.2 }, env1: { attack: 1.5, decay: 1, sustain: 1, release: 3 }, vcf: { cutoff: 600, resonance: 8 }, cables: [["vco1", "vcf.in", 0.7], ["vco2", "vcf.in", 0.7], ["noise", "vcf.in", 0.08], ["lfo", "vcf.cutoff", 0.15], ["lfo", "out.pan", 0.6], ...VOICE] }),
  mk("Modular Tech Ring Metal", { vco1: { wave: "square", octave: 0 }, vco2: { wave: "sine", octave: 1, fine: 30 }, env1: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 }, vca: { bias: 0 }, vcf: { type: "highpass", cutoff: 300, resonance: 3 }, cables: [["vco1", "vca.in", 0.8], ["vco2", "vca.cv", 0.8], ["vca", "vcf.in", 1], ["vcf", "out.in", 1], ["env1", "out.pan", 0]] }),
  mk("Modular Tech Kick", { vco1: { wave: "sine", octave: -2 }, env1: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.15 }, env2: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 }, cables: [["vco1", "vca.in", 1], ["env1", "vca.cv", 1], ["env2", "vco1.pitch", 2], ["vca", "out.in", 1]] }),
  mk("Modular Tech Pluck Arp", { vco1: { wave: "triangle", octave: 1 }, vco2: { wave: "square", octave: 1, fine: 3 }, env1: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 }, env2: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 }, vcf: { cutoff: 900, resonance: 8 }, cables: [["vco1", "vcf.in", 0.7], ["vco2", "vcf.in", 0.4], ["env2", "vcf.cutoff", 0.5], ...VOICE] }),
];
