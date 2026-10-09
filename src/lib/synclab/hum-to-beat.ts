/**
 * Hum-to-Beat analysis — plain signal processing on the recorded PCM, no AI.
 *
 * - Melody: autocorrelation pitch tracking per frame, grouped into notes.
 * - Beatbox: energy-onset detection, each hit classified by its spectral
 *   brightness (zero-crossing rate + low-band energy) into kick / snare / hat.
 * Results are quantised to sixteenth-note steps at the song tempo.
 */

export interface HumNote { step: number; length: number; pitch: number; velocity: number }
export interface BeatHit { step: number; kind: "kick" | "snare" | "hat"; velocity: number }

const FRAME = 2048;

function rms(d: Float32Array, start: number, n: number) {
  let s = 0;
  for (let i = start; i < start + n && i < d.length; i++) s += d[i]! * d[i]!;
  return Math.sqrt(s / n);
}

/** Autocorrelation pitch (Hz) for one frame, or 0 when unvoiced. */
export function detectPitch(d: Float32Array, start: number, rate: number): number {
  const n = FRAME;
  if (start + n > d.length) return 0;
  if (rms(d, start, n) < 0.01) return 0;
  const minLag = Math.floor(rate / 1000); // 1 kHz top
  const maxLag = Math.floor(rate / 70); // 70 Hz bottom
  let best = 0;
  let bestLag = 0;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += d[start + i]! * d[start + i]!;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < n - lag; i++) s += d[start + i]! * d[start + i + lag]!;
    if (s > best) { best = s; bestLag = lag; }
  }
  if (!bestLag || best / energy < 0.5) return 0;
  return rate / bestLag;
}

const hzToMidi = (hz: number) => Math.round(69 + 12 * Math.log2(hz / 440));

export function analyseMelody(d: Float32Array, rate: number, bpm: number): HumNote[] {
  const hop = Math.floor(rate * 0.02);
  const stepSec = 60 / bpm / 4;
  const frames: number[] = [];
  for (let s = 0; s + FRAME < d.length; s += hop) {
    const hz = detectPitch(d, s, rate);
    frames.push(hz ? hzToMidi(hz) : 0);
  }
  // median-of-3 smoothing removes octave blips
  const sm = frames.map((v, i) => {
    const a = [frames[i - 1] ?? v, v, frames[i + 1] ?? v].sort((x, y) => x - y);
    return a[1]!;
  });
  const notes: HumNote[] = [];
  let cur = 0;
  let startF = 0;
  const flush = (endF: number) => {
    if (!cur) return;
    const t0 = (startF * hop) / rate;
    const t1 = (endF * hop) / rate;
    if (t1 - t0 < 0.08) return;
    const step = Math.round(t0 / stepSec);
    const length = Math.max(1, Math.round((t1 - t0) / stepSec));
    notes.push({ step, length, pitch: Math.max(24, Math.min(96, cur)), velocity: 0.8 });
  };
  sm.forEach((p, i) => {
    if (p !== cur) { flush(i); cur = p; startF = i; }
  });
  flush(sm.length);
  // drop overlapping notes on the same step
  const out: HumNote[] = [];
  for (const n of notes) {
    const prev = out[out.length - 1];
    if (prev && n.step <= prev.step) continue;
    if (prev && prev.step + prev.length > n.step) prev.length = Math.max(1, n.step - prev.step);
    out.push(n);
  }
  return out;
}

export function analyseBeatbox(d: Float32Array, rate: number, bpm: number): BeatHit[] {
  const hop = Math.floor(rate * 0.01);
  const win = Math.floor(rate * 0.02);
  const stepSec = 60 / bpm / 4;
  const env: number[] = [];
  for (let s = 0; s + win < d.length; s += hop) env.push(rms(d, s, win));
  const peak = Math.max(1e-6, ...env);
  const hits: BeatHit[] = [];
  let lastHit = -999;
  for (let i = 0; i < env.length; i++) {
    const rise = env[i]! - (env[i - 1] ?? 0);
    if (env[i]! > peak * 0.18 && rise > peak * 0.08 && i - lastHit > 8) {
      lastHit = i;
      const s0 = i * hop;
      const n = Math.min(Math.floor(rate * 0.06), d.length - s0);
      let zc = 0;
      let low = 0;
      let lp = 0;
      let tot = 0;
      const a = 1 - Math.exp((-2 * Math.PI * 200) / rate);
      for (let k = 1; k < n; k++) {
        const x = d[s0 + k]!;
        if ((x >= 0) !== (d[s0 + k - 1]! >= 0)) zc++;
        lp += a * (x - lp);
        low += lp * lp;
        tot += x * x;
      }
      const zcr = zc / Math.max(1, n);
      const lowRatio = low / Math.max(1e-9, tot);
      const kind: BeatHit["kind"] = lowRatio > 0.45 && zcr < 0.06 ? "kick" : zcr > 0.18 ? "hat" : "snare";
      hits.push({ step: Math.round((s0 / rate) / stepSec), kind, velocity: Math.min(1, 0.4 + env[i]! / peak) });
    }
  }
  return hits;
}

/** Shift everything so the first event lands on step 0. */
export function alignToStart<T extends { step: number }>(events: T[]): T[] {
  if (!events.length) return events;
  const first = Math.min(...events.map((e) => e.step));
  return events.map((e) => ({ ...e, step: e.step - first }));
}
