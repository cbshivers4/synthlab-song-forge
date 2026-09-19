/**
 * Browser-native source separation.
 *
 * This is real DSP running on this device — no server, no fake progress bar:
 *  - the lead voice is pulled out with an adaptive centre/side mask across the
 *    vocal band, so what is shared between both speakers and sits in the voice
 *    range is treated as voice,
 *  - the instrumental is the mix with that voice signal subtracted,
 *  - bass is the low band, drums are the transient-dominant part of the rest,
 *    and "other" is the remainder.
 *
 * It is honest about what it is: a classic mid/side + band + transient
 * separator. It is not a trained separation model, so heavily mono mixes or
 * mixes where the voice is panned off-centre will separate less cleanly.
 */
import type { Capture } from "./bounce";

export type StemId = "vocals" | "instrumental" | "drums" | "bass" | "other";

export interface StemResult {
  id: StemId;
  name: string;
  capture: Capture;
}

export interface SeparateOptions {
  /** 0..1 — how hard the centre is pulled out of the instrumental. */
  strength?: number;
  /** low edge of the voice band, Hz */
  low?: number;
  /** high edge of the voice band, Hz */
  high?: number;
  onProgress?: (stage: string, fraction: number) => void;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function channel(buffer: AudioBuffer, index: number): Float32Array {
  return buffer.getChannelData(Math.min(index, buffer.numberOfChannels - 1));
}

/** Runs a filter graph offline over a mono signal and returns the result. */
async function filterMono(
  data: Float32Array,
  sampleRate: number,
  build: (ctx: OfflineAudioContext) => { input: AudioNode; output: AudioNode },
): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, data.length, sampleRate);
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const { input, output } = build(ctx);
  src.connect(input);
  output.connect(ctx.destination);
  src.start();
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
}

const bandpass = (low: number, high: number) => (ctx: OfflineAudioContext) => {
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = low;
  hp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = high;
  lp.Q.value = 0.7;
  hp.connect(lp);
  return { input: hp, output: lp };
};

const lowpass = (freq: number) => (ctx: OfflineAudioContext) => {
  const a = ctx.createBiquadFilter();
  a.type = "lowpass";
  a.frequency.value = freq;
  a.Q.value = 0.6;
  const b = ctx.createBiquadFilter();
  b.type = "lowpass";
  b.frequency.value = freq;
  b.Q.value = 0.6;
  a.connect(b);
  return { input: a, output: b };
};

const highpass = (freq: number) => (ctx: OfflineAudioContext) => {
  const a = ctx.createBiquadFilter();
  a.type = "highpass";
  a.frequency.value = freq;
  a.Q.value = 0.6;
  const b = ctx.createBiquadFilter();
  b.type = "highpass";
  b.frequency.value = freq;
  b.Q.value = 0.6;
  a.connect(b);
  return { input: a, output: b };
};

/** One-pole envelope follower over |x|, times in seconds. */
function envelope(data: Float32Array, sampleRate: number, attack: number, release: number): Float32Array {
  const out = new Float32Array(data.length);
  const ca = Math.exp(-1 / Math.max(1, attack * sampleRate));
  const cr = Math.exp(-1 / Math.max(1, release * sampleRate));
  let env = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i] ?? 0);
    const c = v > env ? ca : cr;
    env = v + c * (env - v);
    out[i] = env;
  }
  return out;
}

/** Smooths a control signal in both directions so masks never click. */
function smooth(data: Float32Array, sampleRate: number, ms: number): Float32Array {
  const c = Math.exp(-1 / Math.max(1, (ms / 1000) * sampleRate));
  const out = new Float32Array(data.length);
  let v = data[0] ?? 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i] ?? 0;
    v = x + c * (v - x);
    out[i] = v;
  }
  let w = out[out.length - 1] ?? 0;
  for (let i = out.length - 1; i >= 0; i--) {
    const x = out[i] ?? 0;
    w = x + c * (w - x);
    out[i] = w;
  }
  return out;
}

const cap = (left: Float32Array, right: Float32Array, sampleRate: number): Capture => ({ left, right, sampleRate });

export interface Separation {
  sampleRate: number;
  duration: number;
  vocals: Capture;
  instrumental: Capture;
  drums: Capture;
  bass: Capture;
  other: Capture;
  /** true when the source was mono, where centre extraction cannot work */
  mono: boolean;
}

export async function separate(buffer: AudioBuffer, options: SeparateOptions = {}): Promise<Separation> {
  const { strength = 1, low = 180, high = 8500, onProgress } = options;
  const sr = buffer.sampleRate;
  const n = buffer.length;
  const mono = buffer.numberOfChannels < 2;
  const L = channel(buffer, 0);
  const R = channel(buffer, 1);

  onProgress?.("Reading the mix", 0.05);
  const mid = new Float32Array(n);
  const side = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = L[i] ?? 0;
    const r = R[i] ?? 0;
    mid[i] = (l + r) / 2;
    side[i] = (l - r) / 2;
  }

  onProgress?.("Isolating the voice band", 0.2);
  const midBand = await filterMono(mid, sr, bandpass(low, high));
  const sideBand = mono ? new Float32Array(n) : await filterMono(side, sr, bandpass(low, high));

  onProgress?.("Building the voice mask", 0.4);
  const midEnv = envelope(midBand, sr, 0.005, 0.09);
  const sideEnv = envelope(sideBand, sr, 0.005, 0.09);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const m = midEnv[i] ?? 0;
    const s = (sideEnv[i] ?? 0) * 1.6;
    raw[i] = m <= 1e-7 ? 0 : clamp01((m * m) / (m * m + s * s + 1e-12));
  }
  const mask = smooth(raw, sr, 12);

  const vocal = new Float32Array(n);
  for (let i = 0; i < n; i++) vocal[i] = (midBand[i] ?? 0) * (mask[i] ?? 0) * strength;

  onProgress?.("Subtracting the voice", 0.55);
  const instL = new Float32Array(n);
  const instR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = vocal[i] ?? 0;
    instL[i] = (L[i] ?? 0) - v;
    instR[i] = (R[i] ?? 0) - v;
  }

  onProgress?.("Splitting bass", 0.7);
  const bassL = await filterMono(instL, sr, lowpass(120));
  const bassR = mono ? bassL.slice() : await filterMono(instR, sr, lowpass(120));

  onProgress?.("Finding the drums", 0.85);
  const upperL = await filterMono(instL, sr, highpass(150));
  const upperR = mono ? upperL.slice() : await filterMono(instR, sr, highpass(150));
  const sum = new Float32Array(n);
  for (let i = 0; i < n; i++) sum[i] = ((upperL[i] ?? 0) + (upperR[i] ?? 0)) / 2;
  const fast = envelope(sum, sr, 0.001, 0.02);
  const slow = envelope(sum, sr, 0.05, 0.35);
  const hits = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ratio = (fast[i] ?? 0) / ((slow[i] ?? 0) + 1e-6);
    hits[i] = clamp01((ratio - 1.05) / 0.9);
  }
  const drumMask = smooth(hits, sr, 8);

  const drumL = new Float32Array(n);
  const drumR = new Float32Array(n);
  const otherL = new Float32Array(n);
  const otherR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = drumMask[i] ?? 0;
    const ul = upperL[i] ?? 0;
    const ur = upperR[i] ?? 0;
    drumL[i] = ul * g;
    drumR[i] = ur * g;
    otherL[i] = ul * (1 - g);
    otherR[i] = ur * (1 - g);
  }

  onProgress?.("Done", 1);
  return {
    sampleRate: sr,
    duration: buffer.duration,
    mono,
    vocals: cap(vocal, vocal.slice(), sr),
    instrumental: cap(instL, instR, sr),
    drums: cap(drumL, drumR, sr),
    bass: cap(bassL, bassR, sr),
    other: cap(otherL, otherR, sr),
  };
}
