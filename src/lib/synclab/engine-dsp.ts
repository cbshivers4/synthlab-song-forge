/* Pure engine helpers moved out of audio-engine.ts unchanged; audio-engine re-exports the public ones. */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Loudest absolute value inside a 0..1 window of some channels. */
/** Band Q that makes a resonator band ring for about `decay` seconds (60 dB) at `hz`. */
export const resonatorQ = (hz: number, decay: number) =>
  clamp((Math.PI * hz * Math.max(0.1, decay)) / 6.9, 8, 420);
/** Narrower bands catch less energy, so louder rings get matching make-up; higher bands are damped. */
export const resonatorGain = (q: number, damping: number, i: number, count: number) =>
  ((1 - damping * (i / count)) / count) * Math.sqrt(q / 8) * 2;

export function peakInWindow(channels: Float32Array[], start: number, end: number): number {
  let peak = 0;
  for (const data of channels) {
    const from = Math.max(0, Math.floor(clamp(start, 0, 1) * data.length));
    const to = Math.min(data.length, Math.ceil(clamp(end, 0, 1) * data.length));
    for (let i = from; i < to; i++) {
      const v = Math.abs(data[i]!);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/** Trim window (0..1) to read from the (possibly reversed) buffer so reverse plays the selected part backwards. */
export function sampleWindow(start: number, end: number, reverse: boolean): [number, number] {
  const a0 = clamp(start, 0, 0.999);
  const b0 = clamp(end, a0 + 0.001, 1);
  if (!reverse) return [a0, b0];
  return [clamp(1 - b0, 0, 0.999), clamp(1 - a0, 1 - b0 + 0.001, 1)];
}

export function makeImpulse(ctx: AudioContext, decay: number) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * decay));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
  }
  return buf;
}

export function makeBitcrushCurve(bits: number) {
  const steps = Math.pow(2, bits);
  const n = 8192;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

export function makeDistortionCurve(amount: number) {
  const k = amount * 100;
  const n = 1025; // Odd size maps silence to exactly zero, avoiding a DC floor.
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}
