import type { Capture } from "./bounce";

/**
 * Auto level for finished tape/cassette/CD takes. Microphone and interface inputs arrive raw
 * (no browser auto gain), so a normal take often peaks far below full scale and plays back
 * quietly next to the song. This raises the take toward a steady loudness, then a look-ahead
 * peak limiter keeps every sample under the ceiling so the boost never clips. Takes that are
 * already loud (a mastered song) are left exactly as recorded; it never turns anything down.
 */
export const AUTO_LEVEL_TARGET_DB = -14;
export const AUTO_LEVEL_CEILING_DB = -1;
export const AUTO_LEVEL_MAX_BOOST_DB = 24;
/** Quieter blocks than this (dBFS) are treated as silence and don't pull loudness down. */
const GATE_DB = -50;
/** A side quieter than this while the other side sounds is a one-sided input (interface IN 1 only). */
const ONE_SIDED_DB = -45;
const BLOCK = 128;

const db = (value: number) => 10 ** (value / 20);

export interface AutoLevelResult {
  /** Overall boost applied, in dB (0 when the take was already loud enough or silent). */
  boostDb: number;
  /** True when the limiter had to hold peaks down. */
  limited: boolean;
  /** Set when one side was silent and was filled from the other. */
  centered: "left" | "right" | null;
}

function peakOf(data: Float32Array) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i] ?? 0);
    if (v > peak) peak = v;
  }
  return peak;
}

/** Edits the take in place (it is freshly recorded and owned by the recorder). */
export function autoLevelTake(take: Capture): AutoLevelResult {
  const { left } = take;
  const right = take.right.length === left.length ? take.right : left;
  const n = left.length;
  const none: AutoLevelResult = { boostDb: 0, limited: false, centered: null };
  if (!n) return none;

  let centered: AutoLevelResult["centered"] = null;
  if (right !== left) {
    const pl = peakOf(left),
      pr = peakOf(right);
    if (pl >= db(GATE_DB) && pr < pl * db(ONE_SIDED_DB)) {
      right.set(left);
      centered = "left";
    } else if (pr >= db(GATE_DB) && pl < pr * db(ONE_SIDED_DB)) {
      left.set(right);
      centered = "right";
    }
  }

  // Gated loudness over ~50 ms windows, so pauses between phrases don't count.
  const win = Math.max(1, Math.round(take.sampleRate * 0.05));
  const gate = db(GATE_DB) ** 2;
  let sum = 0,
    counted = 0;
  for (let start = 0; start < n; start += win) {
    const end = Math.min(n, start + win);
    let ms = 0;
    for (let i = start; i < end; i++) {
      const l = left[i] ?? 0,
        r = right[i] ?? 0;
      ms += (l * l + r * r) / 2;
    }
    ms /= end - start;
    if (ms > gate) {
      sum += ms * (end - start);
      counted += end - start;
    }
  }
  if (!counted) return { ...none, centered };
  const rms = Math.sqrt(sum / counted);
  const gain = Math.min(db(AUTO_LEVEL_MAX_BOOST_DB), db(AUTO_LEVEL_TARGET_DB) / rms);
  if (gain <= 1.01) return { ...none, centered };

  // Required gain reduction per block so boosted peaks stay under the ceiling.
  const ceiling = db(AUTO_LEVEL_CEILING_DB);
  const blocks = Math.ceil(n / BLOCK);
  const need = new Float32Array(blocks);
  let limited = false;
  for (let b = 0; b < blocks; b++) {
    let peak = 0;
    const end = Math.min(n, (b + 1) * BLOCK);
    for (let i = b * BLOCK; i < end; i++) {
      const v = Math.max(Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
      if (v > peak) peak = v;
    }
    const r = peak * gain > ceiling ? ceiling / (peak * gain) : 1;
    if (r < 1) limited = true;
    need[b] = r;
  }
  // Gain at each block edge never exceeds either neighbouring block's requirement, so the
  // straight line between two edges keeps every sample of that block under the ceiling.
  const points = new Float32Array(blocks + 1);
  for (let k = 0; k <= blocks; k++) points[k] = Math.min(need[k - 1] ?? 1, need[k] ?? 1);
  // Look-ahead attack (~5 ms) eases down before a peak; release (~120 ms) eases back up.
  const blockSec = BLOCK / take.sampleRate;
  const attack = 1 - Math.exp(-blockSec / 0.005);
  const release = 1 - Math.exp(-blockSec / 0.12);
  for (let k = blocks - 1; k >= 0; k--) {
    const next = points[k + 1] ?? 1;
    points[k] = Math.min(points[k] ?? 1, next + (1 - next) * attack);
  }
  for (let k = 1; k <= blocks; k++) {
    const prev = points[k - 1] ?? 1;
    points[k] = Math.min(points[k] ?? 1, prev + (1 - prev) * release);
  }
  const sameArray = right === left;
  for (let b = 0; b < blocks; b++) {
    const g0 = (points[b] ?? 1) * gain,
      g1 = (points[b + 1] ?? 1) * gain;
    const start = b * BLOCK,
      end = Math.min(n, start + BLOCK);
    for (let i = start; i < end; i++) {
      const g = g0 + ((g1 - g0) * (i - start)) / BLOCK;
      left[i] = (left[i] ?? 0) * g;
      if (!sameArray) right[i] = (right[i] ?? 0) * g;
    }
  }
  return { boostDb: 20 * Math.log10(gain), limited, centered };
}
