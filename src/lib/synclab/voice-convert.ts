/**
 * Voice conversion by DSP effects (pitch shift, tone shaping, layering, space).
 * Not AI voice cloning — it changes how your own voice sounds.
 */
import { wsolaStretch } from "./stretch";

type Filter = { type: BiquadFilterType; freq: number; gain?: number; Q?: number };
type Layer = { semis: number; gain: number; delayMs?: number };

export interface VoicePresetSpec {
  id: string;
  label: string;
  hint: string;
  group: "Character" | "Gender & age" | "Effects" | "Harmony & space" | "Custom";
  semis: number;
  filters?: Filter[];
  drive?: number;
  layers?: Layer[];
  robot?: boolean;
  ring?: { hz: number; mix: number };
  crush?: { bits: number; hold: number };
  wobble?: { hz: number; depth: number };
  reverb?: number;
}

export const VOICE_PRESETS: VoicePresetSpec[] = [
  {
    id: "deep",
    group: "Character",
    label: "Deeper",
    hint: "Down 5 semitones with extra low warmth.",
    semis: -5,
    filters: [{ type: "lowshelf", freq: 220, gain: 4 }],
  },
  {
    id: "higher",
    group: "Character",
    label: "Higher",
    hint: "Up 4 semitones, slightly brighter.",
    semis: 4,
    filters: [{ type: "highshelf", freq: 3000, gain: 3 }],
  },
  {
    id: "chipmunk",
    group: "Character",
    label: "Chipmunk",
    hint: "Up an octave — cartoon voice.",
    semis: 12,
  },
  {
    id: "monster",
    group: "Character",
    label: "Monster",
    hint: "Down 9 semitones with grit.",
    semis: -9,
    filters: [{ type: "lowshelf", freq: 150, gain: 6 }],
    drive: 4,
  },
  {
    id: "demon",
    group: "Character",
    label: "Demon",
    hint: "Your voice doubled a fifth and an octave down, distorted.",
    semis: 0,
    layers: [
      { semis: -7, gain: 0.7 },
      { semis: -12, gain: 0.7 },
    ],
    filters: [{ type: "lowshelf", freq: 180, gain: 5 }],
    drive: 3,
  },
  {
    id: "giant",
    group: "Character",
    label: "Giant",
    hint: "A full octave down with a big low end.",
    semis: -12,
    filters: [{ type: "lowshelf", freq: 200, gain: 5 }],
    reverb: 0.25,
  },
  {
    id: "alien",
    group: "Character",
    label: "Alien",
    hint: "Slightly higher with a wobbling metallic ring.",
    semis: 3,
    ring: { hz: 30, mix: 0.6 },
    filters: [{ type: "peaking", freq: 2500, gain: 5, Q: 2 }],
  },
  {
    id: "robot",
    group: "Character",
    label: "Robot",
    hint: "Metallic ring-mod and comb resonance.",
    semis: 0,
    robot: true,
  },

  {
    id: "male-to-female",
    group: "Gender & age",
    label: "Male → Female",
    hint: "Up 4 semitones, lighter low end, brighter top.",
    semis: 4,
    filters: [
      { type: "highpass", freq: 130, Q: 0.7 },
      { type: "highshelf", freq: 2500, gain: 3 },
    ],
  },
  {
    id: "female-to-male",
    group: "Gender & age",
    label: "Female → Male",
    hint: "Down 4 semitones with more chest.",
    semis: -4,
    filters: [
      { type: "lowshelf", freq: 200, gain: 4 },
      { type: "highshelf", freq: 6000, gain: -2 },
    ],
  },
  {
    id: "child",
    group: "Gender & age",
    label: "Child",
    hint: "Up 7 semitones, small and bright.",
    semis: 7,
    filters: [
      { type: "highpass", freq: 200, Q: 0.7 },
      { type: "highshelf", freq: 3500, gain: 2 },
    ],
  },
  {
    id: "elder",
    group: "Gender & age",
    label: "Old voice",
    hint: "Down 2 semitones with a shaky tremble.",
    semis: -2,
    wobble: { hz: 6, depth: 0.25 },
    filters: [{ type: "lowpass", freq: 6000, Q: 0.7 }],
  },

  {
    id: "radio",
    group: "Effects",
    label: "Radio / Phone",
    hint: "Thin, band-limited and slightly crunchy.",
    semis: 0,
    filters: [
      { type: "highpass", freq: 400, Q: 1 },
      { type: "lowpass", freq: 3200, Q: 1 },
    ],
    drive: 3,
  },
  {
    id: "megaphone",
    group: "Effects",
    label: "Megaphone",
    hint: "Narrow, loud and distorted like a bullhorn.",
    semis: 0,
    filters: [
      { type: "highpass", freq: 600, Q: 1.2 },
      { type: "lowpass", freq: 2500, Q: 1.2 },
      { type: "peaking", freq: 1500, gain: 6, Q: 1.5 },
    ],
    drive: 9,
  },
  {
    id: "underwater",
    group: "Effects",
    label: "Underwater",
    hint: "Muffled and wobbling, like singing in a pool.",
    semis: -1,
    filters: [{ type: "lowpass", freq: 500, Q: 2 }],
    wobble: { hz: 0.8, depth: 0.5 },
  },
  {
    id: "lofi",
    group: "Effects",
    label: "Lo-fi",
    hint: "Crushed bits and low sample rate, like an old sampler.",
    semis: 0,
    crush: { bits: 6, hold: 4 },
    filters: [{ type: "lowpass", freq: 4000, Q: 0.7 }],
  },

  {
    id: "double",
    group: "Harmony & space",
    label: "Vocal double",
    hint: "Two slightly detuned, delayed copies for a thick sound.",
    semis: 0,
    layers: [
      { semis: -0.12, gain: 0.6, delayMs: 18 },
      { semis: 0.12, gain: 0.6, delayMs: 31 },
    ],
  },
  {
    id: "harmony",
    group: "Harmony & space",
    label: "Harmony (5th)",
    hint: "Adds a harmony a fifth above your voice.",
    semis: 0,
    layers: [{ semis: 7, gain: 0.55 }],
  },
  {
    id: "choir",
    group: "Harmony & space",
    label: "Choir stack",
    hint: "Octave up and down plus a fifth, in a hall.",
    semis: 0,
    layers: [
      { semis: 12, gain: 0.35, delayMs: 12 },
      { semis: -12, gain: 0.4, delayMs: 20 },
      { semis: 7, gain: 0.35, delayMs: 27 },
    ],
    reverb: 0.35,
  },
  {
    id: "hall",
    group: "Harmony & space",
    label: "Big hall",
    hint: "Your voice in a large reverb space.",
    semis: 0,
    reverb: 0.45,
  },

  {
    id: "custom",
    group: "Custom",
    label: "Custom pitch",
    hint: "Pick your own semitone shift.",
    semis: 0,
  },
];

export type VoicePreset = string;

export function pitchShift(x: Float32Array, semis: number): Float32Array {
  if (!semis) return x.slice();
  const k = Math.pow(2, semis / 12);
  const long = wsolaStretch(x, 1 / k); // same pitch, k times longer
  const out = new Float32Array(x.length);
  for (let i = 0; i < out.length; i++) {
    const p = i * k;
    const a = Math.floor(p);
    const f = p - a;
    out[i] = (long[a] ?? 0) * (1 - f) + (long[a + 1] ?? 0) * f;
  }
  return out;
}

async function shape(x: Float32Array, sr: number, spec: VoicePresetSpec) {
  if (!spec.filters?.length && !spec.drive && !spec.reverb) return x;
  const ctx = new OfflineAudioContext(1, x.length, sr);
  const b = ctx.createBuffer(1, x.length, sr);
  b.copyToChannel(x as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource();
  src.buffer = b;
  let node: AudioNode = src;
  for (const f of spec.filters ?? []) {
    const q = ctx.createBiquadFilter();
    q.type = f.type;
    q.frequency.value = f.freq;
    q.gain.value = f.gain ?? 0;
    q.Q.value = f.Q ?? 0.7;
    node.connect(q);
    node = q;
  }
  if (spec.drive) {
    const s = ctx.createWaveShaper();
    const c = new Float32Array(1024);
    for (let i = 0; i < c.length; i++) {
      const v = i / 511.5 - 1;
      c[i] = Math.tanh(v * spec.drive) / Math.tanh(spec.drive);
    }
    s.curve = c;
    node.connect(s);
    node = s;
  }
  if (spec.reverb) {
    const conv = ctx.createConvolver();
    const len = Math.round(sr * 2.4);
    const ir = ctx.createBuffer(1, len, sr);
    const d = ir.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    conv.buffer = ir;
    const dry = ctx.createGain();
    dry.gain.value = 1 - spec.reverb * 0.5;
    const wet = ctx.createGain();
    wet.gain.value = spec.reverb * 0.6;
    node.connect(dry).connect(ctx.destination);
    node.connect(conv).connect(wet).connect(ctx.destination);
  } else node.connect(ctx.destination);
  src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

function robot(x: Float32Array, sr: number) {
  const out = new Float32Array(x.length);
  const delay = Math.round(sr / 110); // comb at 110 Hz
  for (let i = 0; i < x.length; i++) {
    const ring = x[i]! * Math.sin((2 * Math.PI * 50 * i) / sr);
    out[i] = 0.6 * ring + 0.4 * x[i]! + 0.5 * (out[i - delay] ?? 0);
  }
  return out;
}

function normalise(x: Float32Array, target = 0.95) {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.98) for (let i = 0; i < x.length; i++) x[i] = x[i]! * (target / peak);
  return x;
}

export async function convertVoice(buf: AudioBuffer, preset: VoicePreset, customSemis = 0) {
  const sr = buf.sampleRate;
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const mono = new Float32Array(L.length);
  for (let i = 0; i < mono.length; i++) mono[i] = (L[i]! + R[i]!) / 2;
  const spec = VOICE_PRESETS.find((p) => p.id === preset) ?? VOICE_PRESETS[0]!;
  const semis = spec.id === "custom" ? customSemis : spec.semis;
  let y = pitchShift(mono, semis);
  if (spec.layers?.length) {
    const sum = y.slice();
    for (const l of spec.layers) {
      const layer = pitchShift(mono, semis + l.semis);
      const off = Math.round(((l.delayMs ?? 0) / 1000) * sr);
      for (let i = off; i < sum.length; i++) sum[i] = sum[i]! + layer[i - off]! * l.gain;
    }
    y = sum;
  }
  if (spec.robot) y = robot(y, sr);
  if (spec.ring)
    for (let i = 0; i < y.length; i++)
      y[i] =
        y[i]! *
        (1 - spec.ring.mix + spec.ring.mix * Math.sin((2 * Math.PI * spec.ring.hz * i) / sr));
  y = normalise(y);
  y = await shape(y, sr, spec);
  if (spec.crush) {
    const levels = 2 ** (spec.crush.bits - 1);
    let held = 0;
    for (let i = 0; i < y.length; i++) {
      if (i % spec.crush.hold === 0) held = Math.round(y[i]! * levels) / levels;
      y[i] = held;
    }
  }
  if (spec.wobble)
    for (let i = 0; i < y.length; i++)
      y[i] =
        y[i]! *
        (1 - spec.wobble.depth * 0.5 * (1 + Math.sin((2 * Math.PI * spec.wobble.hz * i) / sr)));
  return normalise(y);
}
