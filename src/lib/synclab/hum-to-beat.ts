/**
 * Hum-to-Beat analysis — plain signal processing on the recorded PCM, no AI.
 *
 * - Melody: YIN pitch tracking per 10 ms frame on a level-normalised signal, grouped into notes.
 * - Beatbox: energy-onset detection, each hit classified by its spectral
 *   brightness (zero-crossing rate + low-band energy) into kick / snare / hat.
 * Results are quantised to sixteenth-note steps at the song tempo.
 */

export interface HumNote { step: number; length: number; pitch: number; velocity: number }
export interface BeatHit { step: number; kind: "kick" | "snare" | "hat"; velocity: number }

function rms(d: Float32Array, start: number, n: number) {
  let s = 0;
  const end = Math.min(d.length, start + n);
  for (let i = start; i < end; i++) s += d[i]! * d[i]!;
  return Math.sqrt(s / Math.max(1, end - start));
}

/** Peak-normalise and decimate to ~11 kHz so quiet mics and slow phones still work. */
export function prepareVoice(d: Float32Array, rate: number) {
  const factor = Math.max(1, Math.floor(rate / 11025));
  const out = new Float32Array(Math.floor(d.length / factor));
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let k = 0; k < factor; k++) s += d[i * factor + k]!;
    out[i] = s / factor;
    peak = Math.max(peak, Math.abs(out[i]!));
  }
  if (peak > 1e-5) for (let i = 0; i < out.length; i++) out[i] = out[i]! * (0.9 / peak);
  return { x: out, rate: rate / factor };
}

/** YIN pitch (Hz) for one window starting at `start`, or 0 when unvoiced. */
export function detectPitch(d: Float32Array, start: number, rate: number): number {
  const W = Math.round(rate * 0.04);
  const tauMin = Math.max(2, Math.floor(rate / 1000));
  const tauMax = Math.floor(rate / 65);
  if (start + W + tauMax > d.length) return 0;
  if (rms(d, start, W) < 0.03) return 0;
  const diff = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) { const v = d[start + j]! - d[start + j + tau]!; s += v * v; }
    diff[tau] = s;
  }
  let run = 0;
  const cm = new Float32Array(tauMax + 1);
  cm[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) { run += diff[tau]!; cm[tau] = run > 0 ? (diff[tau]! * tau) / run : 1; }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cm[t]! < 0.2) { while (t + 1 <= tauMax && cm[t + 1]! < cm[t]!) t++; tau = t; break; }
  }
  if (tau < 0) {
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (cm[t]! < cm[best]!) best = t;
    if (cm[best]! > 0.35) return 0;
    tau = best;
  }
  const a = cm[tau - 1] ?? cm[tau]!, b = cm[tau]!, c = cm[tau + 1] ?? cm[tau]!;
  const den = a - 2 * b + c;
  const shift = den > 1e-9 ? (a - c) / (2 * den) : 0;
  return rate / (tau + Math.max(-1, Math.min(1, shift)));
}

const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);

export function analyseMelody(raw: Float32Array, rawRate: number, bpm: number): HumNote[] {
  const { x: d, rate } = prepareVoice(raw, rawRate);
  const hop = Math.max(1, Math.floor(rate * 0.01));
  const frameSec = hop / rate;
  const stepSec = 60 / bpm / 4;
  const frames: number[] = [];
  const levels: number[] = [];
  for (let s = 0; s < d.length; s += hop) {
    const hz = detectPitch(d, s, rate);
    frames.push(hz > 0 ? hzToMidi(hz) : 0);
    levels.push(rms(d, s, hop * 4));
  }
  // median-of-5 over voiced neighbours removes octave blips
  const sm = frames.map((v, i) => {
    if (!v) return 0;
    const a = frames.slice(Math.max(0, i - 2), i + 3).filter((x) => x > 0).sort((x, y) => x - y);
    return a[a.length >> 1]!;
  });
  const notes: HumNote[] = [];
  let group: number[] = [];
  let startF = 0;
  let gap = 0;
  let loud = 0;
  const flush = (endF: number) => {
    if (group.length * frameSec >= 0.09) {
      const sorted = [...group].sort((x, y) => x - y);
      const pitch = Math.round(sorted[sorted.length >> 1]!);
      const t0 = startF * frameSec;
      const t1 = endF * frameSec;
      notes.push({ step: Math.round(t0 / stepSec), length: Math.max(1, Math.round((t1 - t0) / stepSec)), pitch: Math.max(24, Math.min(96, pitch)), velocity: Math.min(1, 0.55 + loud) });
    }
    group = [];
    gap = 0;
    loud = 0;
  };
  sm.forEach((p, i) => {
    if (!p) {
      if (group.length && ++gap > 3) flush(i - gap + 1);
      return;
    }
    if (group.length) {
      const sorted = [...group].sort((x, y) => x - y);
      const centre = sorted[sorted.length >> 1]!;
      if (Math.abs(p - centre) > 0.8) flush(i - gap);
    }
    if (!group.length) startF = i;
    gap = 0;
    group.push(p);
    loud = Math.max(loud, levels[i] ?? 0);
  });
  if (group.length) flush(sm.length - gap);
  // drop overlapping notes on the same step
  const out: HumNote[] = [];
  for (const n of notes) {
    const prev = out[out.length - 1];
    if (prev && n.step <= prev.step) {
      if (n.pitch === prev.pitch) prev.length = Math.max(prev.length, n.step + n.length - prev.step);
      continue;
    }
    if (prev && prev.step + prev.length > n.step) prev.length = Math.max(1, n.step - prev.step);
    if (prev && prev.pitch === n.pitch && prev.step + prev.length >= n.step) { prev.length = n.step + n.length - prev.step; continue; }
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
