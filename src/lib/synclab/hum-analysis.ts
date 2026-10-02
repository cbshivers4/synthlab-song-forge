/**
 * Local Hum-to-Beat analysis: onset detection, per-hit pitch/brightness
 * classification and tempo-grid quantization. Runs entirely on-device.
 */
import { STEPS_PER_BEAT } from "./timebase";
import type { DrumKitId } from "./types";

export type HitClass = "kick" | "snare" | "hat";
export interface Hit {
  time: number; // seconds from take start
  strength: number; // 0..1
  pitch: number | null; // Hz, from autocorrelation
  zcr: number; // zero crossings per second
  cls: HitClass;
}
export interface HumAnalysis {
  hits: Hit[];
  duration: number;
  envelope: number[]; // downsampled 0..1 for drawing
}

const HOP = 0.01;

function pitchAt(data: Float32Array, sr: number, start: number): number | null {
  const n = Math.min(2048, data.length - start);
  if (n < 512) return null;
  const minLag = Math.floor(sr / 800), maxLag = Math.min(n - 1, Math.floor(sr / 60));
  let best = 0, bestLag = 0, energy = 0;
  for (let i = 0; i < n; i++) energy += (data[start + i] ?? 0) ** 2;
  if (energy < 1e-6) return null;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < n - lag; i++) s += (data[start + i] ?? 0) * (data[start + i + lag] ?? 0);
    if (s > best) { best = s; bestLag = lag; }
  }
  return bestLag && best / energy > 0.3 ? sr / bestLag : null;
}

export function analyzeHum(buffer: AudioBuffer): HumAnalysis {
  const sr = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const hop = Math.max(1, Math.round(sr * HOP));
  const frames = Math.floor(data.length / hop);
  const rms = new Array<number>(frames).fill(0);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) s += (data[i] ?? 0) ** 2;
    rms[f] = Math.sqrt(s / hop);
  }
  const peak = Math.max(...rms, 1e-6);
  const env = rms.map((v) => v / peak);
  // onset function: positive rise vs. the recent past
  const flux = env.map((v, i) => Math.max(0, v - Math.max(env[i - 1] ?? 0, env[i - 2] ?? 0, env[i - 3] ?? 0)));
  const hits: Hit[] = [];
  let last = -1;
  for (let i = 1; i < frames - 1; i++) {
    let local = 0, cnt = 0;
    for (let j = Math.max(0, i - 25); j < Math.min(frames, i + 25); j++) { local += flux[j]!; cnt++; }
    const thr = Math.max(0.06, (local / cnt) * 2.2);
    const isPeak = flux[i]! > thr && flux[i]! >= flux[i - 1]! && flux[i]! >= flux[i + 1]! && env[i]! > 0.12;
    if (!isPeak || (last >= 0 && i - last < 8)) continue; // ≥ 80 ms apart
    last = i;
    const start = i * hop;
    const win = Math.min(data.length - start, Math.round(sr * 0.06));
    let zc = 0;
    for (let k = 1; k < win; k++) if ((data[start + k - 1]! >= 0) !== (data[start + k]! >= 0)) zc++;
    const zcr = (zc / Math.max(1, win)) * sr;
    const pitch = pitchAt(data, sr, start);
    hits.push({ time: start / sr, strength: Math.min(1, env[Math.min(frames - 1, i + 2)]! + 0.2), pitch, zcr, cls: "snare" });
  }
  // classify relative to this take: low/voiced → kick, noisy/bright → hat, rest → snare
  if (hits.length) {
    const zs = hits.map((h) => h.zcr).sort((a, b) => a - b);
    const hiZ = zs[Math.floor(zs.length * 0.7)] ?? Infinity;
    const voiced = hits.filter((h) => h.pitch).map((h) => h.pitch!).sort((a, b) => a - b);
    const midP = voiced[Math.floor(voiced.length / 2)] ?? 200;
    for (const h of hits) {
      if (h.zcr > 3000 || (hits.length > 3 && h.zcr >= hiZ && h.zcr > 1500)) h.cls = "hat";
      else if (h.pitch && h.pitch <= midP) h.cls = "kick";
      else if (!h.pitch && h.zcr < 900) h.cls = "kick";
      else h.cls = "snare";
    }
    if (!hits.some((h) => h.cls === "kick")) hits[0]!.cls = "kick";
  }
  const step = Math.max(1, Math.floor(env.length / 240));
  const envelope = Array.from({ length: Math.ceil(env.length / step) }, (_, i) => Math.max(...env.slice(i * step, (i + 1) * step), 0));
  return { hits, duration: buffer.duration, envelope };
}

export type Grid = Record<HitClass, number[]>;

/** Snap hits to a 1/16 grid at the project tempo, starting at the first hit. */
export function quantize(hits: Hit[], bpm: number, steps: number): Grid {
  const grid: Grid = { kick: new Array(steps).fill(0), snare: new Array(steps).fill(0), hat: new Array(steps).fill(0) };
  if (!hits.length) return grid;
  const stepDur = 60 / bpm / STEPS_PER_BEAT;
  const t0 = hits[0]!.time;
  for (const h of hits) {
    const s = Math.round((h.time - t0) / stepDur);
    if (s >= steps) break;
    grid[h.cls][s] = Math.max(grid[h.cls][s]!, Math.max(0.4, h.strength));
  }
  return grid;
}

export interface HumGenre { id: string; name: string; kit: DrumKitId; hat: "8ths" | "16ths" | "offbeat" | "rolls" | "none"; backbeat: boolean }
export const HUM_GENRES: HumGenre[] = [
  { id: "detroit", name: "Detroit Techno", kit: "detroit", hat: "offbeat", backbeat: false },
  { id: "house", name: "House", kit: "house", hat: "offbeat", backbeat: true },
  { id: "trap", name: "Trap", kit: "trap", hat: "rolls", backbeat: true },
  { id: "boombap", name: "Boom Bap", kit: "boombap", hat: "8ths", backbeat: true },
  { id: "ghettotech", name: "Ghetto Tech", kit: "ghettotech", hat: "16ths", backbeat: true },
  { id: "lofi", name: "Lo-Fi", kit: "lofi", hat: "8ths", backbeat: true },
  { id: "raw", name: "Raw (your hits only)", kit: "909", hat: "none", backbeat: false },
];

/** Build a full beat: your detected hits are always kept; the genre adds supporting hats/backbeat with some variation. */
export function generateBeat(base: Grid, genre: HumGenre, variation: number, seed: number): Grid & { openhat: number[] } {
  let r = seed || 1;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const n = base.kick.length;
  const out = { kick: [...base.kick], snare: [...base.snare], hat: [...base.hat], openhat: new Array<number>(n).fill(0) };
  if (genre.hat === "none") return out;
  for (let i = 0; i < n; i++) {
    if (out.hat[i]) continue;
    const beatPos = i % 4;
    let v = 0;
    if (genre.hat === "8ths" && i % 2 === 0) v = beatPos === 0 ? 0.55 : 0.4;
    if (genre.hat === "16ths") v = beatPos === 0 ? 0.55 : 0.3;
    if (genre.hat === "offbeat" && beatPos === 2) { out.openhat[i] = 0.5; continue; }
    if (genre.hat === "rolls") v = i % 2 === 0 ? 0.45 : rand() < 0.25 * variation ? 0.3 : 0;
    if (v && rand() < 0.12 * variation) v = 0;
    out.hat[i] = v;
  }
  if (genre.backbeat && !out.snare.some(Boolean)) for (let i = 4; i < n; i += 8) out.snare[i] = 0.9;
  if (variation > 0) for (let i = 0; i < n; i++) if (!out.kick[i] && !out.snare[i] && rand() < 0.04 * variation) out.kick[i] = 0.45;
  return out;
}
